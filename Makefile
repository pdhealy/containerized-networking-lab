COMPOSE_FILE = docker/docker-compose.yml
COMPOSE_ENV = docker/.env

# Prefer Docker Compose v2 plugin, fallback to legacy docker-compose.
COMPOSE_CMD := $(shell if docker compose version >/dev/null 2>&1; then echo "docker compose"; elif command -v docker-compose >/dev/null 2>&1; then echo "docker-compose"; else echo "docker compose"; fi)

.PHONY: build up down ps logs test dev-test clean

build:
	$(COMPOSE_CMD) -f $(COMPOSE_FILE) build

up:
	$(COMPOSE_CMD) -f $(COMPOSE_FILE) up -d

down:
	$(COMPOSE_CMD) -f $(COMPOSE_FILE) down

ps:
	$(COMPOSE_CMD) -f $(COMPOSE_FILE) ps

logs:
	$(COMPOSE_CMD) -f $(COMPOSE_FILE) logs -f

# Load variables from .env
include $(COMPOSE_ENV)
export

test:
	@echo "Running connectivity tests..."
	@echo "Testing Client A -> Router ($(ROUTER_IP_A))"
	docker exec lab-client-a ping -c 3 $(ROUTER_IP_A)
	@echo "Testing Client B -> Router ($(ROUTER_IP_B))"
	docker exec lab-client-b ping -c 3 $(ROUTER_IP_B)
	@echo "Testing Client A -> Client B ($(CLIENT_B_IP)) via Router"
	docker exec lab-client-a ping -c 3 $(CLIENT_B_IP)
	@echo "Testing Client B -> Client A ($(CLIENT_A_IP)) via Router"
	docker exec lab-client-b ping -c 3 $(CLIENT_A_IP)
	@echo "Connectivity tests passed!"

dev-test:
	@echo "Installing @devcontainers/cli..."
	npm install -g @devcontainers/cli --silent
	@echo "Verifying Dev Container configuration..."
	devcontainer build --workspace-folder .

clean: down
	docker rmi lab-node:latest || true
