import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JiraClient } from "../client.js";
import { withErrorHandler, getChainHint } from "../../shared/index.js";

// ─────────────────────────────────────────────
// create_issue tool — tách riêng do schema lớn
// (custom fields, epics, dryRun metadata)
// ─────────────────────────────────────────────

export function registerCreateIssueTool(server: McpServer, jira: JiraClient) {
  server.tool(
    "create_issue",
    "Tạo một Jira issue mới (Task, Sub-task, Bug, Story). " +
    "Dùng dryRun=true để xem metadata (custom fields, users, epics) — không tạo issue. " +
    "Dùng khi phân rã một task lớn thành các sub-task nhỏ hơn, " +
    "hoặc khi tạo task từ file mô tả nghiệp vụ .md. " +
    "Nếu người dùng yêu cầu tạo task mới như 'tạo task mới cho tôi nhé', hãy yêu cầu họ cung cấp các thông tin dựa trên ví dụ sau:\n" +
    "- Dự án (Project Key): PROJECT_KEY\n" +
    "- Loại Issue: Task\n" +
    "- Tiêu đề: Phối hợp thực AM UBNB Hoài Hôi\n" +
    "- Mô tả: Phối hợp thực AM UBNB Hoài Hôi\n" +
    "- Mức độ ưu tiên: Low\n" +
    "- Nhãn (Labels): ProjectLabels\n" +
    "- Mã SPDA: PROJ ProjectSPDA\n" +
    "- Công đoạn: Nghiên cứu và phát triển\n" +
    "- Due Date: 2026-04-03\n" +
    "- Assign cho: nghiath (optional)\n" +
    "- Epic: PROJECT-100 (optional)\n" +
    "⚠️ PHẢI hỏi user xác nhận TRƯỚC KHI gọi tool này — hiển thị nội dung issue sẽ tạo cho user duyệt.",
    {
      projectKey: z.string().describe("Project key, VD: 'PROJAI'"),
      dryRun: z.boolean().default(false)
        .describe("true = chỉ xem metadata (custom fields, users, epics) — không tạo issue"),
      issueType: z
        .enum(["Task", "Sub-task", "Bug", "Story"])
        .default("Task")
        .describe("Loại issue"),
      summary: z.string().optional().describe("Tiêu đề ngắn gọn của issue (bắt buộc khi tạo issue)"),
      description: z.string().optional().describe("Mô tả chi tiết issue (bắt buộc khi tạo issue)"),
      parentKey: z
        .string()
        .optional()
        .describe("Key của issue cha — bắt buộc nếu issueType là Sub-task"),
      priority: z
        .enum(["Highest", "High", "Medium", "Low", "Lowest"])
        .optional()
        .describe("Mức độ ưu tiên (bắt buộc khi tạo issue)"),
      labels: z
        .array(z.string())
        .optional()
        .describe("Danh sách labels, VD: ['backend', 'urgent'] (bắt buộc khi tạo issue)"),
      spda: z
        .string()
        .optional()
        .describe("Mã SPDA (customfield_10100). VD: 'PROJ XXXXX' (bắt buộc khi tạo issue)"),
      congDoan: z
        .string()
        .optional()
        .describe("Công đoạn (customfield_10101). VD: 'Nghiên cứu và phát triển' (bắt buộc khi tạo issue)"),
      dueDate: z
        .string()
        .optional()
        .describe("Ngày hết hạn, format YYYY-MM-DD. VD: '2026-04-15' (bắt buộc khi tạo issue)"),
      assignee: z
        .string()
        .optional()
        .describe(
          "Username của người được assign. Dùng dryRun=true để xem danh sách user khả dụng. " +
          "VD: 'nghiath', 'admin'. Bỏ trống = không assign."
        ),
      epicKey: z
        .string()
        .optional()
        .describe(
          "Key của Epic muốn liên kết. VD: 'PROJ-100'. " +
          "Dùng dryRun=true để xem danh sách Epic đang mở. Bỏ trống = không link Epic."
        ),
    },
    withErrorHandler("create_issue", async (payload) => {
      // ── dryRun: trả metadata (thay thế get_create_meta) ──
      if (payload.dryRun) {
        const lines: string[] = [
          `📋 Create Meta — ${payload.projectKey} / ${payload.issueType}`,
          "",
        ];

        // 1. Custom fields (SPDA, Công đoạn, issuetype, priority)
        try {
          const meta = await jira.getCreateMeta(payload.projectKey, payload.issueType);
          for (const [fieldId, field] of Object.entries(meta.fields)) {
            if (field.allowedValues && field.allowedValues.length > 0) {
              lines.push(`### ${field.name} (${fieldId})`);
              lines.push(`Required: ${field.required ? "✅" : "❌"}`);
              lines.push("Options:");
              for (const opt of field.allowedValues) {
                const label = opt.value || opt.name || "N/A";
                lines.push(`  • id: ${opt.id} → "${label}"`);
              }
              lines.push("");
            }
          }
        } catch {
          lines.push(`⚠️ API createmeta không khả dụng — đọc từ issue gần nhất`, "");
          try {
            const searchData = await jira.searchIssues(
              `project = ${payload.projectKey} ORDER BY created DESC`,
              1
            );
            const latestIssue = searchData.issues?.[0];
            if (latestIssue) {
              const cfData = await jira.getCustomFieldFromIssue(
                latestIssue.key,
                ["customfield_10100", "customfield_10101"]
              );
              if (cfData.customfield_10100) {
                lines.push(`### SPDA (customfield_10100)`);
                lines.push(`  • id: ${cfData.customfield_10100.id} → "${cfData.customfield_10100.value}"`);
                lines.push("");
              }
              if (cfData.customfield_10101) {
                lines.push(`### Công đoạn (customfield_10101)`);
                lines.push(`  • id: ${cfData.customfield_10101.id} → "${cfData.customfield_10101.value}"`);
                lines.push("");
              }
            }
          } catch {
            lines.push(`❌ Không thể đọc fallback data`, "");
          }
        }

        // 2. Assignable users
        try {
          const users = await jira.getAssignableUsers(payload.projectKey);
          if (users.length > 0) {
            lines.push(`### Assignable Users`);
            lines.push(`Tổng: ${users.length} thành viên`);
            for (const u of users) {
              const email = u.emailAddress ? ` (${u.emailAddress})` : "";
              lines.push(`  • name: "${u.name}" → ${u.displayName}${email}`);
            }
            lines.push("");
          }
        } catch {
          lines.push(`⚠️ Không thể lấy danh sách users`, "");
        }

        // 3. Epics đang mở
        try {
          const epics = await jira.searchEpics(payload.projectKey);
          if (epics.length > 0) {
            lines.push(`### Epics đang mở`);
            lines.push(`Tổng: ${epics.length} epic`);
            for (const e of epics) {
              lines.push(`  • ${e.key} → "${e.fields.summary}" [${e.fields.status.name}]`);
            }
            lines.push("");
          }
        } catch {
          lines.push(`⚠️ Không thể lấy danh sách Epics`, "");
        }

        return {
          content: [{ type: "text", text: lines.join("\n") + getChainHint("create_issue") }],
        };
      }

      // ── Tạo issue: validate required fields ──
      if (!payload.summary || !payload.description || !payload.priority ||
          !payload.labels || !payload.spda || !payload.congDoan || !payload.dueDate) {
        return {
          content: [{
            type: "text",
            text: "❌ Thiếu field bắt buộc. Khi tạo issue cần: summary, description, priority, labels, spda, congDoan, dueDate.\n" +
                  "💡 Dùng dryRun=true để xem danh sách giá trị hợp lệ trước.",
          }],
        };
      }

      const result = await jira.createIssue({
        projectKey: payload.projectKey,
        summary: payload.summary,
        description: payload.description,
        issueType: payload.issueType,
        parentKey: payload.parentKey,
        priority: payload.priority,
        labels: payload.labels,
        spda: payload.spda,
        congDoan: payload.congDoan,
        dueDate: payload.dueDate,
        assignee: payload.assignee,
        epicKey: payload.epicKey,
      });
      return {
        content: [{
          type: "text",
          text: `✅ Đã tạo issue thành công!\n` +
                `🔑 Key: ${result.key}\n` +
                `🔗 Link: ${jira.getBaseUrl()}/browse/${result.key}` + getChainHint("create_issue"),
        }],
      };
    })
  );
}
