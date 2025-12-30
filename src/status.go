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
	http.HandleFunc("/api/ok", auth.Wrapper(func() string { return "ok" }))
	http.HandleFunc("/api/system", auth.Wrapper(mods.System))
	http.HandleFunc("/api/memory", auth.Wrapper(mods.Memory))
	http.HandleFunc("/api/load-average", auth.Wrapper(mods.LoadAvg))
	http.HandleFunc("/api/file-system", auth.Wrapper(mods.FileSystem))
	http.ListenAndServe(listenAddress, nil)
}
