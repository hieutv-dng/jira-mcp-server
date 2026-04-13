import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Load .env từ thư mục gốc project (không phụ thuộc CWD)
// Fix cho trường hợp supergateway spawn child process với CWD khác
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");
config({ path: resolve(projectRoot, ".env") });

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerJiraTools } from "./jira/tools.js";
import { startStdioTransport } from "./transports/stdio-transport.js";
import { startHttpTransport } from "./transports/http-transport.js";

const server = new McpServer({
  name: "jira-mcp-server",
  version: "1.0.0",
});

registerJiraTools(server);

async function main() {
  const httpPort = process.env.HTTP_PORT;

  if (httpPort) {
    await startHttpTransport(server, parseInt(httpPort, 10));
  } else {
    await startStdioTransport(server);
  }
}

main().catch((err) => {
  console.error("Server startup error:", err);
  process.exit(1);
});
