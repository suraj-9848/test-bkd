#!/bin/bash

# Script to run the hiring portal tests
echo "Running Hiring Portal Tests..."

# Check if the app is built
if [ ! -f "./build/index.js" ]; then
  echo "Building the application first..."
  pnpm run mac-dev-build &
  # Wait for the server to start
  sleep 5
  echo "Application is now running..."
fi

# Check if environment variables are set
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ] || [ -z "$AWS_REGION" ] || [ -z "$AWS_S3_BUCKET_NAME" ]; then
  echo "Warning: AWS environment variables not fully set. S3 operations may fail."
  echo "Required variables:"
  echo "  - AWS_ACCESS_KEY_ID"
  echo "  - AWS_SECRET_ACCESS_KEY"
  echo "  - AWS_REGION"
  echo "  - AWS_S3_BUCKET_NAME"
fi

# Set API URL if not provided
if [ -z "$API_URL" ]; then
  export API_URL=http://localhost:3000/api
  echo "Using default API URL: $API_URL"
else
  echo "Using API URL: $API_URL"
fi

# Check S3 connectivity
echo "Checking S3 connection..."
node -e "require('../src/scripts/check-s3-health.js').checkS3Health().then(isHealthy => { if (!isHealthy) console.log('⚠️ S3 connection issues detected. Resume uploads may fail.'); })"

# Run the test script
node src/scripts/test-hiring-portal.js

# Check if the test was successful
if [ $? -eq 0 ]; then
  echo "✅ Tests completed successfully!"
else
  echo "❌ Tests failed. Check the logs above for details."
fi
