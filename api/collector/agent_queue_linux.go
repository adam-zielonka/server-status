package collector

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/url"
	"os"
	"reflect"
	"regexp"
	"strings"
	"time"
)

const queueInterval = 300
const queueMaxAge = 900
const queueMaxPages = 25
const queueMaxBytes = 16 * 1024 * 1024

var queueStatuses = []string{"Nowe", "Gotowe", "Analiza", "W toku", "Weryfikacja", "Czeka na Ciebie", "Zablokowane", "Zakończone", "Anulowane"}
var queueKeys = []string{"new", "ready", "analysis", "in_progress", "review", "waiting", "blocked", "done", "cancelled"}
var queueGroups = []string{"queued", "queued", "active", "active", "active", "waiting", "blocked", "", ""}
var queueID = regexp.MustCompile(`^[A-Za-z0-9_-]{1,200}$`)
var errQueue = errors.New("queue source incomplete or unavailable")

type queueSource struct {
	Repository string `json:"repository"`
	ProjectID  string `json:"project_id"`
	ProjectURL string `json:"project_url"`
	Fields     struct {
		Status struct {
			ID      string            `json:"id"`
			Options map[string]string `json:"options"`
		} `json:"status"`
	} `json:"fields"`
}

type queueCounts struct {
	Open     int            `json:"open"`
	Queued   int            `json:"queued"`
	Active   int            `json:"active"`
	Waiting  int            `json:"waiting"`
	Blocked  int            `json:"blocked"`
	Statuses map[string]int `json:"statuses"`
}
type queueSnapshot struct {
	Status        string       `json:"status"`
	Stale         bool         `json:"stale"`
	LastAttemptAt string       `json:"last_attempt_at"`
	LastSuccessAt *string      `json:"last_success_at"`
	SourceURL     string       `json:"source_url,omitempty"`
	Counts        *queueCounts `json:"counts"`
	Error         string       `json:"error,omitempty"`
}
type queueCache struct {
	ConfigFile  string        `json:"config_file"`
	Fingerprint string        `json:"fingerprint"`
	Snapshot    queueSnapshot `json:"snapshot"`
}

// A board link has no credential, query, fragment or arbitrary path. Production
// configuration is never copied into the public frontend or demo.
func safeQueueURL(value string) bool {
	u, err := url.Parse(value)
	return err == nil && u.Scheme == "https" && u.Host == "github.com" && u.User == nil && u.RawQuery == "" && u.Fragment == "" && u.RawPath == "" && regexp.MustCompile(`^/(users|orgs)/[A-Za-z0-9_-]+/projects/[1-9][0-9]*(/views/[1-9][0-9]*)?$`).MatchString(u.Path)
}

func readQueueSource(path string) (*queueSource, string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, "", errQueue
	}
	defer f.Close()
	body, err := io.ReadAll(io.LimitReader(f, 65537))
	if err != nil {
		return nil, "", errQueue
	}
	hash := sha256.Sum256(append([]byte(path+"\x00"), body...))
	fingerprint := hex.EncodeToString(hash[:])
	if len(body) > 65536 {
		return nil, fingerprint, errQueue
	}
	var source queueSource
	if json.Unmarshal(body, &source) != nil || !repositoryPattern.MatchString(source.Repository) || !queueID.MatchString(source.ProjectID) || !queueID.MatchString(source.Fields.Status.ID) || !safeQueueURL(source.ProjectURL) || len(source.Fields.Status.Options) != len(queueStatuses) {
		return nil, fingerprint, errQueue
	}
	ids := map[string]bool{}
	for _, name := range queueStatuses {
		id := source.Fields.Status.Options[name]
		if !queueID.MatchString(id) || ids[id] {
			return nil, fingerprint, errQueue
		}
		ids[id] = true
	}
	return &source, fingerprint, nil
}

const queueQuery = `query($project: ID!, $field: ID!, $after: String) {
 status: node(id: $field) { ... on ProjectV2SingleSelectField { id name project { id } options { id name } } }
 project: node(id: $project) { ... on ProjectV2 { id url items(first: 100, after: $after) {
 nodes { id type content { __typename ... on Issue { id state repository { nameWithOwner } } }
 status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { optionId field { ... on ProjectV2SingleSelectField { id } } } } }
 pageInfo { hasNextPage endCursor }
 } } }
}`

type queueItem struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Content *struct {
		Type       string `json:"__typename"`
		ID         string `json:"id"`
		State      string `json:"state"`
		Repository struct {
			Name string `json:"nameWithOwner"`
		} `json:"repository"`
	} `json:"content"`
	Status *struct {
		OptionID string `json:"optionId"`
		Field    struct {
			ID string `json:"id"`
		} `json:"field"`
	} `json:"status"`
}
type queueResponse struct {
	Errors json.RawMessage `json:"errors"`
	Data   *struct {
		Status *struct {
			ID      string `json:"id"`
			Name    string `json:"name"`
			Project struct {
				ID string `json:"id"`
			} `json:"project"`
			Options []struct {
				ID   string `json:"id"`
				Name string `json:"name"`
			} `json:"options"`
		} `json:"status"`
		Project *struct {
			ID    string `json:"id"`
			URL   string `json:"url"`
			Items *struct {
				Nodes    *[]*queueItem `json:"nodes"`
				PageInfo *struct {
					HasNext *bool   `json:"hasNextPage"`
					Cursor  *string `json:"endCursor"`
				} `json:"pageInfo"`
			} `json:"items"`
		} `json:"project"`
	} `json:"data"`
}

// All pages must validate before any counts become publishable. Relations are
// deliberately not requested: parent and child are independent issue IDs.
func (s sampler) fetchQueue(ctx context.Context, source *queueSource) (*queueCounts, error) {
	ctx, cancel := context.WithTimeout(ctx, 35*time.Second)
	defer cancel()
	counts := &queueCounts{Statuses: map[string]int{}}
	options := map[string]int{}
	for i, name := range queueStatuses {
		options[source.Fields.Status.Options[name]] = i
		if i < 7 {
			counts.Statuses[queueKeys[i]] = 0
		}
	}
	seen := map[string]string{}
	cursors := map[string]bool{}
	cursor := ""
	size := 0
	for page := 0; page < queueMaxPages; page++ {
		args := []string{"gh", "api", "graphql", "--hostname", "github.com", "-f", "query=" + queueQuery, "-F", "project=" + source.ProjectID, "-F", "field=" + source.Fields.Status.ID}
		if cursor != "" {
			args = append(args, "-f", "after="+cursor)
		}
		body, err := s.query(ctx, args, 8*time.Second, nil)
		size += len(body)
		if err != nil || ctx.Err() != nil || len(body) > 4*1024*1024 || size > queueMaxBytes {
			return nil, errQueue
		}
		var response queueResponse
		if json.Unmarshal(body, &response) != nil || (len(response.Errors) > 0 && string(response.Errors) != "null" && string(response.Errors) != "[]") || response.Data == nil {
			return nil, errQueue
		}
		d := response.Data
		if d.Status == nil || d.Project == nil || d.Status.ID != source.Fields.Status.ID || d.Status.Name != "Status" || d.Status.Project.ID != source.ProjectID || d.Project.ID != source.ProjectID || !safeQueueURL(d.Project.URL) {
			return nil, errQueue
		}
		// Verify both option names and IDs against the canonical configuration.
		actual := map[string]string{}
		for _, o := range d.Status.Options {
			if _, ok := actual[o.Name]; ok {
				return nil, errQueue
			}
			actual[o.Name] = o.ID
		}
		if !reflect.DeepEqual(actual, source.Fields.Status.Options) {
			return nil, errQueue
		}
		// The configured link may select a view of this exact project.
		if source.ProjectURL != d.Project.URL && !strings.HasPrefix(source.ProjectURL, d.Project.URL+"/views/") {
			return nil, errQueue
		}
		items := d.Project.Items
		if items == nil || items.Nodes == nil || items.PageInfo == nil || items.PageInfo.HasNext == nil || len(*items.Nodes) > 100 {
			return nil, errQueue
		}
		for _, item := range *items.Nodes {
			if item == nil || item.ID == "" {
				return nil, errQueue
			}
			if item.Type == "DRAFT_ISSUE" || item.Type == "PULL_REQUEST" {
				continue
			}
			if item.Type != "ISSUE" || item.Content == nil || item.Content.Type != "Issue" || item.Content.ID == "" || item.Content.Repository.Name == "" {
				return nil, errQueue
			}
			issue := item.Content
			if !strings.EqualFold(issue.Repository.Name, source.Repository) {
				continue
			}
			if issue.State == "CLOSED" {
				continue
			}
			if issue.State != "OPEN" || item.Status == nil || item.Status.Field.ID != source.Fields.Status.ID {
				return nil, errQueue
			}
			index, ok := options[item.Status.OptionID]
			if !ok {
				return nil, errQueue
			}
			if old, ok := seen[issue.ID]; ok {
				if old != item.Status.OptionID {
					return nil, errQueue
				}
				continue
			}
			seen[issue.ID] = item.Status.OptionID
			if index >= 7 {
				continue
			}
			counts.Statuses[queueKeys[index]]++
			counts.Open++
			switch queueGroups[index] {
			case "queued":
				counts.Queued++
			case "active":
				counts.Active++
			case "waiting":
				counts.Waiting++
			case "blocked":
				counts.Blocked++
			}
		}
		if !*items.PageInfo.HasNext {
			return counts, nil
		}
		if len(*items.Nodes) == 0 || items.PageInfo.Cursor == nil || *items.PageInfo.Cursor == "" || cursors[*items.PageInfo.Cursor] {
			return nil, errQueue
		}
		cursor = *items.PageInfo.Cursor
		cursors[cursor] = true
	}
	return nil, errQueue
}

func queueFreshness(snapshot *queueSnapshot, now time.Time) {
	if snapshot.LastSuccessAt == nil {
		snapshot.Stale = false
		return
	}
	at := timestamp(*snapshot.LastSuccessAt)
	snapshot.Stale = at.IsZero() || at.After(now) || now.Sub(at) >= queueMaxAge*time.Second
}

func (s sampler) agentQueue(ctx context.Context, cfg *AgentQueueConfig, previous any, now time.Time) (*queueSnapshot, *queueCache) {
	if cfg == nil {
		return nil, nil
	}
	cache := &queueCache{}
	if body, err := json.Marshal(previous); err == nil {
		_ = json.Unmarshal(body, cache)
	}
	source, fingerprint, err := readQueueSource(cfg.GitHubConfigFile)
	if cache.ConfigFile != cfg.GitHubConfigFile || (fingerprint != "" && fingerprint != cache.Fingerprint) {
		cache = &queueCache{ConfigFile: cfg.GitHubConfigFile, Fingerprint: fingerprint}
	}
	snapshot := &cache.Snapshot
	if err == nil {
		snapshot.SourceURL = source.ProjectURL
		at := timestamp(snapshot.LastAttemptAt)
		if !at.IsZero() && !at.After(now) && now.Sub(at) < queueInterval*time.Second {
			queueFreshness(snapshot, now)
			return snapshot, cache
		}
	}
	snapshot.LastAttemptAt = iso(now)
	snapshot.Status = "error"
	snapshot.Error = "Queue source incomplete or unavailable; last complete result retained."
	if snapshot.Counts == nil {
		snapshot.Status = "unavailable"
		snapshot.Error = "Queue source incomplete or unavailable; no complete result yet."
	}
	if err == nil {
		if counts, fetchErr := s.fetchQueue(ctx, source); fetchErr == nil {
			at := iso(now)
			snapshot.Counts = counts
			snapshot.LastSuccessAt = &at
			snapshot.Error = ""
			snapshot.Status = "ok"
		}
	}
	queueFreshness(snapshot, now)
	return snapshot, cache
}

// Keep error strings generic; do not include configuration, command output,
// private titles or remote error messages in the snapshot.
