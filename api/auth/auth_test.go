package auth

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"
)

func TestAuthenticationLimitIgnoresSourcePortsAndUntrustedForwarding(t *testing.T) {
	previous := limiter
	limiter = &RateLimiter{attempts: make(map[string]*rateLimitEntry), maxAttempts: 5, window: time.Minute}
	t.Cleanup(func() { limiter = previous })
	for i := range 6 {
		request := httptest.NewRequest(http.MethodGet, "/api/auth", nil)
		request.RemoteAddr = "192.0.2.10:" + strconv.Itoa(1000+i)
		request.Header.Set("X-Forwarded-For", "198.51.100."+strconv.Itoa(i+1))
		response := httptest.NewRecorder()
		Handler(response, request)
		expected := http.StatusUnauthorized
		if i == 5 {
			expected = http.StatusTooManyRequests
		}
		if response.Code != expected {
			t.Fatalf("attempt %d: got %d, want %d", i+1, response.Code, expected)
		}
	}
	if len(limiter.attempts) != 1 {
		t.Fatal("one direct peer must use one bucket")
	}
}

func TestClientAddress(t *testing.T) {
	for _, test := range []struct{ remote, want string }{
		{"192.0.2.10:1234", "192.0.2.10"},
		{"[2001:db8::10]:1234", "2001:db8::10"},
		{"invalid", "invalid"},
	} {
		request := httptest.NewRequest(http.MethodGet, "/", nil)
		request.RemoteAddr = test.remote
		if got := clientAddress(request); got != test.want {
			t.Errorf("%q: got %q, want %q", test.remote, got, test.want)
		}
	}
}
