.PHONY: install frontend build test clean
.DEFAULT_GOAL := build

VERSION ?= $(shell cat VERSION)
GO ?= go
PNPM ?= pnpm

install:
	cd app && $(PNPM) install --frozen-lockfile

frontend:
	PNPM="$(PNPM)" ./build.sh frontend

build:
	GO="$(GO)" PNPM="$(PNPM)" VERSION="$(VERSION)" ./build.sh

test: frontend
	cd api && $(GO) test ./...
	cd app && $(PNPM) test

clean:
	rm -rf build api/web/dist app/dist
