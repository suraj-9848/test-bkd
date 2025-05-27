#!/bin/bash
# filepath: /Users/vishnusrivatsava/lms-backend/scripts/run-with-mock.sh

# Script to run the hiring portal tests with mock S3 service
echo "===== Running Hiring Portal Tests with Mock S3 ====="

# Make scripts executable
chmod +x ./scripts/toggle-s3-mock.sh
chmod +x ./scripts/run-hiring-tests.sh
chmod +x ./scripts/hiring-portal-runner.sh

# Switch to mock S3 service
./scripts/toggle-s3-mock.sh mock

# Build the application
echo "Building the application with mock S3 service..."
pnpm run mac-dev-build

# Create uploads folder for resumes
mkdir -p ./uploads/resumes

# Set environment variables to make tests happy
export AWS_ACCESS_KEY_ID="mock-key"
export AWS_SECRET_ACCESS_KEY="mock-secret"
export AWS_REGION="mock-region"
export AWS_S3_BUCKET_NAME="mock-bucket"

# Run the tests
echo "Running tests with mock S3 service..."
node ./build/scripts/test-hiring-portal.js

# Ask if user wants to switch back to real S3
read -p "Do you want to switch back to real S3 service? (y/n): " switch_back

if [ "$switch_back" = "y" ]; then
  ./scripts/toggle-s3-mock.sh real
  echo "Switched back to real S3 service."
else
  echo "Still using mock S3 service. To switch back later, run: ./scripts/toggle-s3-mock.sh real"
fi

echo "===== Test Run Complete ====="
