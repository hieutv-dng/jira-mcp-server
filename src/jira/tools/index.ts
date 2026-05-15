import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { jiraClient, JiraClient } from "../client.js";
import { registerUserTools } from "./user-tools.js";
import { registerIssueTools } from "./issue-tools.js";
import { registerCreateIssueTool } from "./create-issue-tool.js";
import { registerWorklogTools } from "./worklog-tools.js";

// ─────────────────────────────────────────────
// Barrel: gom tất cả Jira tools.
// Mỗi sub-module register theo concern (user/issue/worklog).
// ─────────────────────────────────────────────

/**
 * Register all Jira tools on the MCP server.
 * @param server - MCP server instance
 * @param client - Optional JiraClient, defaults to singleton for stdio transport
 */
export function registerJiraTools(server: McpServer, client?: JiraClient) {
  const jira = client || jiraClient;

  registerUserTools(server, jira);
  registerIssueTools(server, jira);
  registerCreateIssueTool(server, jira);
  registerWorklogTools(server, jira);
}
