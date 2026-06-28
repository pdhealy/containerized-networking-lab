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
    CURRENT_IP=$(ip addr show eth0 | grep "inet " | awk '{print $2}' | cut -d/ -f1)
    ip addr del "$CURRENT_IP/16" dev eth0 || ip addr del "$CURRENT_IP/24" dev eth0 || true
    ip addr add "$CURRENT_IP/$MASK" dev eth0
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
