# Subnetting Container Lab

A containerized homelab environment for studying, practicing, and testing networking concepts such as subnetting, routing, and firewalls.

## Architecture

- **Router (Parent)**: Acts as the gateway between two subnets.
- **Client A (Child)**: Situated on Subnet A (172.20.1.0/24).
- **Client B (Child)**: Situated on Subnet B (172.20.2.0/24).

## Getting Started

### Prerequisites
- Docker
- Docker Compose
- Make (optional, but recommended)

### Usage

1. **Build and start the lab**:
   ```bash
   make up
   ```
   Or manually:
   ```bash
   docker compose -f docker/docker-compose.yml up -d
   ```

2. **Test connectivity**:
   ```bash
   make test
   ```

3. **Shutdown**:
   ```bash
   make down
   ```

## Laboratory Exercises

- **Subnetting**: Inspect how the IP ranges are defined in `docker/docker-compose.yml`.
- **Routing**: Check the routing tables on the clients (`ip route`) to see how they reach the other subnet via the router.
- **Firewall**: Use `iptables` on the router to simulate packet filtering.
