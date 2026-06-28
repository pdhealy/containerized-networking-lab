COMPOSE_FILE = docker/docker-compose.yml
COMPOSE_ENV = docker/.env

.PHONY: build up down ps logs test dev-test clean

build:
	docker compose --env-file $(COMPOSE_ENV) -f $(COMPOSE_FILE) build

up:
	docker compose --env-file $(COMPOSE_ENV) -f $(COMPOSE_FILE) up -d

down:
	docker compose --env-file $(COMPOSE_ENV) -f $(COMPOSE_FILE) down

ps:
	docker compose --env-file $(COMPOSE_ENV) -f $(COMPOSE_FILE) ps

logs:
	docker compose --env-file $(COMPOSE_ENV) -f $(COMPOSE_FILE) logs -f

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
