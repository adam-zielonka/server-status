package main

import (
	"encoding/json"
	"fmt"
	"net/http"
)

func toJSON(s any) string {
	if b, err := json.Marshal(s); err != nil {
		return "{}"
	} else {
		return string(b)
	}
}

func wrapper(f func() any) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "%s", toJSON(f()))
	}
}

func main() {
	fmt.Println("http://localhost:8090/system")

	http.HandleFunc("/system", wrapper(func() any { return system() }))
	http.HandleFunc("/memory", wrapper(func() any { return memory() }))
	http.ListenAndServe(":8090", nil)
}
