import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JiraClient } from "../client.js";
import { formatCurrentUser } from "../formatter.js";
import { withErrorHandler, getChainHint } from "../../shared/index.js";

// ─────────────────────────────────────────────
// User-related Jira tools
// ─────────────────────────────────────────────

export function registerUserTools(server: McpServer, jira: JiraClient) {
  // ── TOOL: Lấy thông tin user hiện tại ──────
  server.tool(
    "get_current_user",
    "Lấy thông tin user Jira hiện tại (ứng với PAT đang dùng). " +
    "Trả về username, display name, email, timezone. " +
    "Dùng để: (1) verify PAT hợp lệ, (2) biết username để dùng trong JQL hoặc assigneeFilter, " +
    "(3) xác nhận đúng account khi dùng multi-tenant.",
    {},
    withErrorHandler("get_current_user", async () => {
      const user = await jira.getCurrentUser();
      return {
        content: [{
          type: "text",
          text: formatCurrentUser(user) + getChainHint("get_current_user"),
        }],
      };
    })
  );
}
