package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"status/config"
	"status/utils"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	sessionIssuer   = "server-status"
	sessionAudience = "server-status-api"
	sessionUse      = "session"
)

// sessionClaims deliberately rejects the legacy, nonexpiring name-only token.
type sessionClaims struct {
	Name     string `json:"name"`
	TokenUse string `json:"token_use"`
	jwt.RegisteredClaims
}

type Auth struct {
	Token string `json:"token"`
}

// RateLimiter implements a simple token bucket rate limiter per IP
type RateLimiter struct {
	mu          sync.Mutex
	attempts    map[string]*rateLimitEntry
	maxAttempts int
	window      time.Duration
}

type rateLimitEntry struct {
	count     int
	resetTime time.Time
}

var limiter = &RateLimiter{
	attempts:    make(map[string]*rateLimitEntry),
	maxAttempts: 5,
	window:      time.Minute,
}

func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	entry, exists := rl.attempts[ip]

	if !exists || now.After(entry.resetTime) {
		rl.attempts[ip] = &rateLimitEntry{
			count:     1,
			resetTime: now.Add(rl.window),
		}
		return true
	}

	if entry.count >= rl.maxAttempts {
		return false
	}

	entry.count++
	return true
}

func (rl *RateLimiter) Cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	for ip, entry := range rl.attempts {
		if now.After(entry.resetTime) {
			delete(rl.attempts, ip)
		}
	}
}

func init() {
	// Clean up expired entries every 5 minutes
	go func(rl *RateLimiter) {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			rl.Cleanup()
		}
	}(limiter)
}

func Wrapper[T any](f func() (T, error)) http.HandlerFunc {
	return WrapperContext(func(context.Context) (T, error) { return f() })
}

func WrapperContext[T any](f func(context.Context) (T, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			w.WriteHeader(http.StatusUnauthorized)
			response := utils.Response{
				Errors: []string{"Not authenticated"},
			}
			fmt.Fprintf(w, "%s", utils.ToJSON(response))
			return
		}
		token := authHeader[len("Bearer "):]

		if err := ValidateToken(token); err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			response := utils.Response{
				Errors: []string{"Not authenticated"},
			}
			fmt.Fprintf(w, "%s", utils.ToJSON(response))
			return
		}

		data, err := f(r.Context())

		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			response := utils.Response{
				Errors: []string{err.Error()},
			}
			fmt.Fprintf(w, "%s", utils.ToJSON(response))
			return
		}

		response := utils.Response{
			Data:   data,
			Errors: []string{},
		}

		fmt.Fprintf(w, "%s", utils.ToJSON(response))
	}
}

func Handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	// Extract client IP for rate limiting
	clientIP := clientAddress(r)

	// Check rate limit
	if !limiter.Allow(clientIP) {
		w.WriteHeader(http.StatusTooManyRequests)
		response := utils.Response{
			Errors: []string{"Too many authentication attempts. Please try again later."},
		}
		fmt.Fprintf(w, "%s", utils.ToJSON(response))
		return
	}

	baseAuth := r.Header.Get("Authorization")
	if baseAuth == "" || !strings.HasPrefix(baseAuth, "Basic ") {
		w.WriteHeader(http.StatusUnauthorized)
		response := utils.Response{
			Errors: []string{"Invalid authorization header"},
		}
		fmt.Fprintf(w, "%s", utils.ToJSON(response))
		return
	}

	token3 := baseAuth[len("Basic "):]
	userpass, err := base64.StdEncoding.DecodeString(token3)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		response := utils.Response{
			Errors: []string{"Invalid base64 encoding"},
		}
		fmt.Fprintf(w, "%s", utils.ToJSON(response))
		return
	}

	parts := strings.SplitN(string(userpass), ":", 2)
	if len(parts) != 2 {
		w.WriteHeader(http.StatusUnauthorized)
		response := utils.Response{
			Errors: []string{"Invalid credentials format"},
		}
		fmt.Fprintf(w, "%s", utils.ToJSON(response))
		return
	}

	user := parts[0]
	pass := parts[1]

	settings := config.GetAuthSettings()
	if err := settings.CheckPassword(user, pass); err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		response := utils.Response{
			Errors: []string{"Invalid credentials"},
		}
		fmt.Fprintf(w, "%s", utils.ToJSON(response))
		return
	}

	token, err := issueSession(settings, user, time.Now())
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		response := utils.Response{
			Errors: []string{"Failed to generate authentication token"},
		}
		fmt.Fprintf(w, "%s", utils.ToJSON(response))
		return
	}

	response := utils.Response{
		Data:   Auth{Token: token},
		Errors: []string{},
	}
	fmt.Fprintf(w, "%s", utils.ToJSON(response))
}

// Forwarding headers are supplied by the caller unless a trusted proxy strips
// them. Key the limiter by the direct peer, without its ephemeral source port.
func clientAddress(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// sessionSigningKey uses a domain-separated HMAC and a JSON array encoding so
// neither field boundaries nor a password change can reuse another user's key.
// Looking up the unverified identity selects a key only: callers must verify the
// signature and all claims before granting access.
func sessionSigningKey(settings config.ServerAuth, name string) ([]byte, error) {
	user, err := settings.FindUser(name)
	if err != nil || name == "" || settings.Secret == "" {
		return nil, fmt.Errorf("invalid session identity")
	}
	identity, err := json.Marshal([2]string{user.Name, user.Pass})
	if err != nil {
		return nil, fmt.Errorf("invalid session identity")
	}
	mac := hmac.New(sha256.New, []byte(settings.Secret))
	mac.Write([]byte("server-status/session-signing-key/v1\x00"))
	mac.Write(identity)
	return mac.Sum(nil), nil
}

func issueSession(settings config.ServerAuth, name string, now time.Time) (string, error) {
	key, err := sessionSigningKey(settings, name)
	if err != nil || settings.SessionTTLSeconds < config.MinSessionTTLSeconds || settings.SessionTTLSeconds > config.MaxSessionTTLSeconds {
		return "", fmt.Errorf("invalid session settings")
	}
	claims := sessionClaims{
		Name:     name,
		TokenUse: sessionUse,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    sessionIssuer,
			Subject:   name,
			Audience:  jwt.ClaimStrings{sessionAudience},
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(settings.SessionTTLSeconds) * time.Second)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(key)
}

func ValidateToken(tokenString string) error {
	return validateTokenAt(tokenString, time.Now)
}

func validateTokenAt(tokenString string, now func() time.Time) error {
	settings := config.GetAuthSettings()
	claims := &sessionClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (any, error) {
		parsed, ok := token.Claims.(*sessionClaims)
		// An attacker controls these fields until signature verification. Use only
		// an existing, exact identity to choose the key; never authorize here.
		if !ok || parsed.Name == "" || parsed.Subject != parsed.Name || parsed.TokenUse != sessionUse {
			return nil, fmt.Errorf("invalid session identity")
		}
		return sessionSigningKey(settings, parsed.Subject)
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithExpirationRequired(), jwt.WithIssuer(sessionIssuer),
		jwt.WithAudience(sessionAudience), jwt.WithIssuedAt(), jwt.WithTimeFunc(now))
	// Do not return parser errors, which may embed attacker-controlled claims.
	if err != nil || token == nil || !token.Valid || claims.IssuedAt == nil || claims.ExpiresAt == nil {
		return fmt.Errorf("invalid session")
	}
	lifetime := claims.ExpiresAt.Sub(claims.IssuedAt.Time)
	if lifetime <= 0 || lifetime > time.Duration(config.MaxSessionTTLSeconds)*time.Second {
		return fmt.Errorf("invalid session")
	}
	return nil
}
