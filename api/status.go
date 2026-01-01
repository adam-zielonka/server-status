package main

import (
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"status/auth"
	"status/config"
	"status/mods"
	"syscall"
	"time"
)

func GetOnly(handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		handler(w, r)
	}
}

// CORS middleware
func CORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Content-Type", "application/json")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

func HandleWithAuth[T any](path string, f func() (T, error)) {
	http.HandleFunc(path, CORS(GetOnly(auth.Wrapper(f))))
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

	// Public health check endpoint (no auth required)
	http.HandleFunc("/health", CORS(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"ok"}`)
	}))

	http.HandleFunc("/api/auth", CORS(GetOnly(auth.Handler)))
	HandleWithAuth("/api/ok", func() (string, error) { return "ok", nil })
	HandleWithAuth("/api/system", mods.System)
	HandleWithAuth("/api/memory", mods.Memory)
	HandleWithAuth("/api/load-average", mods.LoadAvg)
	HandleWithAuth("/api/file-system", mods.FileSystem)
	HandleWithAuth("/api/net", mods.Net)
	HandleWithAuth("/api/vhosts", mods.VHosts)
	HandleWithAuth("/api/services", mods.Services)

	// Create server with timeouts
	server := &http.Server{
		Addr:         listenAddress,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Channel to listen for shutdown signals
	done := make(chan bool, 1)
	quit := make(chan os.Signal, 1)

	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	// Start server in goroutine
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Printf("Server failed: %v\n", err)
			panic(err)
		}
	}()

	// Wait for interrupt signal
	<-quit
	fmt.Println("\nShutting down server...")

	// Gracefully shutdown with 30 second timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		fmt.Printf("Server forced to shutdown: %v\n", err)
		panic(err)
	}

	close(done)
	fmt.Println("Server stopped")
}
