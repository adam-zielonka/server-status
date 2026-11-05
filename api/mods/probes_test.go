package mods

import (
	"context"
	"net"
	"status/config"
	"testing"
)

func TestPortChecksAndCancellation(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	_, port, _ := net.SplitHostPort(listener.Addr().String())
	services := []config.Service{{Name: "Example", Port: port}, {Name: "Invalid", Port: "0"}}
	result, err := probeServices(context.Background(), services, []string{"127.0.0.1"})
	if err != nil {
		t.Fatal(err)
	}
	if !result[0].Hosts[0].Open || result[1].Hosts[0].Open {
		t.Fatalf("unexpected checks: %+v", result)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := probeServices(ctx, services, []string{"127.0.0.1"}); err == nil {
		t.Fatal("canceled checks must not return a successful report")
	}
}
