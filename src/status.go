package main

import (
	"fmt"
	"net/http"
	"status/auth"
	"status/config"
	"status/mods"
)

func main() {
	listenAddress := config.GetListenAddress()
	fmt.Printf("http://%s/\n", listenAddress)

	http.HandleFunc("/api/auth", auth.Handler)
	http.HandleFunc("/api/ok", auth.Wrapper(func() any { return "ok" }))
	http.HandleFunc("/api/system", auth.Wrapper(func() any { return mods.System() }))
	http.HandleFunc("/api/memory", auth.Wrapper(func() any { return mods.Memory() }))
	http.HandleFunc("/api/load-average", auth.Wrapper(func() any { return mods.LoadAvg() }))
	http.HandleFunc("/api/file-system", auth.Wrapper(func() any { return mods.FileSystem() }))
	http.ListenAndServe(listenAddress, nil)
}
