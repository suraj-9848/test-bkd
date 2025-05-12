#!/bin/bash

#!/usr/bin/env bash
set -euo pipefail

# 1. Navigate to your project directory
cd /home/ec2-user/lms-backend

# 2. Start your Docker Compose services
docker compose --profile trailbliz up -d

# 3. Install Node dependencies
pnpm i

# 4. Start TypeScript watcher
pnpm run watch &

# 5. Start the built app for production-like run
pnpm run mac-dev-build
