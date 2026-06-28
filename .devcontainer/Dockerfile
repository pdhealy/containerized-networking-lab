FROM mcr.microsoft.com/devcontainers/javascript-node:20

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive

# Install networking tools and Docker CLI
RUN apt-get update && apt-get install -y \
    docker.io \
    iproute2 \
    iptables \
    iputils-ping \
    net-tools \
    curl \
    zstd \
    traceroute \
    bash \
    sudo \
    tcpdump \
        && (apt-get install -y docker-compose-plugin || apt-get install -y docker-compose) \
    && rm -rf /var/lib/apt/lists/*

# Create a symlink for docker-compose if needed
RUN if [ -x /usr/libexec/docker/cli-plugins/docker-compose ]; then \
            ln -sf /usr/libexec/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose; \
        elif [ -x /usr/lib/docker/cli-plugins/docker-compose ]; then \
            ln -sf /usr/lib/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose; \
        fi

# Ensure the 'node' user can use sudo without a password
RUN echo "node ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers
