package collector

import (
	"context"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var aptPackageName = regexp.MustCompile(`^[a-z0-9][a-z0-9+.-]+(?::[a-z0-9-]+)?$`)

// Match the candidate's index to its Release metadata, including on mirrors.
// Never publish arbitrary repository URLs: they may contain private endpoints.
func aptIndexSources(policy string) map[string]string {
	sources := map[string]string{}
	key := ""
	for _, line := range strings.Split(policy, "\n") {
		fields := strings.Fields(line)
		if len(fields) == 5 && fields[4] == "Packages" {
			key = strings.Join(fields[1:], " ")
			continue
		}
		if len(fields) < 2 || fields[0] != "release" {
			continue
		}
		if key == "" {
			continue
		}
		release := map[string]string{}
		for _, field := range strings.Split(strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(line), "release")), ",") {
			k, v, ok := strings.Cut(field, "=")
			if ok {
				release[k] = v
			}
		}
		switch release["o"] {
		case "Ubuntu":
			sources[key] = "https://packages.ubuntu.com/search?searchon=names&exact=1&suite=all&section=all&keywords="
		case "Debian", "Debian Backports":
			sources[key] = "https://packages.debian.org/search?searchon=names&exact=1&suite=all&section=all&keywords="
		}
		// Known vendor repositories get a fixed public landing page, not a copied URI.
		origin, err := url.Parse(strings.Fields(key)[0])
		if err == nil && origin.User == nil && origin.Port() == "" && (origin.Scheme == "http" || origin.Scheme == "https") {
			switch origin.Hostname() {
			case "pkgs.tailscale.com":
				sources[key] = "https://pkgs.tailscale.com/"
			case "pkg.cloudflare.com":
				sources[key] = "https://pkg.cloudflare.com/"
			}
		}
		key = ""
	}
	return sources
}

func aptPackageSources(policy string, indexes map[string]string, versions map[string]string) map[string]string {
	candidates := map[string]map[string]bool{}
	name, selected := "", false
	for _, line := range strings.Split(policy, "\n") {
		if line != "" && line[0] != ' ' && strings.HasSuffix(line, ":") {
			name = strings.TrimSuffix(line, ":")
			selected = false
			continue
		}
		fields := strings.Fields(line)
		if len(fields) > 0 && fields[0] == "***" {
			fields = fields[1:]
		}
		if len(fields) == 2 {
			if _, err := strconv.Atoi(fields[1]); err == nil {
				selected = versions[name] != "" && fields[0] == versions[name]
				continue
			}
		}
		if !selected || len(fields) < 3 || fields[len(fields)-1] != "Packages" {
			continue
		}
		source := indexes[strings.Join(fields[1:], " ")]
		if strings.HasSuffix(source, "keywords=") {
			pkg, _, _ := strings.Cut(name, ":")
			source += url.QueryEscape(pkg)
		}
		if candidates[name] == nil {
			candidates[name] = map[string]bool{}
		}
		candidates[name][source] = true
	}
	result := map[string]string{}
	for name, sources := range candidates {
		// An unknown or conflicting origin makes provenance ambiguous.
		if len(sources) == 1 {
			for source := range sources {
				if source != "" {
					result[name] = source
				}
			}
		}
	}
	return result
}

func (s sampler) linkAPTSources(ctx context.Context, tools []row, cfg []SoftwareTool, updates []row) {
	entries := map[string][]row{}
	versions := map[string]string{}
	for i, tool := range cfg {
		if tool.Kind == "apt" {
			entries[tool.Package] = append(entries[tool.Package], tools[i])
			versions[tool.Package] = text(tools[i]["available_version"])
		}
	}
	for _, update := range updates {
		name := text(update["name"])
		entries[name] = append(entries[name], update)
		versions[name] = text(update["available_version"])
	}
	args := []string{"/usr/bin/apt-cache", "policy"}
	for name, version := range versions {
		if version != "" && aptPackageName.MatchString(name) {
			args = append(args, name)
		}
	}
	if len(args) == 2 {
		return
	}
	env := map[string]string{"LC_ALL": "C"}
	indexes, err := s.query(ctx, []string{"/usr/bin/apt-cache", "policy"}, 5*time.Second, env)
	if err != nil {
		return
	}
	policy, err := s.query(ctx, args, 10*time.Second, env)
	if err != nil {
		return
	}
	for name, source := range aptPackageSources(string(policy), aptIndexSources(string(indexes)), versions) {
		for _, entry := range entries[name] {
			entry["source_url"] = source
		}
	}
}
