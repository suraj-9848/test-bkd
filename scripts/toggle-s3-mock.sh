#!/bin/bash
# filepath: /Users/vishnusrivatsava/lms-backend/scripts/toggle-s3-mock.sh

# Script to toggle between real S3 service and mock S3 service
MODE=$1

if [ "$MODE" = "mock" ]; then
  echo "Switching to mock S3 service..."
  
  # Create a backup of the original s3Service.ts if it doesn't exist
  if [ ! -f "./src/utils/s3Service.ts.original" ]; then
    cp ./src/utils/s3Service.ts ./src/utils/s3Service.ts.original
    echo "Original S3 service backed up as s3Service.ts.original"
  fi
  
  # Create a symbolic link to the mock service
  cp ./src/utils/mockS3Service.ts ./src/utils/s3Service.ts
  echo "Using mock S3 service now. Files will be saved locally in ./uploads folder."
  echo "You can now run the tests without AWS credentials."

elif [ "$MODE" = "real" ]; then
  echo "Switching back to real S3 service..."
  
  # Restore the original s3Service.ts if backup exists
  if [ -f "./src/utils/s3Service.ts.original" ]; then
    cp ./src/utils/s3Service.ts.original ./src/utils/s3Service.ts
    echo "Restored original S3 service from backup."
  else
    echo "Error: Original S3 service backup not found."
    exit 1
  fi

else
  echo "Usage: ./scripts/toggle-s3-mock.sh [mock|real]"
  echo "  mock - Use mock S3 service that saves files locally"
  echo "  real - Use real S3 service that requires AWS credentials"
  exit 1
fi

echo "You'll need to rebuild the application for changes to take effect:"
echo "pnpm run mac-dev-build"
