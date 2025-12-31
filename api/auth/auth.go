package auth

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"status/config"
	"status/utils"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

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
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			limiter.Cleanup()
		}
	}()
}

func Wrapper[T any](f func() (T, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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

		data, err := f()

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
	// Extract client IP for rate limiting
	clientIP := r.RemoteAddr
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		clientIP = strings.Split(forwarded, ",")[0]
	}

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

	if err := config.FindUserAndCheckPassword(user, pass); err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		response := utils.Response{
			Errors: []string{"Invalid credentials"},
		}
		fmt.Fprintf(w, "%s", utils.ToJSON(response))
		return
	}

	key := config.GetAuthSecret()
	tokenizer := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"name": user})
	token, _ := tokenizer.SignedString(key)

	response := utils.Response{
		Data:   Auth{Token: token},
		Errors: []string{},
	}
	fmt.Fprintf(w, "%s", utils.ToJSON(response))
}

func ValidateToken(tokenString string) error {
	key := config.GetAuthSecret()
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (any, error) {
		return key, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))

	if err != nil {
		return err
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return fmt.Errorf("invalid token")
	}

	nameClaim, exists := claims["name"]
	if !exists {
		return fmt.Errorf("invalid token: missing name claim")
	}

	userName, ok := nameClaim.(string)
	if !ok {
		return fmt.Errorf("invalid token: invalid name claim type")
	}
	_, err = config.FindUser(userName)
	return err
}
