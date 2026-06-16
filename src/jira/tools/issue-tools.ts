import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JiraClient } from "../client.js";
import { formatIssueForAI, formatIssueListForAI } from "../formatter.js";
import { withErrorHandler, getChainHint } from "../../shared/index.js";
import { buildQuickDriftWarning } from "./issue-drift-warning.js";

// ─────────────────────────────────────────────
// Issue-related Jira tools: list_issues, get_issue_detail, update_issue
// (create_issue tách sang create-issue-tool.ts do schema lớn)
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// buildUserClause
//
// Tạo JQL clause cho user/role filter.
// Trả về string có trailing " AND " nếu có filter,
// hoặc chuỗi rỗng nếu assigneeFilter = "any".
// ─────────────────────────────────────────────
function buildUserClause(role: string, assigneeFilter: string): string {
  // "any" = không filter user, bỏ qua clause này
  if (assigneeFilter === "any") return "";

  // "unassigned" chỉ áp dụng cho assignee
  if (assigneeFilter === "unassigned") {
    return role === "assignee" ? "assignee is EMPTY AND " : "";
  }

  const userValue = assigneeFilter === "currentUser()"
    ? "currentUser()"
    : `"${assigneeFilter}"`;

  // watcher dùng field "watcher" trong JQL
  const jqlField = role === "watcher" ? "watcher" : role;
  return `${jqlField} = ${userValue} AND `;
}

function findLabelConflict(addLabels: string[] = [], removeLabels: string[] = []): string | null {
  const removeSet = new Set(removeLabels.map((label) => label.toLowerCase()));
  return addLabels.find((label) => removeSet.has(label.toLowerCase())) ?? null;
}

export function registerIssueTools(server: McpServer, jira: JiraClient) {
  // ── TOOL: Lấy danh sách issues ─────────────
  server.tool(
    "list_issues",
    "Lấy danh sách Jira issues theo filter linh hoạt. " +
    "Mặc định: issues được assign cho tôi, đang mở. " +
    "Có thể lọc theo user khác (assigneeFilter), role (assignee/reporter/watcher), " +
    "trạng thái (statusFilter), hoặc JQL tùy chỉnh (customJql = full override). " +
    "Trước đây có tên list_my_open_issues.",
    {
      projectKey: z
        .string()
        .optional()
        .describe("Filter theo project key cụ thể, VD: 'PROJAI'. Bỏ trống = tất cả project."),
      assigneeFilter: z
        .string()
        .default("currentUser()")
        .describe(
          "User để filter. " +
          "'currentUser()' = tôi (default). " +
          "'unassigned' = chưa assign (chỉ với assignee role). " +
          "'any' = bỏ qua filter user. " +
          "Username cụ thể: 'nghiath', 'admin', v.v."
        ),
      roleFilter: z
        .enum(["assignee", "reporter", "watcher"])
        .default("assignee")
        .describe(
          "Role của user với issue. " +
          "'assignee' = được assign (default). " +
          "'reporter' = người tạo issue. " +
          "'watcher' = người đang theo dõi."
        ),
      statusFilter: z
        .enum(["open", "active", "done", "all"])
        .default("open")
        .describe(
          "Filter theo nhóm trạng thái: " +
          "'open' = Open/To Do/Reopened, " +
          "'active' = In Progress, " +
          "'done' = Done/Resolved/Closed, " +
          "'all' = tất cả."
        ),
      customJql: z
        .string()
        .optional()
        .describe("JQL tùy chỉnh — full override, không inject thêm gì. VD: 'project = PROJAI AND sprint in openSprints()'"),
      maxResults: z
        .number()
        .min(1)
        .max(50)
        .default(20)
        .describe("Số lượng tối đa issues trả về"),
    },
    withErrorHandler("list_issues", async ({ projectKey, assigneeFilter, roleFilter, statusFilter, customJql, maxResults }) => {
      const projectFilter = projectKey ? `project = ${projectKey} AND ` : "";

      // Map statusFilter → JQL conditions
      const statusMap: Record<string, string> = {
        open:   `status in ("Open", "To Do", "Reopened")`,
        active: `status in ("In Progress")`,
        done:   `status in ("Done", "Resolved", "Closed")`,
        all:    `status not in ("Cancelled")`,
      };

      let jql: string;
      if (customJql) {
        // Full override — không inject gì thêm vào customJql
        jql = `${projectFilter}${customJql} ORDER BY updated DESC`;
      } else {
        const userClause = buildUserClause(roleFilter, assigneeFilter);
        jql = `${projectFilter}${userClause}${statusMap[statusFilter]} ORDER BY priority DESC, updated DESC`;
      }

      const data = await jira.searchIssues(jql, maxResults);

      // Build label mô tả filter đang dùng
      const statusLabelMap: Record<string, string> = {
        open:   "Open / To Do / Reopened",
        active: "In Progress",
        done:   "Done / Resolved / Closed",
        all:    "Tất cả trạng thái",
      };
      const roleLabel = roleFilter === "assignee" ? "Assignee"
        : roleFilter === "reporter" ? "Reporter" : "Watcher";
      const userLabel = assigneeFilter === "currentUser()" ? "Tôi"
        : assigneeFilter === "unassigned" ? "Chưa assign"
        : assigneeFilter === "any" ? "Tất cả"
        : assigneeFilter;
      const label = customJql
        ? `Custom JQL: ${customJql}`
        : `${roleLabel}: ${userLabel} | Status: ${statusLabelMap[statusFilter]}`;

      if (data.issues.length === 0) {
        return {
          content: [{ type: "text", text: `✅ Không có issue nào (điều kiện: ${label}).` + getChainHint("list_issues") }],
        };
      }

      return {
        content: [{
          type: "text",
          text: `**Filter:** ${label}\n\n` + formatIssueListForAI(data.issues, data.total) + getChainHint("list_issues"),
        }],
      };
    })
  );

  // ── TOOL: Lấy chi tiết 1 issue ─────────────
  server.tool(
    "get_issue_detail",
    "Đọc toàn bộ thông tin chi tiết của 1 Jira issue: mô tả đầy đủ, " +
    "comments, sub-tasks, priority, status hiện tại. " +
    "Dùng trước khi phân tích hoặc implement một task cụ thể.",
    {
      issueKey: z
        .string()
        .describe("Jira issue key, VD: 'PROJAI-123'"),
    },
    withErrorHandler("get_issue_detail", async ({ issueKey }) => {
      const issue = await jira.getIssue(issueKey);

      // ── Tự động check drift ────────────────────
      // Không cần gọi tool riêng — warning xuất hiện
      // ngay trong output của get_issue_detail
      const driftWarning = buildQuickDriftWarning(issue);

      return {
        content: [{
          type: "text",
          text: driftWarning + formatIssueForAI(issue) + getChainHint("get_issue_detail"),
        }],
      };
    })
  );

  // ── TOOL: Cập nhật issue (assign + transition + comment) ───────
  server.tool(
    "update_issue",
    "Cập nhật Jira issue: assign/unassign user, thêm/xoá/clear labels, chuyển trạng thái, thêm comment, " +
    "hoặc xem transitions khả dụng. " +
    "Dùng dryRun=true để xem danh sách transitions mà không thay đổi gì. " +
    "Truyền assignee để gán/gỡ người làm. " +
    "Truyền addLabels/removeLabels để thêm/xoá labels, clearLabels=true để xoá hết labels. " +
    "Truyền dueDate để đổi/gỡ deadline ('clear' = gỡ). " +
    "Truyền summary để đổi tiêu đề (title). Truyền description để replace toàn bộ mô tả. " +
    "Truyền chỉ comment (không transitionName) để thêm ghi chú mà không đổi status. " +
    "Truyền transitionName để chuyển trạng thái (kèm comment, resolution nếu cần). " +
    "Có thể combine assignee + labels + dueDate + summary + description + transitionName + comment trong cùng 1 call. " +
    "⚠️ PHẢI hỏi user xác nhận TRƯỚC KHI thay đổi assignee, labels, due date, summary, description, status hoặc thêm comment.",
    {
      issueKey: z.string().describe("Jira issue key, VD: 'PROJAI-123'"),
      dryRun: z.boolean().default(false)
        .describe("true = chỉ xem transitions khả dụng, không thay đổi gì"),
      assignee: z.string().optional()
        .describe(
          "Username muốn assign. " +
          "'unassigned' = gỡ assignee (set null). " +
          "Bỏ trống = không đổi assignee. " +
          "VD: 'nghiath', 'hieutv'. Hỗ trợ fuzzy match."
        ),
      addLabels: z.array(z.string().trim().min(1))
        .optional()
        .describe("Danh sách labels cần thêm. VD: ['backend', 'urgent']. Bỏ trống = không thêm."),
      removeLabels: z.array(z.string().trim().min(1))
        .optional()
        .describe("Danh sách labels cần xoá. Jira tự bỏ qua label không tồn tại."),
      clearLabels: z.boolean()
        .default(false)
        .describe("true = xoá toàn bộ labels. Nếu truyền cùng addLabels thì clear rồi set lại bằng addLabels."),
      dueDate: z.string()
        .regex(/^(\d{4}-\d{2}-\d{2}|clear)$/, "Format: YYYY-MM-DD hoặc 'clear'")
        .optional()
        .describe(
          "Ngày hết hạn mới, format YYYY-MM-DD. " +
          "'clear' = gỡ due date. " +
          "Bỏ trống = không đổi. " +
          "VD: '2026-06-15'."
        ),
      transitionName: z.string().optional()
        .describe("Tên trạng thái muốn chuyển. VD: 'In Progress', 'Done'. Bỏ trống nếu chỉ muốn comment."),
      resolution: z.string().optional()
        .describe("Resolution khi đóng task. VD: 'Done', 'Fixed'. Chỉ cần khi chuyển sang Done/Resolved."),
      comment: z.string().optional()
        .describe("Ghi chú kèm theo. Có thể dùng độc lập (không cần transitionName) hoặc kèm transition."),
      summary: z.string().trim().min(1).optional()
        .describe("Tiêu đề (title) mới cho issue. Replace toàn bộ. Bỏ trống = không đổi. ⚠️ PHẢI hỏi user xác nhận trước khi đổi."),
      description: z.string().min(1).optional()
        .describe("Mô tả mới (wiki markup). Replace TOÀN BỘ description cũ — không append. Muốn thêm nội dung: đọc get_issue_detail trước rồi gửi lại full text. ⚠️ PHẢI hỏi user xác nhận trước khi ghi đè."),
    },
    withErrorHandler("update_issue", async ({
      issueKey,
      dryRun,
      assignee,
      addLabels,
      removeLabels,
      clearLabels,
      dueDate,
      transitionName,
      resolution,
      comment,
      summary,
      description,
    }) => {
      // Case 1: dryRun — chỉ list transitions
      if (dryRun) {
        const transitions = await jira.getTransitions(issueKey);
        const list = transitions.map((t) => `  • ${t.name} (id: ${t.id})`).join("\n");
        return {
          content: [{
            type: "text",
            text: `Các transition khả dụng cho ${issueKey}:\n${list}` + getChainHint("update_issue"),
          }],
        };
      }

      // Case 2: không có gì để làm
      const hasLabelChanges = clearLabels || (addLabels?.length ?? 0) > 0 || (removeLabels?.length ?? 0) > 0;
      if (!transitionName && !comment && !assignee && !dueDate && !hasLabelChanges && !summary && !description) {
        return {
          content: [{
            type: "text",
            text: `⚠️ Không có thay đổi — truyền assignee, addLabels, removeLabels, clearLabels, dueDate, summary, description, transitionName, comment, hoặc dryRun=true.`,
          }],
        };
      }

      const labelConflict = findLabelConflict(addLabels, removeLabels);
      if (labelConflict) {
        throw new Error(
          `Label "${labelConflict}" xuất hiện trong cả addLabels và removeLabels. ` +
          "Hãy giữ label này ở một phía trước khi cập nhật."
        );
      }

      // Case 3: combine flow — assignee → labels → due date → transition → comment
      const reportLines: string[] = [`✅ Đã cập nhật thành công!`, `📌 Issue: ${issueKey}`];

      // Step A: Assignee (assign trước để pass workflow guards của transition)
      if (assignee) {
        if (assignee.toLowerCase() === "unassigned") {
          await jira.updateAssignee(issueKey, null);
          reportLines.push(`👤 Assignee: ❌ Đã gỡ assignee`);
        } else {
          await jira.updateAssignee(issueKey, assignee);
          reportLines.push(`👤 Assignee: ${assignee} (đã gán)`);
        }
      }

      // Step B: Labels
      if (hasLabelChanges) {
        await jira.updateLabels(issueKey, { add: addLabels, remove: removeLabels, clear: clearLabels });

        if (clearLabels && addLabels?.length) {
          reportLines.push(`🏷️ Labels: ❌ Xoá hết → ✅ Set [${addLabels.join(", ")}]`);
        } else if (clearLabels) {
          reportLines.push(`🏷️ Labels: ❌ Đã xoá toàn bộ`);
        } else {
          const labelParts: string[] = [];
          if (addLabels?.length) labelParts.push(`➕ ${addLabels.join(", ")}`);
          if (removeLabels?.length) labelParts.push(`➖ ${removeLabels.join(", ")}`);
          reportLines.push(`🏷️ Labels: ${labelParts.join(" | ")}`);
        }
      }

      // Step C: Due date (set trước transition để workflow rule thấy field đã update)
      if (dueDate) {
        if (dueDate === "clear") {
          await jira.updateDueDate(issueKey, null);
          reportLines.push(`📅 Due date: ❌ Đã gỡ`);
        } else {
          await jira.updateDueDate(issueKey, dueDate);
          const todayUtc = new Date().toISOString().slice(0, 10);
          if (dueDate < todayUtc) {
            reportLines.push(`📅 Due date: ${dueDate} (⚠️ đã qua so với hôm nay UTC ${todayUtc})`);
          } else {
            reportLines.push(`📅 Due date: ${dueDate}`);
          }
        }
      }

      // Step C2: Summary / Description (set trước transition để workflow rule thấy field đã update)
      if (summary !== undefined || description !== undefined) {
        await jira.updateFields(issueKey, { summary, description });
        if (summary !== undefined) reportLines.push(`✏️ Summary: "${summary}"`);
        if (description !== undefined) reportLines.push(`📝 Description: đã cập nhật (${description.length} ký tự)`);
      }

      // Step D: Transition (kèm comment + resolution nếu có)
      if (transitionName) {
        await jira.transitionIssue(issueKey, transitionName, { resolution, comment });
        reportLines.push(`🔄 Trạng thái mới: ${transitionName}`);
        if (resolution) reportLines.push(`✔️ Resolution: ${resolution}`);
        if (comment) reportLines.push(`💬 Comment: "${comment}"`);
      } else if (comment) {
        // Step E: Comment standalone (chỉ khi không có transition để tránh duplicate)
        await jira.addComment(issueKey, comment);
        reportLines.push(`💬 Comment: "${comment}"`);
      }

      return {
        content: [{ type: "text", text: reportLines.join("\n") + getChainHint("update_issue") }],
      };
    })
  );
}
