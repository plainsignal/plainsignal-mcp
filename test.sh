#!/bin/bash

# Test script for the PlainSignal MCP Server

# Use environment variable if provided, otherwise use the default
if [ -z "$PLAINSIGNAL_TOKEN" ]; then
  echo "Warning: PLAINSIGNAL_TOKEN environment variable not set."
  echo "Using default value, which may not work."
  echo "To set the token, run: export PLAINSIGNAL_TOKEN=your_actual_token"
  ACCESS_TOKEN="your_access_token"
else
  ACCESS_TOKEN="$PLAINSIGNAL_TOKEN"
fi

# Use PLAINSIGNAL_API_BASE_URL environment variable if provided
if [ -z "$PLAINSIGNAL_API_BASE_URL" ]; then
  API_URL_PARAM=""
  echo "Using default API base URL: https://app.plainsignal.com/api/v1"
else
  API_URL_PARAM="--api-base-url $PLAINSIGNAL_API_BASE_URL"
  echo "Using custom API base URL: $PLAINSIGNAL_API_BASE_URL"
fi

echo "Starting PlainSignal MCP Server (using ES modules)..."
node src/index.js --token $ACCESS_TOKEN $API_URL_PARAM