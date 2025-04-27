#!/bin/bash

# Navigate to the project directory
cd "$(dirname "$0")"

# Run pnpm build
echo "Running pnpm build..."
pnpm build

# Restart the service
echo "Restarting stg.service..."
sudo systemctl restart stg.service

echo "Deployment completed."