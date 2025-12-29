package main

import (
	"encoding/json"
	"fmt"
	"net/http"
)

func toJSON(s SystemInfo) string {
	if b, err := json.Marshal(s); err != nil {
		return "{}"
	} else {
		return string(b)
	}
}

func wrapper(f func() SystemInfo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "%s", toJSON(f()))
	}
}

func main() {
	fmt.Println("http://localhost:8090/system")

	http.HandleFunc("/system", wrapper(system))
	http.ListenAndServe(":8090", nil)
}
