---
phase: 3
title: "Cập nhật TOOL_CHAINING + formatter references"
status: completed
priority: medium
effort: S
---

# Phase 3: Cập nhật TOOL_CHAINING + formatter refs

## File: `src/shared/utils.ts`

Cập nhật `TOOL_CHAINING` map — xóa keys cũ, sửa values:

```typescript
export const TOOL_CHAINING: Record<string, string> = {
  list_issues:
    "→ Tiếp: `get_issue_detail` để đọc chi tiết task cần làm.",
  get_issue_detail:
    "→ Tiếp: `log_work` để ghi nhận effort, hoặc `update_issue` để chuyển trạng thái / thêm comment.",
  log_work:
    "→ Tiếp: `update_issue` để chuyển trạng thái task.",
  update_issue:
    "→ Tiếp: Task đã hoàn tất! Hoặc `list_issues` để xem task tiếp theo.",
  create_issue:
    "→ Tiếp: `get_issue_detail` để xem issue vừa tạo.",
};
```

**Xóa keys:** `update_issue_status`, `get_available_transitions`, `add_comment`

## File: `src/jira/formatter.ts`

Tìm references tới tool names cũ trong hint text và cập nhật:

- Line 57: `get_issue_detail` — giữ nguyên
- Line 65: `update_issue_status` → `update_issue`
- Line 148: `generate_gwt_description` — tool khác, giữ nguyên
- Line 163-168: Các tool names ở AI hints — kiểm tra có reference nào cần sửa

## Todo

- [x] Cập nhật `TOOL_CHAINING` trong `src/shared/utils.ts`
- [x] Sửa references trong `src/jira/formatter.ts` (line 65)
- [x] Grep toàn bộ codebase cho `update_issue_status`, `get_available_transitions`, `add_comment` — đảm bảo không còn sót
- [x] Fixed `mcp-config.json` requireConfirmation (removed stale tool names, added update_issue)
- [x] Fixed stale `list_my_open_issues` reference in manage_jira_pat tool
- [x] Fixed stale `get_create_meta` references in client.ts error messages
