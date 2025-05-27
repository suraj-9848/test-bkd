#!/bin/bash

# Script to build, run, and test the hiring portal functionality
echo "===== LMS Backend Hiring Portal Utility ====="

# Function to handle cleanup
cleanup() {
  echo "Cleaning up..."
  # Kill the server process if it's running
  if [ ! -z "$SERVER_PID" ]; then
    kill $SERVER_PID
    echo "Server stopped."
  fi
  exit 0
}

# Set up trap to handle script interruption
trap cleanup INT TERM

# Build the application
echo "Building the application..."
pnpm i
pnpm tsc

# Start the application using mac-dev-build
echo "Starting the server..."
pnpm run mac-dev-build &
SERVER_PID=$!

# Wait for the server to start
echo "Waiting for server to start..."
sleep 5

# Check if server is running
if ps -p $SERVER_PID > /dev/null; then
  echo "Server is running with PID: $SERVER_PID"
else
  echo "Failed to start the server. Please check for errors."
  exit 1
fi

# Set API URL
export API_URL=http://localhost:3000/api

# Run the hiring portal tests
echo "Running hiring portal tests..."
node src/scripts/test-hiring-portal.js

# Show test results
if [ $? -eq 0 ]; then
  echo "✅ Tests completed successfully!"
else
  echo "❌ Tests failed. Check the logs above for details."
fi

# Ask if user wants to keep the server running
read -p "Do you want to keep the server running? (y/n): " keep_running

if [ "$keep_running" != "y" ]; then
  cleanup
else
  echo "Server is still running with PID: $SERVER_PID"
  echo "Press Ctrl+C to stop the server when done."
  # Wait for user to press Ctrl+C
  wait $SERVER_PID
fi
