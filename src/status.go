package main

import (
	"fmt"
	"net/http"
	"status/auth"
	"status/config"
	"status/mods"
)

func HandleWithAuth[T any](path string, f func() (T, error)) {
	http.HandleFunc(path, auth.Wrapper(f))
}

func main() {
	listenAddress := config.GetListenAddress()
	fmt.Printf("http://%s/\n", listenAddress)

	http.HandleFunc("/api/auth", auth.Handler)
	HandleWithAuth("/api/ok", func() (string, error) { return "ok", nil })
	HandleWithAuth("/api/system", mods.System)
	HandleWithAuth("/api/memory", mods.Memory)
	HandleWithAuth("/api/load-average", mods.LoadAvg)
	HandleWithAuth("/api/file-system", mods.FileSystem)
	HandleWithAuth("/api/net", mods.Net)
	HandleWithAuth("/api/vhosts", mods.VHosts)
	HandleWithAuth("/api/services", mods.Services)

	http.ListenAndServe(listenAddress, nil)
}
