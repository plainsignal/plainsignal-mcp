#!/usr/bin/env node

import { spawn } from 'child_process';
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get current file directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Function to run the server and connect a client to it
async function runResourceExample() {
  console.log('Starting PlainSignal MCP resource example client...');

  // Get access token from environment or use default
  const accessToken = process.env.PLAINSIGNAL_TOKEN || 'your_access_token';
  if (!process.env.PLAINSIGNAL_TOKEN) {
    console.warn('Warning: PLAINSIGNAL_TOKEN not set in environment');
  }

  // Get API base URL from environment if provided
  const apiBaseUrl = process.env.API_BASE_URL;

  // Start the server process
  const serverPath = resolve(__dirname, '../src/index.js');
  console.log(`Starting server from: ${serverPath}`);

  let serverArgs = ['--token', accessToken];

  if (apiBaseUrl) {
    console.log(`Using custom API base URL: ${apiBaseUrl}`);
    serverArgs.push('--api-base-url', apiBaseUrl);
  } else {
    console.log('Using default API base URL');
  }

  // Create a transport that will spawn the server process
  const transport = new StdioClientTransport({
    command: 'node',
    args: [serverPath, ...serverArgs],
  });

  // Create an MCP client
  const client = new McpClient({
    name: 'plainsignal-resource-example-client',
    version: '0.1.0'
  });

  try {
    // Connect to the server
    await client.connect(transport);
    console.log('Connected to server successfully!');

    // List available resources
    console.log('Listing available resources...');
    const resources = await client.listResources();
    console.log('Available resources:');
    if (resources.resources && resources.resources.length > 0) {
      resources.resources.forEach(resource => {
        console.log(`- ${resource.name || 'Unnamed resource'}: ${resource.uri}`);
      });
    } else {
      console.log('No resources found');
    }

    // Try to read the domains resource
    try {
      console.log('\nTrying to read the listDomains resource...');
      const domainsResult = await client.readResource('plainsignal://listDomains');
      console.log('Resource content:');

      if (domainsResult.contents && Array.isArray(domainsResult.contents) && domainsResult.contents.length > 0) {
        try {
          // Try to parse the JSON for prettier display
          const jsonData = JSON.parse(domainsResult.contents[0].text);
          console.log(JSON.stringify(jsonData, null, 2));
        } catch (e) {
          // Fall back to raw output if not valid JSON
          console.log(domainsResult.contents[0].text);
        }
      } else {
        console.log('Unexpected response format:', domainsResult);
      }
    } catch (error) {
      console.error('Error reading resource:', error);
    }

    // Clean up
    await client.close();
    console.log('\nExample completed successfully!');
  } catch (error) {
    console.error('Example failed:', error);
  } finally {
    // Kill the server process
    await transport.close();
  }
}

// Make sure the examples directory exists
if (!fs.existsSync(dirname(__filename))) {
  fs.mkdirSync(dirname(__filename), { recursive: true });
}

runResourceExample().catch(console.error);