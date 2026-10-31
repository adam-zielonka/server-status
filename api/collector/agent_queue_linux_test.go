package collector

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

func testQueueSource(t *testing.T) (*queueSource, string) {
	t.Helper()
	source := &queueSource{Repository: "example/tasks", ProjectID: "PVT_example", ProjectURL: "https://github.com/users/example/projects/1"}
	source.Fields.Status.ID = "FIELD_example"
	source.Fields.Status.Options = map[string]string{}
	for i, name := range queueStatuses {
		source.Fields.Status.Options[name] = fmt.Sprintf("option%d", i)
	}
	path := filepath.Join(t.TempDir(), "github.json")
	body, _ := json.Marshal(source)
	if err := os.WriteFile(path, body, 0600); err != nil {
		t.Fatal(err)
	}
	return source, path
}
func testQueueItem(id string, index int) *queueItem {
	var item queueItem
	json.Unmarshal([]byte(fmt.Sprintf(`{"id":"item%s","type":"ISSUE","content":{"__typename":"Issue","id":%q,"state":"OPEN","repository":{"nameWithOwner":"example/tasks"}},"status":{"optionId":"option%d","field":{"id":"FIELD_example"}}}`, id, id, index)), &item)
	return &item
}
func testQueuePage(source *queueSource, items []*queueItem, next bool, cursor string) []byte {
	options := []row{}
	for _, name := range queueStatuses {
		options = append(options, row{"id": source.Fields.Status.Options[name], "name": name})
	}
	body, _ := json.Marshal(row{"data": row{"status": row{"id": source.Fields.Status.ID, "name": "Status", "project": row{"id": source.ProjectID}, "options": options}, "project": row{"id": source.ProjectID, "url": source.ProjectURL, "items": row{"nodes": items, "pageInfo": row{"hasNextPage": next, "endCursor": cursor}}}}})
	return body
}
func TestQueuePaginationCountsAndPrivacy(t *testing.T) {
	source, _ := testQueueSource(t)
	closed := testQueueItem("closed", 0)
	closed.Content.State = "CLOSED"
	foreign := testQueueItem("foreign", 0)
	foreign.Content.Repository.Name = "example/other"
	// Parent and child are separate IDs, each counted once even across pages.
	pages := [][]byte{testQueuePage(source, []*queueItem{testQueueItem("parent", 0), testQueueItem("child", 1), testQueueItem("analysis", 2), closed, foreign}, true, "cursor1"), testQueuePage(source, []*queueItem{testQueueItem("parent", 0), testQueueItem("work", 3), testQueueItem("review", 4), testQueueItem("wait", 5), testQueueItem("blocked", 6), testQueueItem("done", 7), testQueueItem("cancelled", 8), {ID: "draft", Type: "DRAFT_ISSUE"}}, false, "")}
	calls := 0
	sampler := sampler{query: func(ctx context.Context, args []string, timeout time.Duration, env map[string]string) ([]byte, error) {
		calls++
		command := strings.Join(args, " ")
		if calls == 2 && !strings.Contains(command, "after=cursor1") {
			t.Fatal("missing cursor")
		}
		for _, forbidden := range []string{"title", "body", "comments", "mutation", "tasks.py", "subIssues"} {
			if strings.Contains(command, forbidden) {
				t.Fatal("private or mutating query", forbidden)
			}
		}
		if timeout > 8*time.Second {
			t.Fatal("unbounded query")
		}
		if _, ok := ctx.Deadline(); !ok {
			t.Fatal("missing overall deadline")
		}
		return pages[calls-1], nil
	}}
	counts, err := sampler.fetchQueue(context.Background(), source)
	if err != nil || calls != 2 || counts.Open != 7 || counts.Queued != 2 || counts.Active != 3 || counts.Waiting != 1 || counts.Blocked != 1 {
		t.Fatalf("counts=%+v calls=%d err=%v", counts, calls, err)
	}
	for _, key := range queueKeys[:7] {
		if counts.Statuses[key] != 1 {
			t.Fatal("missing status", key)
		}
	}
}
func TestQueueRejectsIncompleteResults(t *testing.T) {
	source, _ := testQueueSource(t)
	valid := testQueuePage(source, []*queueItem{testQueueItem("one", 0)}, false, "")
	cases := map[string][]byte{"invalid JSON": []byte("oops"), "null": []byte("null"), "graphql error": []byte(`{"errors":[{"message":"private"}]}`), "unknown status": []byte(strings.ReplaceAll(string(valid), `"optionId":"option0"`, `"optionId":"unknown"`)), "wrong field": []byte(strings.ReplaceAll(string(valid), `"field":{"id":"FIELD_example"}`, `"field":{"id":"wrong"}`)), "changed option": []byte(strings.Replace(string(valid), `"name":"Nowe"`, `"name":"Changed"`, 1)), "missing nodes": []byte(strings.Replace(string(valid), `"nodes":`, `"missing":`, 1)), "null nodes": testQueuePage(source, nil, false, ""), "null item": testQueuePage(source, []*queueItem{nil}, false, ""), "redacted": testQueuePage(source, []*queueItem{{ID: "hidden", Type: "REDACTED"}}, false, ""), "no cursor": testQueuePage(source, []*queueItem{testQueueItem("one", 0)}, true, ""), "conflicting duplicate": testQueuePage(source, []*queueItem{testQueueItem("one", 0), testQueueItem("one", 1)}, false, "")}
	missingStatus := testQueueItem("one", 0)
	missingStatus.Status = nil
	cases["missing status"] = testQueuePage(source, []*queueItem{missingStatus}, false, "")
	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			s := sampler{query: func(context.Context, []string, time.Duration, map[string]string) ([]byte, error) { return body, nil }}
			if counts, err := s.fetchQueue(context.Background(), source); err == nil || counts != nil {
				t.Fatal("accepted incomplete result")
			}
		})
	}
	for _, mode := range []string{"page limit", "cycle", "size limit", "deadline", "command error"} {
		t.Run(mode, func(t *testing.T) {
			calls := 0
			s := sampler{query: func(ctx context.Context, _ []string, _ time.Duration, _ map[string]string) ([]byte, error) {
				calls++
				switch mode {
				case "size limit":
					return make([]byte, 4*1024*1024+1), nil
				case "command error":
					return nil, errors.New("private diagnostic")
				default:
					cursor := fmt.Sprint(calls)
					if mode == "cycle" {
						cursor = "same"
					}
					return testQueuePage(source, []*queueItem{testQueueItem("one", 0)}, true, cursor), nil
				}
			}}
			ctx := context.Background()
			if mode == "deadline" {
				var cancel context.CancelFunc
				ctx, cancel = context.WithCancel(ctx)
				cancel()
			}
			if counts, err := s.fetchQueue(ctx, source); err == nil || counts != nil || calls > queueMaxPages {
				t.Fatal("limit ignored")
			}
		})
	}
}
func TestQueueCacheFreshnessFailureAndSourceChange(t *testing.T) {
	source, path := testQueueSource(t)
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	calls := 0
	fail := false
	s := sampler{query: func(context.Context, []string, time.Duration, map[string]string) ([]byte, error) {
		calls++
		if fail {
			return nil, errors.New("PRIVATE TOKEN /path")
		}
		return testQueuePage(source, []*queueItem{testQueueItem("one", 3)}, false, ""), nil
	}}
	cfg := &AgentQueueConfig{GitHubConfigFile: path}
	snap, cache := s.agentQueue(context.Background(), cfg, nil, now)
	if snap.Counts.Open != 1 || snap.Status != "ok" || snap.Stale {
		t.Fatal("initial success", snap)
	}
	// Simulate the on-disk JSON roundtrip, never requiring prior snapshot metadata.
	roundtrip := func(v any) any {
		body, _ := json.Marshal(v)
		var result any
		json.Unmarshal(body, &result)
		return result
	}
	snap, cache = s.agentQueue(context.Background(), cfg, roundtrip(cache), now.Add(299*time.Second))
	if calls != 1 {
		t.Fatal("did not cache")
	}
	fail = true
	snap, cache = s.agentQueue(context.Background(), cfg, roundtrip(cache), now.Add(300*time.Second))
	if calls != 2 || snap.Status != "error" || snap.Counts.Open != 1 || snap.Stale || *snap.LastSuccessAt != iso(now) {
		t.Fatal("lost last complete result", snap)
	}
	snap, cache = s.agentQueue(context.Background(), cfg, roundtrip(cache), now.Add(900*time.Second))
	if !snap.Stale || snap.Counts.Open != 1 {
		t.Fatal("stale not independent", snap)
	}
	body, _ := json.Marshal(snap)
	if strings.Contains(string(body), "PRIVATE") || strings.Contains(string(body), path) || strings.Contains(string(body), "fingerprint") {
		t.Fatal("private data in snapshot")
	}
	source.Repository = "example/new"
	body, _ = json.Marshal(source)
	os.WriteFile(path, body, 0600)
	snap, _ = s.agentQueue(context.Background(), cfg, roundtrip(cache), now.Add(901*time.Second))
	if snap.Counts != nil || snap.LastSuccessAt != nil || snap.Status != "unavailable" {
		t.Fatal("source change reused cache", snap)
	}
	snap, _ = s.agentQueue(context.Background(), cfg, nil, now)
	if snap.Counts != nil {
		t.Fatal("first failure was zero")
	}
	fail = false
	s.query = func(context.Context, []string, time.Duration, map[string]string) ([]byte, error) {
		return testQueuePage(source, []*queueItem{}, false, ""), nil
	}
	snap, _ = s.agentQueue(context.Background(), cfg, nil, now)
	if snap.Counts == nil || snap.Counts.Open != 0 || snap.Status != "ok" {
		t.Fatal("empty board not zero", snap)
	}
	if snap, cache := s.agentQueue(context.Background(), nil, nil, now); snap != nil || cache != nil {
		t.Fatal("not optional")
	}
}
func TestQueueConfigurationAndLinks(t *testing.T) {
	_, path := testQueueSource(t)
	source, fingerprint, err := readQueueSource(path)
	if err != nil || fingerprint == "" {
		t.Fatal(err)
	}
	for _, url := range []string{"http://github.com/users/example/projects/1", "https://evil.test/users/example/projects/1", "https://token@github.com/users/example/projects/1", "https://github.com/users/example/projects/1?token=private", "https://github.com/users/example/projects/1#secret", "https://github.com/example/private", "https://github.com:443/users/example/projects/1"} {
		if safeQueueURL(url) {
			t.Fatal("unsafe URL accepted", url)
		}
	}
	for _, change := range []func(*queueSource){func(s *queueSource) { s.Fields.Status.Options["Nowe"] = "" }, func(s *queueSource) { s.Fields.Status.Options["Nowe"] = s.Fields.Status.Options["Gotowe"] }, func(s *queueSource) { s.ProjectID = "--help"; s.ProjectURL = "invalid" }} {
		copy := *source
		copy.Fields.Status.Options = map[string]string{}
		for k, v := range source.Fields.Status.Options {
			copy.Fields.Status.Options[k] = v
		}
		change(&copy)
		body, _ := json.Marshal(copy)
		os.WriteFile(path, body, 0600)
		if _, _, err := readQueueSource(path); err == nil {
			t.Fatal("accepted invalid source")
		}
	}
	// Existing state persistence retains history/peak and keeps cache out of snapshot.
	cfg := &Config{StateFile: filepath.Join(t.TempDir(), "state"), SnapshotFile: filepath.Join(t.TempDir(), "snapshot")}
	history := []row{{"at": "2026-01-01T12:00:00Z", "cpu_percent": 23.0}}
	peak := row{"peak_cores": 1.5}
	cache := &queueCache{Fingerprint: "private"}
	if err := persistCollection(cfg, history, peak, row{"enabled": true}, cache); err != nil {
		t.Fatal(err)
	}
	state := readObject(cfg.StateFile)
	if !reflect.DeepEqual(rows(state["history"]), history) || state["agent_queue"] == nil {
		t.Fatal("history/cache lost")
	}
	if readObject(cfg.SnapshotFile)["agent_queue"] != nil {
		t.Fatal("private cache copied")
	}
}

func TestQueueFailureAfterFirstPageNeverPublishesPartialCounts(t *testing.T) {
	source, path := testQueueSource(t)
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	calls := 0
	fail := false
	s := sampler{query: func(context.Context, []string, time.Duration, map[string]string) ([]byte, error) {
		calls++
		if !fail {
			return testQueuePage(source, []*queueItem{testQueueItem("original", 3)}, false, ""), nil
		}
		if calls == 2 {
			return testQueuePage(source, []*queueItem{testQueueItem("new", 0), testQueueItem("another", 0)}, true, "next"), nil
		}
		return nil, errQuery
	}}
	cfg := &AgentQueueConfig{GitHubConfigFile: path}
	_, cache := s.agentQueue(context.Background(), cfg, nil, now)
	fail = true
	snapshot, _ := s.agentQueue(context.Background(), cfg, cache, now.Add(300*time.Second))
	if calls != 3 || snapshot.Status != "error" || snapshot.Counts.Open != 1 || snapshot.Counts.Active != 1 || snapshot.Counts.Queued != 0 || *snapshot.LastSuccessAt != iso(now) {
		t.Fatal("published partial page on failure", snapshot)
	}
}

func TestQueueOversizedChangedSourceInvalidatesCache(t *testing.T) {
	source, path := testQueueSource(t)
	s := sampler{query: func(context.Context, []string, time.Duration, map[string]string) ([]byte, error) {
		return testQueuePage(source, []*queueItem{testQueueItem("one", 0)}, false, ""), nil
	}}
	cfg := &AgentQueueConfig{GitHubConfigFile: path}
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	_, cache := s.agentQueue(context.Background(), cfg, nil, now)
	if err := os.WriteFile(path, []byte(strings.Repeat(" ", 65537)), 0600); err != nil {
		t.Fatal(err)
	}
	snapshot, _ := s.agentQueue(context.Background(), cfg, cache, now.Add(time.Second))
	if snapshot.Counts != nil || snapshot.LastSuccessAt != nil || snapshot.Status != "unavailable" {
		t.Fatal("oversized changed source reused previous result")
	}
}
