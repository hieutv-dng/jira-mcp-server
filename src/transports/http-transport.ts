import { Request, Response, NextFunction } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { registerJiraTools } from "../jira/tools.js";

/**
 * Bearer token authentication middleware.
 * Bypasses /health endpoint for load balancer checks.
 */
function bearerAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.path === "/health") {
    next();
    return;
  }

  const authHeader = req.headers.authorization?.toLowerCase() ?? "";
  const token = authHeader.startsWith("bearer ")
    ? req.headers.authorization!.slice(7)
    : "";
  const expected = process.env.MCP_AUTH_TOKEN;

  if (token !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

/**
 * Create a per-request MCP server with Jira tools.
 * Stateless mode: each request gets its own server instance.
 */
function createPerRequestServer(): McpServer {
  const server = new McpServer({
    name: "jira-mcp-server",
    version: "1.0.0",
  });
  registerJiraTools(server);
  return server;
}

/**
 * Start MCP server with HTTP transport.
 * Uses stateless mode: per-request server instances.
 *
 * Requires: MCP_AUTH_TOKEN env var for security.
 */
export async function startHttpTransport(
  _server: McpServer,
  port: number
): Promise<void> {
  // Mandatory auth validation
  if (!process.env.MCP_AUTH_TOKEN) {
    console.error("MCP_AUTH_TOKEN is required for HTTP transport");
    console.error("Set it via: MCP_AUTH_TOKEN=your-secret npm start");
    process.exit(1);
  }

  // Create Express app with DNS rebinding protection
  const app = createMcpExpressApp({
    allowedHosts: ["localhost", "127.0.0.1"],
  });

  // Add Bearer auth middleware
  app.use(bearerAuth);

  // Health check endpoint (public, no auth)
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // MCP protocol endpoint (stateless mode)
  app.post("/mcp", async (req: Request, res: Response) => {
    const server = createPerRequestServer();
    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    // Cleanup on connection close
    res.on("close", () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.listen(port, () => {
    console.error(`MCP Server running on http://localhost:${port}/mcp`);
    console.error("Auth: Bearer token required");
  });
}
