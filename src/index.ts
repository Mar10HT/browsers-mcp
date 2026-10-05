#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { browserManager } from './services/browser-manager.js';
import { registerSessionTools } from './tools/session.js';
import { registerNavigationTools } from './tools/navigation.js';
import { registerInteractionTools } from './tools/interaction.js';
import { registerInspectionTools } from './tools/inspection.js';
import { registerNetworkTools } from './tools/network.js';
import { registerConsoleTools } from './tools/console.js';
import { registerEvaluateTools } from './tools/evaluate.js';
import { registerStorageTools } from './tools/storage.js';
import { registerPerformanceTools } from './tools/performance.js';
import { registerAccessibilityTools } from './tools/accessibility.js';

const server = new McpServer({
  name: 'browsers-mcp-server',
  version: '1.0.0',
});

// Register all tool domains
registerSessionTools(server);
registerNavigationTools(server);
registerInteractionTools(server);
registerInspectionTools(server);
registerNetworkTools(server);
registerConsoleTools(server);
registerEvaluateTools(server);
registerStorageTools(server);
registerPerformanceTools(server);
registerAccessibilityTools(server);

// Clean up on exit
process.on('SIGINT', async () => {
  await browserManager.closeAll();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await browserManager.closeAll();
  process.exit(0);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('browsers-mcp-server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
