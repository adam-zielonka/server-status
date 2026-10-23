package main

import (
	"net/http"
	"status/auth"
	"status/mods"
	"status/web"
)

func GetOnly(handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.Header().Set("Allow", http.MethodGet)
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		handler(w, r)
	}
}

func handleWithAuth[T any](mux *http.ServeMux, path string, f func() (T, error)) {
	mux.HandleFunc(path, GetOnly(auth.Wrapper(f)))
}

func newHandler(apiOnly bool) (http.Handler, error) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/auth", GetOnly(auth.Handler))
	handleWithAuth(mux, "/api/ok", func() (string, error) { return "ok", nil })
	handleWithAuth(mux, "/api/system", mods.System)
	handleWithAuth(mux, "/api/memory", mods.Memory)
	handleWithAuth(mux, "/api/load-average", mods.LoadAvg)
	handleWithAuth(mux, "/api/file-system", mods.FileSystem)
	handleWithAuth(mux, "/api/net", mods.Net)
	mux.HandleFunc("/api/vhosts", GetOnly(auth.WrapperContext(mods.VHosts)))
	mux.HandleFunc("/api/services", GetOnly(auth.WrapperContext(mods.Services)))
	handleWithAuth(mux, "/api/telemetry", mods.Telemetry)
	// Unknown API paths must never return the dashboard HTML.
	mux.HandleFunc("/api", http.NotFound)
	mux.HandleFunc("/api/", http.NotFound)
	if !apiOnly {
		frontend, err := web.Handler()
		if err != nil {
			return nil, err
		}
		mux.Handle("/", frontend)
	}
	return mux, nil
}
