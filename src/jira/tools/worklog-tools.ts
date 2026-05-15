import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JiraClient } from "../client.js";
import { formatWorklogSummary, formatWorklogDetail, WorklogEntry } from "../formatter.js";
import { withErrorHandler, getChainHint } from "../../shared/index.js";

// ─────────────────────────────────────────────
// Worklog-related Jira tools:
//   - log_work       : tạo worklog
//   - list_worklogs  : truy vấn (summary aggregate hoặc detail per-entry)
//   - delete_worklog : xoá batch + dryRun + best-effort
// ─────────────────────────────────────────────

export function registerWorklogTools(server: McpServer, jira: JiraClient) {
  // ── TOOL: Logwork ──────────────────────────
  server.tool(
    "log_work",
    "Ghi nhận thời gian làm việc (logwork) lên một Jira issue. " +
    "Dùng sau khi hoàn thành công việc để track effort. " +
    "Ví dụ: đã làm 2 tiếng fix bug VNPTAI-456. " +
    "⚠️ PHẢI hỏi user xác nhận TRƯỚC KHI gọi tool này — không được tự động submit. " +
    "Hiển thị nội dung sẽ log cho user review trước.",
    {
      issueKey: z
        .string()
        .describe("Jira issue key, VD: 'VNPTAI-123'"),
      timeSpent: z
        .string()
        .describe("Thời gian theo format Jira: '2h', '30m', '1h 30m', '1d'. 1d = 8h."),
      comment: z
        .string()
        .describe("Mô tả ngắn gọn đã làm gì trong khoảng thời gian này"),
      startedAt: z
        .string()
        .describe("Ngày bắt đầu làm việc, format YYYY-MM-DD (VD: '2026-03-02'). BẮT BUỘC phải truyền."),
    },
    withErrorHandler("log_work", async ({ issueKey, timeSpent, comment, startedAt }) => {
      const result = await jira.addWorklog(issueKey, timeSpent, comment, startedAt);
      return {
        content: [{
          type: "text",
          text: `✅ Đã logwork thành công!\n` +
                `📌 Issue: ${issueKey}\n` +
                `⏱️  Thời gian: ${timeSpent}\n` +
                `📅 Ngày: ${startedAt}\n` +
                `📝 Ghi chú: ${comment}\n` +
                `🆔 Worklog ID: ${result.id}` + getChainHint("log_work"),
        }],
      };
    })
  );

  // ── TOOL: Truy vấn worklog ───────────────
  server.tool(
    "list_worklogs",
    "Truy vấn worklog của 1 user trong khoảng thời gian. " +
    "Mặc định: current user, tháng hiện tại, summary aggregate theo issue. " +
    "detail=true: show từng worklog entry với worklogId (dùng để lấy ID cho delete_worklog). " +
    "Use case: 'tháng này tôi log bao nhiêu giờ', 'liệt kê chi tiết worklog tuần qua'.",
    {
      username: z.string().optional()
        .describe("Username Jira (không phải display name). Bỏ trống = current user."),
      dateFrom: z.string().optional()
        .describe("Ngày bắt đầu YYYY-MM-DD. Bỏ trống = ngày 1 tháng hiện tại."),
      dateTo: z.string().optional()
        .describe("Ngày kết thúc YYYY-MM-DD. Bỏ trống = hôm nay."),
      projectKey: z.string().optional()
        .describe("Filter theo project key, VD: 'VNPTAI'. Bỏ trống = tất cả."),
      detail: z.boolean().optional()
        .describe("true = show từng worklog entry với worklogId (dùng cho delete_worklog). false/bỏ trống = summary aggregate theo issue."),
    },
    withErrorHandler("list_worklogs", async ({ username, dateFrom, dateTo, projectKey, detail }) => {
      // 1. Resolve defaults
      const resolvedUser = username || (await jira.getCurrentUser()).name;
      const today = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
      const monthStart = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;
      const from = dateFrom || monthStart;
      const to = dateTo || todayStr;

      // 2. Build JQL
      const clauses = [
        `worklogAuthor = "${resolvedUser}"`,
        `worklogDate >= "${from}"`,
        `worklogDate <= "${to}"`,
      ];
      if (projectKey) clauses.push(`project = "${projectKey}"`);
      const jql = clauses.join(" AND ");

      // 3. Search issues + fetch worklogs parallel
      const MAX = 500;
      const search = await jira.searchIssues(jql, MAX);
      const issues = (search.issues || []) as Array<{ key: string; fields: { summary: string } }>;
      const truncated = (search.total || 0) > MAX;

      const worklogResults = await Promise.all(
        issues.map((i) => jira.getIssueWorklogs(i.key))
      );

      // 4a. detail=true → flatten từng entry
      if (detail) {
        const entries: WorklogEntry[] = [];
        issues.forEach((issue, idx) => {
          (worklogResults[idx].worklogs || [])
            .filter((e) =>
              e.author.name === resolvedUser &&
              e.started.slice(0, 10) >= from &&
              e.started.slice(0, 10) <= to
            )
            .forEach((e) => entries.push({
              id: e.id,
              issueKey: issue.key,
              issueSummary: issue.fields.summary,
              date: e.started.slice(0, 10),
              hours: Math.round((e.timeSpentSeconds / 3600) * 100) / 100,
              comment: e.comment,
            }));
        });
        return {
          content: [{
            type: "text",
            text: formatWorklogDetail(entries, { username: resolvedUser, from, to, truncated })
              + getChainHint("list_worklogs"),
          }],
        };
      }

      // 4b. default → aggregate theo issue
      const rows = issues
        .map((issue, idx) => {
          const entries = worklogResults[idx].worklogs || [];
          const totalSec = entries
            .filter((e) =>
              e.author.name === resolvedUser &&
              e.started.slice(0, 10) >= from &&
              e.started.slice(0, 10) <= to
            )
            .reduce((sum, e) => sum + e.timeSpentSeconds, 0);
          return { issueKey: issue.key, summary: issue.fields.summary, totalSeconds: totalSec };
        })
        .filter((r) => r.totalSeconds > 0);

      const grandTotal = rows.reduce((s, r) => s + r.totalSeconds, 0);

      return {
        content: [{
          type: "text",
          text: formatWorklogSummary(rows, grandTotal, { username: resolvedUser, from, to, truncated })
            + getChainHint("list_worklogs"),
        }],
      };
    })
  );

  // ── TOOL: Xoá worklog ──────────────────────
  server.tool(
    "delete_worklog",
    "Xoá 1 hoặc nhiều worklog trên 1 Jira issue. ⚠️ DESTRUCTIVE. " +
    "BẮT BUỘC chạy dryRun=true trước, show preview cho user, đợi xác nhận rồi mới chạy dryRun=false. " +
    "adjustEstimate=auto (Jira tự cộng giờ đã xoá vào remaining estimate). " +
    "Chỉ xoá được worklog của chính mình (hoặc admin). " +
    "Dùng list_worklogs với detail=true để lấy worklogId.",
    {
      issueKey: z.string().describe("Jira issue key, VD: 'VNPTAI-123'"),
      worklogIds: z.array(z.string()).min(1)
        .describe("Array worklog ID cần xoá. Lấy từ `list_worklogs` với detail=true."),
      dryRun: z.boolean().optional()
        .describe("true = preview, không xoá thật. KHUYẾN CÁO mạnh chạy dryRun trước."),
    },
    withErrorHandler("delete_worklog", async ({ issueKey, worklogIds, dryRun }) => {
      if (dryRun) {
        const data = await jira.getIssueWorklogs(issueKey);
        const matched = (data.worklogs || []).filter((w) => worklogIds.includes(w.id));
        const notFound = worklogIds.filter((id) => !matched.find((m) => m.id === id));
        const totalSec = matched.reduce((s, w) => s + w.timeSpentSeconds, 0);
        const lines = [
          `🔍 **Dry Run** — sẽ xoá ${matched.length}/${worklogIds.length} worklog trên \`${issueKey}\``,
          "",
          "| WorklogID | Date | Hours | Author | Comment |",
          "|-----------|------|-------|--------|---------|",
          ...matched.map((w) =>
            `| \`${w.id}\` | ${w.started.slice(0, 10)} | ${w.timeSpent} | ${w.author.name} | ${(w.comment || "").slice(0, 60)} |`
          ),
          "",
          `**Tổng giờ sẽ xoá:** ${(totalSec / 3600).toFixed(2)}h`,
          `**Remaining estimate:** sẽ tự cộng thêm ${(totalSec / 3600).toFixed(2)}h (adjustEstimate=auto)`,
        ];
        if (notFound.length > 0) {
          lines.push("", `⚠️ **${notFound.length} ID không tìm thấy:** ${notFound.join(", ")}`);
        }
        lines.push("", "👉 Gọi lại với `dryRun=false` (sau khi user xác nhận) để xoá thật.");
        return { content: [{ type: "text", text: lines.join("\n") + getChainHint("delete_worklog") }] };
      }

      // Real delete: best-effort, 1 entry fail không stop batch
      const results = await Promise.all(
        worklogIds.map(async (id) => {
          try {
            await jira.deleteWorklog(issueKey, id);
            return { id, ok: true as const };
          } catch (err: any) {
            const status = err?.response?.status;
            const msg = status === 403 ? "403 — không có quyền (worklog của user khác?)"
                      : status === 404 ? "404 — worklog không tồn tại"
                      : err?.message || "lỗi không xác định";
            return { id, ok: false as const, error: msg };
          }
        })
      );
      const success = results.filter((r) => r.ok);
      const failed = results.filter((r) => !r.ok);
      const lines = [
        `🗑️  **Delete Worklog** — issue \`${issueKey}\``,
        "",
        `✅ **Đã xoá:** ${success.length} worklog`,
      ];
      if (success.length > 0) lines.push(...success.map((r) => `  - \`${r.id}\``));
      if (failed.length > 0) {
        lines.push("", `❌ **Thất bại:** ${failed.length} worklog`);
        lines.push(...failed.map((r) => `  - \`${r.id}\`: ${(r as { ok: false; error: string }).error}`));
      }
      lines.push(getChainHint("delete_worklog"));
      return { content: [{ type: "text", text: lines.join("\n") }] };
    })
  );
}
