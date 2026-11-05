package auth

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"status/config"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
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

func initializeAuth(t *testing.T, settings config.ServerAuth) config.ServerAuth {
	t.Helper()
	body, err := json.Marshal(config.ServerConfig{Listen: config.Listen{Host: "127.0.0.1", Port: 4000}, Auth: settings})
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "auth.json")
	if err := os.WriteFile(path, body, 0600); err != nil {
		t.Fatal(err)
	}
	if err := config.Initialize(path); err != nil {
		t.Fatal(err)
	}
	return config.GetAuthSettings()
}

func testAuthSettings() config.ServerAuth {
	return config.ServerAuth{
		Secret: "synthetic-secret",
		Users:  []config.ServerUser{{Name: "example", Pass: " pass:with:colons "}, {Name: "other", Pass: " pass:with:colons "}},
	}
}

func resetLimiter(t *testing.T) {
	t.Helper()
	previous := limiter
	limiter = &RateLimiter{attempts: make(map[string]*rateLimitEntry), maxAttempts: 5, window: time.Minute}
	t.Cleanup(func() { limiter = previous })
}

func login(t *testing.T, name, pass string) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest(http.MethodGet, "/api/auth", nil)
	r.SetBasicAuth(name, pass)
	w := httptest.NewRecorder()
	Handler(w, r)
	return w
}

func TestLoginIssuesBoundedSession(t *testing.T) {
	settings := initializeAuth(t, testAuthSettings())
	resetLimiter(t)
	var logs bytes.Buffer
	previous := log.Writer()
	log.SetOutput(&logs)
	t.Cleanup(func() { log.SetOutput(previous) })

	w := login(t, "example", " pass:with:colons ")
	if w.Code != http.StatusOK {
		t.Fatalf("login status %d", w.Code)
	}
	if w.Header().Get("Cache-Control") != "no-store" || w.Header().Get("Content-Type") != "application/json" {
		t.Fatal("login must return uncacheable JSON")
	}
	var envelope struct {
		Data   Auth     `json:"data"`
		Errors []string `json:"errors"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope.Data.Token == "" || len(envelope.Errors) != 0 {
		t.Fatal("login response envelope changed")
	}
	if err := ValidateToken(envelope.Data.Token); err != nil {
		t.Fatal("issued session was rejected")
	}
	claims := &sessionClaims{}
	if _, _, err := jwt.NewParser().ParseUnverified(envelope.Data.Token, claims); err != nil {
		t.Fatal(err)
	}
	if claims.Name != "example" || claims.Subject != "example" || claims.Issuer != sessionIssuer || len(claims.Audience) != 1 || claims.Audience[0] != sessionAudience || claims.TokenUse != sessionUse {
		t.Fatal("issued session has incorrect identity or scope")
	}
	if claims.IssuedAt == nil || claims.ExpiresAt == nil || claims.ExpiresAt.Sub(claims.IssuedAt.Time) != time.Duration(settings.SessionTTLSeconds)*time.Second {
		t.Fatal("session lifetime differs from configuration")
	}
	// The original password, including surrounding spaces and colons, is exact.
	for _, credentials := range [][2]string{{"", ""}, {"example", ""}, {"example", "pass:with:colons"}, {"missing", " pass:with:colons "}} {
		if response := login(t, credentials[0], credentials[1]); response.Code != http.StatusUnauthorized {
			t.Fatalf("invalid credentials status %d", response.Code)
		}
	}
	if response := login(t, "example", " pass:with:colons "); response.Code != http.StatusTooManyRequests {
		t.Fatal("rate limit must apply after five attempts, including successful logins")
	}
	if logs.Len() != 0 {
		t.Fatal("authentication must not log tokens or credentials")
	}
}

func TestSessionExpiryAndConfiguredLifetime(t *testing.T) {
	for _, ttl := range []int{config.MinSessionTTLSeconds, config.DefaultSessionTTLSeconds, config.MaxSessionTTLSeconds} {
		t.Run(strconv.Itoa(ttl), func(t *testing.T) {
			settings := testAuthSettings()
			settings.SessionTTLSeconds = ttl
			settings = initializeAuth(t, settings)
			now := time.Date(2026, 11, 5, 12, 0, 0, 0, time.UTC)
			token, err := issueSession(settings, "example", now)
			if err != nil {
				t.Fatal(err)
			}
			for _, offset := range []time.Duration{0, time.Duration(ttl)*time.Second - time.Second} {
				if err := validateTokenAt(token, func() time.Time { return now.Add(offset) }); err != nil {
					t.Fatal("session rejected before expiration")
				}
			}
			for _, offset := range []time.Duration{time.Duration(ttl) * time.Second, time.Duration(ttl)*time.Second + time.Second, -time.Second} {
				if err := validateTokenAt(token, func() time.Time { return now.Add(offset) }); err == nil {
					t.Fatal("session accepted outside its validity interval")
				}
			}
		})
	}
}

func TestCredentialChangesRevokeSessions(t *testing.T) {
	for _, change := range []string{"password", "signing secret", "removed user", "renamed user", "unrelated user"} {
		t.Run(change, func(t *testing.T) {
			settings := initializeAuth(t, testAuthSettings())
			token, err := issueSession(settings, "example", time.Now())
			if err != nil {
				t.Fatal(err)
			}
			if err := ValidateToken(token); err != nil {
				t.Fatal(err)
			}
			switch change {
			case "password":
				settings.Users[0].Pass = "changed password"
			case "signing secret":
				settings.Secret = "changed secret"
			case "removed user":
				settings.Users = settings.Users[1:]
			case "renamed user":
				settings.Users[0].Name = "renamed"
			case "unrelated user":
				settings.Users[1].Pass = "changed other password"
			}
			settings = initializeAuth(t, settings)
			if err := ValidateToken(token); (err == nil) != (change == "unrelated user") {
				t.Fatalf("unexpected session validity after %s", change)
			}
			if change == "password" || change == "signing secret" {
				resetLimiter(t)
				w := login(t, settings.Users[0].Name, settings.Users[0].Pass)
				if w.Code != http.StatusOK {
					t.Fatal("changed credentials cannot sign in")
				}
				var envelope struct {
					Data Auth `json:"data"`
				}
				if err := json.Unmarshal(w.Body.Bytes(), &envelope); err != nil || ValidateToken(envelope.Data.Token) != nil {
					t.Fatal("new credentials must issue a valid session")
				}
			}
		})
	}
}

func TestStatelessSessionRestorationAndLifetimePolicy(t *testing.T) {
	settings := initializeAuth(t, testAuthSettings())
	now := time.Now().Truncate(time.Second)
	token, err := issueSession(settings, "example", now)
	if err != nil {
		t.Fatal(err)
	}
	settings.SessionTTLSeconds = config.MinSessionTTLSeconds
	initializeAuth(t, settings)
	later := func() time.Time { return now.Add(time.Hour) }
	if validateTokenAt(token, later) != nil {
		t.Fatal("TTL changes apply to newly issued sessions")
	}
	settings.Users[0].Pass = "changed"
	initializeAuth(t, settings)
	if validateTokenAt(token, later) == nil {
		t.Fatal("password change must invalidate the token")
	}
	initializeAuth(t, testAuthSettings())
	if validateTokenAt(token, later) != nil {
		t.Fatal("restoring credentials restores the stateless key")
	}
	if validateTokenAt(token, func() time.Time { return now.Add(13 * time.Hour) }) == nil {
		t.Fatal("restoration must not bypass expiration")
	}
}

func TestSessionRejectsInvalidClaimsAndAlgorithms(t *testing.T) {
	settings := initializeAuth(t, testAuthSettings())
	key, err := sessionSigningKey(settings, "example")
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().Truncate(time.Second)
	validClaims := func() jwt.MapClaims {
		return jwt.MapClaims{
			"name": "example", "sub": "example", "token_use": sessionUse,
			"iss": sessionIssuer, "aud": sessionAudience,
			"iat": now.Unix(), "exp": now.Add(time.Hour).Unix(),
		}
	}
	for _, tc := range []struct {
		name   string
		alter  func(jwt.MapClaims)
		method jwt.SigningMethod
		key    any
	}{
		{"valid", nil, jwt.SigningMethodHS256, key},
		{"missing expiration", func(c jwt.MapClaims) { delete(c, "exp") }, jwt.SigningMethodHS256, key},
		{"null expiration", func(c jwt.MapClaims) { c["exp"] = nil }, jwt.SigningMethodHS256, key},
		{"bad expiration type", func(c jwt.MapClaims) { c["exp"] = map[string]any{"sensitive-sentinel": true} }, jwt.SigningMethodHS256, key},
		{"expired", func(c jwt.MapClaims) { c["exp"] = now.Add(-time.Second).Unix() }, jwt.SigningMethodHS256, key},
		{"excessive lifetime", func(c jwt.MapClaims) { c["exp"] = now.Add((config.MaxSessionTTLSeconds + 1) * time.Second).Unix() }, jwt.SigningMethodHS256, key},
		{"zero lifetime", func(c jwt.MapClaims) { c["iat"] = c["exp"] }, jwt.SigningMethodHS256, key},
		{"missing issued at", func(c jwt.MapClaims) { delete(c, "iat") }, jwt.SigningMethodHS256, key},
		{"future issued at", func(c jwt.MapClaims) { c["iat"] = now.Add(time.Minute).Unix() }, jwt.SigningMethodHS256, key},
		{"future not before", func(c jwt.MapClaims) { c["nbf"] = now.Add(time.Minute).Unix() }, jwt.SigningMethodHS256, key},
		{"missing issuer", func(c jwt.MapClaims) { delete(c, "iss") }, jwt.SigningMethodHS256, key},
		{"wrong issuer", func(c jwt.MapClaims) { c["iss"] = "sensitive-sentinel" }, jwt.SigningMethodHS256, key},
		{"missing audience", func(c jwt.MapClaims) { delete(c, "aud") }, jwt.SigningMethodHS256, key},
		{"wrong audience", func(c jwt.MapClaims) { c["aud"] = "another-api" }, jwt.SigningMethodHS256, key},
		{"missing subject", func(c jwt.MapClaims) { delete(c, "sub") }, jwt.SigningMethodHS256, key},
		{"wrong subject", func(c jwt.MapClaims) { c["sub"] = "other" }, jwt.SigningMethodHS256, key},
		{"wrong subject type", func(c jwt.MapClaims) { c["sub"] = 123 }, jwt.SigningMethodHS256, key},
		{"missing name", func(c jwt.MapClaims) { delete(c, "name") }, jwt.SigningMethodHS256, key},
		{"empty name", func(c jwt.MapClaims) { c["name"] = ""; c["sub"] = "" }, jwt.SigningMethodHS256, key},
		{"wrong name type", func(c jwt.MapClaims) { c["name"] = []string{"example"} }, jwt.SigningMethodHS256, key},
		{"unknown user", func(c jwt.MapClaims) { c["name"] = "missing"; c["sub"] = "missing" }, jwt.SigningMethodHS256, key},
		{"other user same password", func(c jwt.MapClaims) { c["name"] = "other"; c["sub"] = "other" }, jwt.SigningMethodHS256, key},
		{"missing token use", func(c jwt.MapClaims) { delete(c, "token_use") }, jwt.SigningMethodHS256, key},
		{"wrong token use", func(c jwt.MapClaims) { c["token_use"] = "refresh" }, jwt.SigningMethodHS256, key},
		{"legacy global signing key", nil, jwt.SigningMethodHS256, []byte(settings.Secret)},
		{"wrong signing key", nil, jwt.SigningMethodHS256, []byte("another-key")},
		{"HS384", nil, jwt.SigningMethodHS384, key},
		{"HS512", nil, jwt.SigningMethodHS512, key},
		{"unsigned", nil, jwt.SigningMethodNone, jwt.UnsafeAllowNoneSignatureType},
	} {
		t.Run(tc.name, func(t *testing.T) {
			claims := validClaims()
			if tc.alter != nil {
				tc.alter(claims)
			}
			token, err := jwt.NewWithClaims(tc.method, claims).SignedString(tc.key)
			if err != nil {
				t.Fatal(err)
			}
			err = ValidateToken(token)
			if (err == nil) != (tc.name == "valid") {
				t.Fatal("unexpected token validity")
			}
			if err != nil && strings.Contains(err.Error(), "sensitive-sentinel") {
				t.Fatal("claim contents leaked")
			}
		})
	}
	legacy, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"name": "example"}).SignedString([]byte(settings.Secret))
	if err != nil {
		t.Fatal(err)
	}
	if ValidateToken(legacy) == nil {
		t.Fatal("legacy name-only session accepted")
	}
}

func TestSessionTamperingCannotInvokeProtectedHandler(t *testing.T) {
	settings := initializeAuth(t, testAuthSettings())
	token, err := issueSession(settings, "example", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	parts := strings.Split(token, ".")
	var claims map[string]any
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		t.Fatal(err)
	}
	claims["name"], claims["sub"] = "other", "other"
	payload, err = json.Marshal(claims)
	if err != nil {
		t.Fatal(err)
	}
	parts[1] = base64.RawURLEncoding.EncodeToString(payload)
	called := false
	handler := Wrapper(func() (string, error) { called = true; return "protected", nil })
	for _, candidate := range []string{strings.Join(parts, "."), token + "tampered", "malformed", ""} {
		r := httptest.NewRequest(http.MethodGet, "/api/ok", nil)
		r.Header.Set("Authorization", "Bearer "+candidate)
		w := httptest.NewRecorder()
		handler(w, r)
		if w.Code != http.StatusUnauthorized || called || strings.Contains(w.Body.String(), "protected") {
			t.Fatal("tampered session gained access")
		}
		if strings.Contains(w.Body.String(), candidate) && candidate != "" {
			t.Fatal("token leaked in error response")
		}
	}
}

func TestSessionKeyEncodingIsUnambiguous(t *testing.T) {
	settings := testAuthSettings()
	settings.Users = []config.ServerUser{{Name: "a", Pass: "bc"}, {Name: "ab", Pass: "c"}}
	first, err := sessionSigningKey(settings, "a")
	if err != nil {
		t.Fatal(err)
	}
	second, err := sessionSigningKey(settings, "ab")
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Equal(first, second) {
		t.Fatal("user/password boundaries share a signing key")
	}
}

func TestRateLimiterWindowAndCleanup(t *testing.T) {
	rl := &RateLimiter{attempts: make(map[string]*rateLimitEntry), maxAttempts: 1, window: time.Minute}
	if !rl.Allow("peer") || rl.Allow("peer") || !rl.Allow("other") {
		t.Fatal("incorrect per-peer limit")
	}
	rl.attempts["peer"].resetTime = time.Now().Add(-time.Second)
	if !rl.Allow("peer") {
		t.Fatal("expired window did not reset")
	}
	rl.attempts["peer"].resetTime = time.Now().Add(-time.Second)
	rl.Cleanup()
	if _, exists := rl.attempts["peer"]; exists {
		t.Fatal("expired bucket was not removed")
	}
	if _, exists := rl.attempts["other"]; !exists {
		t.Fatal("active bucket was removed")
	}
}
