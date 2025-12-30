package main

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type Auth struct {
	Token string `json:"token"`
}

func auth(w http.ResponseWriter, r *http.Request) {
	baseAuth := r.Header.Get("Authorization")
	token3 := baseAuth[len("Basic "):]
	userpass, _ := base64.StdEncoding.DecodeString(token3)
	parts := strings.SplitN(string(userpass), ":", 2)
	user := parts[0]
	pass := parts[1]

	if err := findUserAndCheckPassword(user, pass); err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		response := Response{
			Errors: []string{"Invalid credentials"},
		}
		fmt.Fprintf(w, "%s", toJSON(response))
		return
	}

	key, _ := getAuthSecret()
	tokenizer := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"name": user})
	token, _ := tokenizer.SignedString(key)

	response := Response{
		Data:   Auth{Token: token},
		Errors: []string{},
	}
	fmt.Fprintf(w, "%s", toJSON(response))
}

func validateToken(tokenString string) error {
	key, _ := getAuthSecret()
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
	_, err = findUser(userName)
	return err
}
