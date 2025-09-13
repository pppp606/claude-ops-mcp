#!/usr/bin/env node

import { MCPServer } from './server.js';

async function main(): Promise<void> {
  const server = new MCPServer();
  
  try {
    await server.start();
    
    // Handle graceful shutdown
    process.once('SIGINT', async () => {
      console.error('Received SIGINT, shutting down gracefully...');
      await server.stop();
    });
    
    process.once('SIGTERM', async () => {
      console.error('Received SIGTERM, shutting down gracefully...');
      await server.stop();
    });
    
    // Stdio transport connection keeps the process running naturally
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run the server
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});