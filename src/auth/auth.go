package auth

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"status/config"
	"status/utils"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type Auth struct {
	Token string `json:"token"`
}

func Wrapper(f func() any) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
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

		response := utils.Response{
			Data:   f(),
			Errors: []string{},
		}

		fmt.Fprintf(w, "%s", utils.ToJSON(response))
	}
}

func Handler(w http.ResponseWriter, r *http.Request) {
	baseAuth := r.Header.Get("Authorization")
	token3 := baseAuth[len("Basic "):]
	userpass, _ := base64.StdEncoding.DecodeString(token3)
	parts := strings.SplitN(string(userpass), ":", 2)
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

	userName := claims["name"].(string)
	_, err = config.FindUser(userName)
	return err
}
