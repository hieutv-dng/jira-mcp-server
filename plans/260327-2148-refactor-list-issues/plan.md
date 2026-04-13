---
title: "Refactor list_my_open_issues → list_issues"
description: >
  Đổi tên tool và mở rộng khả năng filter: thêm assigneeFilter, roleFilter,
  fix customJql thành full override (không inject currentUser()).
status: done
priority: medium
effort: S (< 2h)
branch: feat/refactor-list-issues
tags: [jira, mcp, tool, refactor]
created: 2026-03-27T21:48:00+07:00
---

# Plan: Refactor `list_my_open_issues` → `list_issues`

## Mục tiêu

Mở rộng tool lấy danh sách Jira issues để hỗ trợ:
1. Xem issues của bất kỳ user nào (không chỉ `currentUser()`)
2. Lọc theo role: `assignee` hoặc `reporter` (không support `watcher` — JQL phức tạp hơn)
3. Lọc theo status: `statusFilter` (optional, multi-value, default = open issues nếu không truyền)
4. `customJql` là full override — không inject thêm gì

## Quyết định kiến trúc

- **Không giữ backward compatibility** — rename thẳng, không alias
- **Không có client nào** đang gọi `list_my_open_issues` theo tên cứng
- **Default behavior** (không truyền params): fallback `assignee = currentUser()` — giữ nguyên behavior cũ
- **customJql** khi truyền: full override, không append gì thêm
- **`assigneeFilter`**: nhận `username` string (Jira Server format, ví dụ: `"john.doe"`) — không phải accountId
- **`statusFilter`**: optional, array of string (ví dụ: `["Open", "In Progress"]`); default = chỉ lấy open issues (giữ behavior cũ)

## Files liên quan

| File | Thay đổi |
|------|----------|
| `src/jira/tools.ts` | Rename tool, thêm params, fix JQL logic |
| `src/shared/utils.ts` | Sửa **2 chỗ** trong `TOOL_CHAINING`: (1) key `list_my_open_issues` → `list_issues` (line 62), (2) value của `update_issue_status` hint cũng nhắc tới `list_my_open_issues` → `list_issues` (line 69) |

## Phases

| # | Phase | Status | File |
|---|-------|--------|------|
| 1 | Sửa `tools.ts` | ✅ Done | [phase-01-tools-refactor.md](./phase-01-tools-refactor.md) |
| 2 | Sửa `utils.ts` | ✅ Done | [phase-02-utils-update.md](./phase-02-utils-update.md) |
| 3 | Build & Verify | ✅ Done | [phase-03-build-verify.md](./phase-03-build-verify.md) |

## Dependencies

- Không có dependency ngoài — thay đổi nội bộ hoàn toàn
- Sau khi deploy, cần restart MCP server để tool mới có hiệu lực
