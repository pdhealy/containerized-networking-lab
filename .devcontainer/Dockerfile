FROM mcr.microsoft.com/devcontainers/javascript-node:20

# Install Docker CLI to test the lab
RUN apt-get update && apt-get install -y docker.io

# Create a symlink for docker-compose if needed
RUN ln -s /usr/libexec/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose || true
