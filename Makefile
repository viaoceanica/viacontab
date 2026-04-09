SHELL := /usr/bin/env bash

.PHONY: test test-backend test-frontend sync-host deploy smoke

test:
	./scripts/test_all.sh

test-backend:
	./scripts/test_backend.sh

test-frontend:
	./scripts/test_frontend.sh

sync-host:
	./scripts/sync_host.sh

deploy:
	./scripts/deploy_host.sh

smoke:
	./scripts/smoke_host.sh
