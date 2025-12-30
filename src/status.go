package main

import (
	"encoding/json"
	"fmt"
	"net/http"
)

func toJSON(s any) string {
	if b, err := json.Marshal(s); err != nil {
		return "{\"error\":\"failed to marshal json\"}"
	} else {
		return string(b)
	}
}

type Response struct {
	Data   any      `json:"data,omitempty"`
	Errors []string `json:"errors,omitempty"`
}

func wrapper(f func() any) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if auth == "" {
			w.WriteHeader(http.StatusUnauthorized)
			response := Response{
				Errors: []string{"Not authenticated"},
			}
			fmt.Fprintf(w, "%s", toJSON(response))
			return
		}
		token := auth[len("Bearer "):]

		if err := validateToken(token); err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			response := Response{
				Errors: []string{"Not authenticated"},
			}
			fmt.Fprintf(w, "%s", toJSON(response))
			return
		}

		response := Response{
			Data:   f(),
			Errors: []string{},
		}

		fmt.Fprintf(w, "%s", toJSON(response))
	}
}

func main() {
	listenAddress, _ := getListenAddress()
	fmt.Printf("http://%s/\n", listenAddress)

	http.HandleFunc("/api/auth", auth)
	http.HandleFunc("/api/ok", wrapper(func() any { return "ok" }))
	http.HandleFunc("/api/system", wrapper(func() any { return system() }))
	http.HandleFunc("/api/memory", wrapper(func() any { return memory() }))
	http.HandleFunc("/api/load-average", wrapper(func() any { return loadAvg() }))
	http.HandleFunc("/api/file-system", wrapper(func() any { return fileSystem() }))
	http.ListenAndServe(listenAddress, nil)
}
