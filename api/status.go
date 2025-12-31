package main

import (
	"flag"
	"fmt"
	"net/http"
	"status/auth"
	"status/config"
	"status/mods"
)

func HandleWithAuth[T any](path string, f func() (T, error)) {
	http.HandleFunc(path, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		auth.Wrapper(f)(w, r)
	})
}

func main() {
	configPath := flag.String("config", "", "path to config file (default: config.jsonc or config.json)")
	flag.Parse()

	if err := config.Initialize(*configPath); err != nil {
		fmt.Printf("Failed to initialize config: %v\n", err)
		panic(err)
	}

	listenAddress := config.GetListenAddress()
	fmt.Printf("http://%s/\n", listenAddress)

	http.HandleFunc("/api/auth", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		auth.Handler(w, r)
	})
	HandleWithAuth("/api/ok", func() (string, error) { return "ok", nil })
	HandleWithAuth("/api/system", mods.System)
	HandleWithAuth("/api/memory", mods.Memory)
	HandleWithAuth("/api/load-average", mods.LoadAvg)
	HandleWithAuth("/api/file-system", mods.FileSystem)
	HandleWithAuth("/api/net", mods.Net)
	HandleWithAuth("/api/vhosts", mods.VHosts)
	HandleWithAuth("/api/services", mods.Services)

	if err := http.ListenAndServe(listenAddress, nil); err != nil {
		fmt.Printf("Server failed: %v\n", err)
		panic(err)
	}
}
