#!/bin/bash
set -e

# Function to handle shutdown
cleanup() {
    echo "Shutting down..."
    exit 0
}

trap cleanup SIGTERM SIGINT

echo "Starting node: $(hostname)"

# If MASK is set, reconfigure eth0
if [ -n "$MASK" ]; then
    echo "Reconfiguring eth0 with mask: $MASK"
    CURRENT_CIDR=$(ip -4 -o addr show dev eth0 scope global | awk '{print $4}' | head -n1)
    if [ -n "$CURRENT_CIDR" ]; then
        CURRENT_IP="${CURRENT_CIDR%/*}"
        CURRENT_PREFIX="${CURRENT_CIDR#*/}"
        if [ "$CURRENT_PREFIX" != "$MASK" ]; then
            ip addr del "$CURRENT_CIDR" dev eth0 || true
            ip addr add "$CURRENT_IP/$MASK" dev eth0
        fi
    fi
fi

# If GATEWAY_IP is set, configure the default route
if [ -n "$GATEWAY_IP" ]; then
    echo "Configuring gateway: $GATEWAY_IP"
    ip route del default || true
    ip route add default via "$GATEWAY_IP"
fi

# If EXTRA_ROUTE is set (format: "network via gateway")
if [ -n "$EXTRA_ROUTE" ]; then
    echo "Adding extra route: $EXTRA_ROUTE"
    ip route add $EXTRA_ROUTE
fi

# Keep the container running if it's the main process
if [ "$1" = "bash" ]; then
    exec /bin/bash
else
    exec "$@"
fi
