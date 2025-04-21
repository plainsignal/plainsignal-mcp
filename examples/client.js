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
async function runExample() {
  console.log('Starting PlainSignal MCP example client...');

  // Get access token from environment or use default
  const accessToken = process.env.PLAINSIGNAL_TOKEN || 'your_access_token';
  if (!process.env.PLAINSIGNAL_TOKEN) {
    console.warn('Warning: PLAINSIGNAL_TOKEN not set in environment');
  }

  // Get API base URL from environment if provided
  const apiBaseUrl = process.env.PLAINSIGNAL_API_BASE_URL;

  // Define the server path
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
    name: 'plainsignal-example-client',
    version: '0.1.0'
  });

  try {
    // Connect to the server
    await client.connect(transport);
    console.log('Connected to server successfully!');

    // List available tools
    console.log('Listing available tools...');
    const tools = await client.listTools();
    console.log('Available tools:');
    tools.tools.forEach(tool => {
      console.log(`- ${tool.name}: ${tool.description}`);
    });

    // Example parameters for getReport tool
    const reportParams = {
      organizationID: '0CU4CfZloNE',
      domainID: '0CU4Zrqgh4H',
      periodFrom: '2025-04-20T00:00:00.000-07:00',
      periodTo: '2025-04-20T23:59:59.999-07:00',
      periodSelection: 'd',
      aggregationWindow: 'h',
      filters: [
        {
          key: 'country',
          values: ['US', 'CA']
        }
      ]
    };

    try {
      console.log('\nTesting getReport tool...');
      const report = await client.callTool('getReport', reportParams);
      console.log('Report result:');

      if (report.content && Array.isArray(report.content) && report.content.length > 0) {
        try {
          // Try to parse the JSON for prettier display
          const jsonData = JSON.parse(report.content[0].text);
          console.log(JSON.stringify(jsonData, null, 2));
        } catch (e) {
          // Fall back to raw output if not valid JSON
          console.log(report.content[0].text);
        }
      } else {
        console.log('Unexpected response format:', report);
      }
    } catch (error) {
      console.error('Error calling getReport:', error);
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

runExample().catch(console.error);