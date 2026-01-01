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

const (
	// Rate limiting configuration
	maxAuthAttempts = 5
	rateWindow      = time.Minute
	cleanupInterval = 5 * time.Minute

	// JWT configuration
	tokenExpiration = 24 * time.Hour
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
	maxAttempts: maxAuthAttempts,
	window:      rateWindow,
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
	// Clean up expired entries periodically
	go func() {
		ticker := time.NewTicker(cleanupInterval)
		defer ticker.Stop()
		for range ticker.C {
			limiter.Cleanup()
		}
	}()
}

func Wrapper[T any](f func() (T, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
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
	w.Header().Set("Content-Type", "application/json")

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

	basicAuth := baseAuth[len("Basic "):]
	userpass, err := base64.StdEncoding.DecodeString(basicAuth)
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
	now := time.Now()
	tokenizer := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"name": user,
		"exp":  now.Add(tokenExpiration).Unix(),
		"iat":  now.Unix(),
		"nbf":  now.Unix(),
	})
	token, err := tokenizer.SignedString(key)
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

func ValidateToken(tokenString string) error {
	key := config.GetAuthSecret()
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (any, error) {
		// Verify signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return key, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))

	if err != nil {
		return fmt.Errorf("invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return fmt.Errorf("invalid token")
	}

	// Validate expiration
	if exp, ok := claims["exp"].(float64); ok {
		if time.Now().Unix() > int64(exp) {
			return fmt.Errorf("token expired")
		}
	}

	nameClaim, exists := claims["name"]
	if !exists {
		return fmt.Errorf("invalid token")
	}

	userName, ok := nameClaim.(string)
	if !ok {
		return fmt.Errorf("invalid token")
	}
	_, err = config.FindUser(userName)
	if err != nil {
		return fmt.Errorf("invalid token")
	}
	return nil
}
