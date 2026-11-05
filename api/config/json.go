package config

import (
	"bytes"
	"encoding/json"
	"io"
)

// A small schema for structural checks only; decoding and semantic validation
// remain responsible for scalar types and required values. nil means an ignored
// legacy value; arrays permit null to retain omitted optional-list compatibility.
type jsonShape struct {
	fields map[string]*jsonShape
	item   *jsonShape
}

var apiConfigShape = &jsonShape{fields: map[string]*jsonShape{
	"listen": {fields: map[string]*jsonShape{"host": {}, "port": {}}},
	"auth": {fields: map[string]*jsonShape{
		"secret": {}, "session_ttl_seconds": {},
		"users": {item: &jsonShape{fields: map[string]*jsonShape{"name": {}, "pass": {}}}},
	}},
	"services":       {item: &jsonShape{fields: map[string]*jsonShape{"name": {}, "port": {}}}},
	"hosts":          {item: &jsonShape{}},
	"telemetry_file": {},
	"external":       nil,
}}

func validJSONShape(body []byte, shape *jsonShape) bool {
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.UseNumber()
	if !checkJSONShape(decoder, shape) {
		return false
	}
	_, err := decoder.Token()
	return err == io.EOF
}

func checkJSONShape(decoder *json.Decoder, shape *jsonShape) bool {
	if shape == nil {
		var ignored json.RawMessage
		return decoder.Decode(&ignored) == nil
	}
	token, err := decoder.Token()
	if err != nil {
		return false
	}
	if shape.fields != nil {
		if token != json.Delim('{') {
			return false
		}
		seen := map[string]bool{}
		for decoder.More() {
			token, err := decoder.Token()
			key, ok := token.(string)
			child, known := shape.fields[key]
			if err != nil || !ok || !known || seen[key] || !checkJSONShape(decoder, child) {
				return false
			}
			seen[key] = true
		}
		end, err := decoder.Token()
		return err == nil && end == json.Delim('}')
	}
	if shape.item != nil {
		if token == nil {
			return true
		}
		if token != json.Delim('[') {
			return false
		}
		for decoder.More() {
			if !checkJSONShape(decoder, shape.item) {
				return false
			}
		}
		end, err := decoder.Token()
		return err == nil && end == json.Delim(']')
	}
	_, compound := token.(json.Delim)
	return token != nil && !compound
}
