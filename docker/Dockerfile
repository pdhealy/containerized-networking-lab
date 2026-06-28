FROM ubuntu:24.04

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive

# Install networking tools
RUN apt-get update && apt-get install -y \
    iproute2 \
    iptables \
    iputils-ping \
    net-tools \
    curl \
    traceroute \
    bash \
    sudo \
    tcpdump \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for exploration (though network tasks need root)
RUN useradd -m student && \
    echo "student ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers

WORKDIR /home/student

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["bash"]
