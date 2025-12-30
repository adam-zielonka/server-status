package main

import (
	"fmt"
	"net/http"
	"status/auth"
	"status/config"
	"status/mods"
)

func HandleWithAuth[T any](path string, f func() T) {
	http.HandleFunc(path, auth.Wrapper(f))
}

func main() {
	listenAddress := config.GetListenAddress()
	fmt.Printf("http://%s/\n", listenAddress)

	http.HandleFunc("/api/auth", auth.Handler)
	HandleWithAuth("/api/ok", func() string { return "ok" })
	HandleWithAuth("/api/system", mods.System)
	HandleWithAuth("/api/memory", mods.Memory)
	HandleWithAuth("/api/load-average", mods.LoadAvg)
	HandleWithAuth("/api/file-system", mods.FileSystem)

	http.ListenAndServe(listenAddress, nil)
}
