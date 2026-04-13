---
phase: 1
title: "Gom update_issue_status + get_available_transitions + add_comment → update_issue"
status: completed
priority: high
effort: M
---

# Phase 1: Tạo tool `update_issue`

## Overview

Gom 3 tools thành 1 tool `update_issue` đa năng:
- `transitionName` optional → chỉ comment nếu không truyền
- `dryRun` → chỉ trả danh sách transitions khả dụng

## Use Cases

| Scenario | Params |
|----------|--------|
| Xem transitions | `{ issueKey, dryRun: true }` |
| Chỉ comment | `{ issueKey, comment: "..." }` |
| Đổi status | `{ issueKey, transitionName: "In Progress" }` |
| Đổi status + comment + resolution | `{ issueKey, transitionName: "Done", resolution: "Fixed", comment: "..." }` |

## Implementation

### File: `src/jira/tools.ts`

**Xóa 3 tools:**
- Tool 4: `update_issue_status` (line 214-265)
- Tool 5: `get_available_transitions` (line 268-285)
- Tool 5b: `add_comment` (line 288-306)

**Thêm 1 tool mới `update_issue`:**

```typescript
server.tool(
  "update_issue",
  "Cập nhật Jira issue: chuyển trạng thái, thêm comment, hoặc xem transitions khả dụng. " +
  "Dùng dryRun=true để xem danh sách transitions mà không thay đổi gì. " +
  "Truyền chỉ comment (không transitionName) để thêm ghi chú mà không đổi status. " +
  "Truyền transitionName để chuyển trạng thái (kèm comment, resolution nếu cần). " +
  "⚠️ PHẢI hỏi user xác nhận TRƯỚC KHI thay đổi status hoặc thêm comment.",
  {
    issueKey: z.string().describe("Jira issue key, VD: 'VNPTAI-123'"),
    dryRun: z.boolean().default(false)
      .describe("true = chỉ xem transitions khả dụng, không thay đổi gì"),
    transitionName: z.string().optional()
      .describe("Tên trạng thái muốn chuyển. VD: 'In Progress', 'Done'. Bỏ trống nếu chỉ muốn comment."),
    resolution: z.string().optional()
      .describe("Resolution khi đóng task. VD: 'Done', 'Fixed'. Chỉ cần khi chuyển sang Done/Resolved."),
    comment: z.string().optional()
      .describe("Ghi chú kèm theo. Có thể dùng độc lập (không cần transitionName) hoặc kèm transition."),
  },
  handler // see logic below
);
```

**Handler logic:**

```typescript
withErrorHandler("update_issue", async ({ issueKey, dryRun, transitionName, comment, resolution }) => {
  // Case 1: dryRun — chỉ list transitions
  if (dryRun) {
    const transitions = await jiraClient.getTransitions(issueKey);
    const list = transitions.map((t) => `  • ${t.name} (id: ${t.id})`).join("\n");
    return {
      content: [{
        type: "text",
        text: `Các transition khả dụng cho ${issueKey}:\n${list}` + getChainHint("update_issue"),
      }],
    };
  }

  // Case 2: chỉ comment (không transition)
  if (!transitionName && comment) {
    await jiraClient.addComment(issueKey, comment);
    return {
      content: [{
        type: "text",
        text: `✅ Đã thêm comment vào ${issueKey}:\n\n> ${comment}` + getChainHint("update_issue"),
      }],
    };
  }

  // Case 3: không có gì để làm
  if (!transitionName && !comment) {
    return {
      content: [{
        type: "text",
        text: `⚠️ Không có thay đổi — truyền transitionName để đổi status, comment để thêm ghi chú, hoặc dryRun=true để xem transitions.`,
      }],
    };
  }

  // Case 4: transition (± comment, ± resolution)
  const transitions = await jiraClient.getTransitions(issueKey);
  const available = transitions.map((t) => `"${t.name}"`).join(", ");

  await jiraClient.transitionIssue(issueKey, transitionName!, { resolution, comment });

  const lines = [
    `✅ Đã cập nhật thành công!`,
    `📌 Issue: ${issueKey}`,
    `🔄 Trạng thái mới: ${transitionName}`,
  ];
  if (resolution) lines.push(`✔️ Resolution: ${resolution}`);
  if (comment) lines.push(`💬 Comment: "${comment}"`);
  lines.push("", `💡 Các transition có thể dùng: ${available}`);

  return {
    content: [{ type: "text", text: lines.join("\n") + getChainHint("update_issue") }],
  };
})
```

## Todo

- [x] Xóa `update_issue_status` tool
- [x] Xóa `get_available_transitions` tool
- [x] Xóa `add_comment` tool
- [x] Thêm `update_issue` tool với handler đa năng
- [x] Verify handler logic covers all 4 cases

## Success Criteria

- 3 tools cũ đã xóa
- `update_issue` hoạt động cho cả 4 use cases
- Build pass không lỗi
