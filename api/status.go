package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"status/collector"
	"status/config"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// Set with go build -ldflags '-X main.version=...'.
var version = "dev"

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := run(ctx, os.Args[1:], os.Stdout, os.Stderr); err != nil {
		fmt.Fprintln(os.Stderr, "server-status:", err)
		os.Exit(1)
	}
}

const usage = `Usage: server-status <command> [options]

Commands:
  serve         Serve the embedded dashboard and authenticated API
  collect       Collect one Linux telemetry snapshot (no HTTP listener)
  config check  Validate API or collector configuration without starting work
  version       Print the application and Go versions
  help          Show this help

Run "server-status serve --help" or "server-status config check --help" for options.
Running without a command is equivalent to "serve" (legacy --config is supported).
The collector runs separately with its own permissions, using the same binary.
`

func run(ctx context.Context, args []string, stdout, stderr io.Writer) error {
	if len(args) == 0 || strings.HasPrefix(args[0], "-") && args[0] != "--help" && args[0] != "-h" {
		return serve(ctx, args, stdout, stderr)
	}
	switch args[0] {
	case "help", "--help", "-h":
		if len(args) != 1 {
			return fmt.Errorf("help does not accept arguments")
		}
		_, err := io.WriteString(stdout, usage)
		return err
	case "version":
		if len(args) != 1 {
			return fmt.Errorf("version does not accept arguments")
		}
		_, err := fmt.Fprintf(stdout, "server-status %s (%s, %s/%s)\n", version, runtime.Version(), runtime.GOOS, runtime.GOARCH)
		return err
	case "serve":
		return serve(ctx, args[1:], stdout, stderr)
	case "collect":
		flags := flag.NewFlagSet("collect", flag.ContinueOnError)
		flags.SetOutput(stderr)
		path := flags.String("config", "", "private collector configuration path (required)")
		if err := parseFlags(flags, args[1:]); err != nil {
			return helpResult(err)
		}
		settings, err := collector.Load(*path)
		if err != nil {
			return err
		}
		return collector.Run(ctx, settings)
	case "config":
		if len(args) < 2 || args[1] != "check" {
			return fmt.Errorf("usage: server-status config check [--config path]")
		}
		flags := flag.NewFlagSet("config check", flag.ContinueOnError)
		flags.SetOutput(stderr)
		path := flags.String("config", "", "configuration path (default: config.jsonc, then config.json in the working directory)")
		isCollector := flags.Bool("collector", false, "validate collector configuration instead of API configuration (requires --config)")
		if err := parseFlags(flags, args[2:]); err != nil {
			return helpResult(err)
		}
		if *isCollector {
			if _, err := collector.Load(*path); err != nil {
				return err
			}
		} else {
			if _, err := config.Load(*path); err != nil {
				return err
			}
		}
		_, err := fmt.Fprintln(stdout, "Configuration is valid.")
		return err
	default:
		return fmt.Errorf("unknown command %q; run server-status --help", args[0])
	}
}

func parseFlags(flags *flag.FlagSet, args []string) error {
	if err := flags.Parse(args); err != nil {
		return err
	}
	if flags.NArg() != 0 {
		return fmt.Errorf("unexpected arguments; run server-status %s --help", flags.Name())
	}
	return nil
}

func helpResult(err error) error {
	if errors.Is(err, flag.ErrHelp) {
		return nil
	}
	return err
}

func serve(ctx context.Context, args []string, stdout, stderr io.Writer) error {
	flags := flag.NewFlagSet("serve", flag.ContinueOnError)
	flags.SetOutput(stderr)
	path := flags.String("config", "", "configuration path (default: config.jsonc, then config.json in the working directory)")
	listen := flags.String("listen", "", "override listen address, e.g. 127.0.0.1:4000 or [::1]:4000")
	apiOnly := flags.Bool("api-only", false, "serve only /api endpoints (for frontend development or external static hosting)")
	if err := parseFlags(flags, args); err != nil {
		return helpResult(err)
	}
	if err := config.Initialize(*path); err != nil {
		return err
	}
	address := config.GetListenAddress()
	if *listen != "" {
		if err := validateListen(*listen); err != nil {
			return err
		}
		address = *listen
	}
	handler, err := newHandler(*apiOnly)
	if err != nil {
		return err
	}
	listener, err := net.Listen("tcp", address)
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	defer listener.Close()
	fmt.Fprintf(stdout, "http://%s/\n", listener.Addr())
	server := &http.Server{
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	served := make(chan error, 1)
	go func() {
		served <- server.Serve(listener)
	}()
	select {
	case err := <-served:
		return serveResult(err)
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			server.Close()
			return fmt.Errorf("HTTP shutdown: %w", err)
		}
		return serveResult(<-served)
	}
}

func serveResult(err error) error {
	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("serve: %w", err)
	}
	return nil
}

func validateListen(address string) error {
	_, port, err := net.SplitHostPort(address)
	if err != nil {
		return fmt.Errorf("listen must be host:port (use brackets around IPv6 addresses)")
	}
	number, err := strconv.Atoi(port)
	if err != nil || number < 1 || number > 65535 {
		return fmt.Errorf("listen port must be between 1 and 65535")
	}
	return nil
}
