import { Request, Response, NextFunction } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { registerJiraTools } from "../jira/tools.js";
import { createJiraClient, JiraClient } from "../jira/client.js";

/**
 * Credentials đã được resolve từ headers hoặc env.
 */
interface ResolvedCredentials {
  baseUrl: string;
  pat: string;
  source: "headers" | "env" | "mixed";
}

/**
 * Extract Jira credentials từ HTTP headers với fallback tới env vars.
 * Headers: X-Jira-Base-Url, X-Jira-Pat
 */
function resolveCredentials(req: Request): ResolvedCredentials {
  const headerBaseUrl = req.headers["x-jira-base-url"] as string | undefined;
  const headerPat = req.headers["x-jira-pat"] as string | undefined;

  const baseUrl = headerBaseUrl || process.env.JIRA_BASE_URL;
  const pat = headerPat || process.env.JIRA_PAT;

  if (!baseUrl || !pat) {
    throw new Error(
      "Missing Jira credentials: provide X-Jira-Base-Url and X-Jira-Pat headers, " +
      "or set JIRA_BASE_URL and JIRA_PAT env vars"
    );
  }

  const source: ResolvedCredentials["source"] =
    headerBaseUrl && headerPat ? "headers"
    : !headerBaseUrl && !headerPat ? "env"
    : "mixed";

  return { baseUrl, pat, source };
}

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
 * @param client - JiraClient instance với credentials từ request headers
 */
function createPerRequestServer(client: JiraClient): McpServer {
  const server = new McpServer({
    name: "jira-mcp-server",
    version: "1.1.0",
  });
  registerJiraTools(server, client);
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
    // Resolve Jira credentials từ headers (fallback to env)
    let creds: ResolvedCredentials;
    try {
      creds = resolveCredentials(req);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
      return;
    }

    // Log credential source for debugging (không log credentials thật)
    console.error(`[MCP] Credentials source: ${creds.source}`);

    // Create per-request JiraClient với resolved credentials
    const client = createJiraClient({ baseUrl: creds.baseUrl, pat: creds.pat });
    const server = createPerRequestServer(client);
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
