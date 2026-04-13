---
title: "Consolidate Jira Tools: 9 → 6"
description: >
  Gom 3 cặp tools thừa: (update_issue_status + get_available_transitions + add_comment) → update_issue,
  (create_issue + get_create_meta) → create_issue với dryRun. Giảm tool count, giữ nguyên chức năng.
status: completed
priority: medium
effort: M (2-4h)
branch: goconnect-channel
tags: [jira, mcp, refactor, tools]
created: 2026-03-31T11:05:00+07:00
completed: 2026-03-31T11:25:00+07:00
---

# Plan: Consolidate Jira Tools 9 → 6

## Mục tiêu

Giảm 9 tools xuống 6 bằng cách gom các tools liên quan chặt:

| Gom | Tools cũ | Tool mới |
|-----|----------|----------|
| A | `update_issue_status` + `get_available_transitions` + `add_comment` | `update_issue` |
| B | `create_issue` + `get_create_meta` | `create_issue` (thêm `dryRun`) |

Tools giữ nguyên: `list_issues`, `get_issue_detail`, `log_work`, `manage_jira_pat`

## Quyết định kiến trúc

- **`dryRun` pattern** thay cho tools chỉ-để-xem-trước (get_available_transitions, get_create_meta)
- **`transitionName` optional** trong `update_issue` — cho phép chỉ comment mà không đổi status
- **Không backward compat** — rename thẳng, ko alias (giống quyết định ở plan refactor-list-issues)
- **TOOL_CHAINING** cập nhật theo tool names mới

## Files liên quan

| File | Thay đổi |
|------|----------|
| `src/jira/tools.ts` | Xóa 3 tools cũ, tạo 2 tools mới (`update_issue`, `create_issue` + dryRun) |
| `src/shared/utils.ts` | Cập nhật `TOOL_CHAINING` map — xóa keys cũ, thêm keys mới |
| `src/jira/client.ts` | Không thay đổi — tất cả API methods giữ nguyên |
| `src/jira/formatter.ts` | Cập nhật references tới tool names cũ trong hint text |

## Phases

| # | Phase | Status | File |
|---|-------|--------|------|
| 1 | Gom `update_issue` | Completed | [phase-01-update-issue.md](./phase-01-update-issue.md) |
| 2 | Gom `create_issue` + dryRun | Completed | [phase-02-create-issue-dryrun.md](./phase-02-create-issue-dryrun.md) |
| 3 | Cập nhật TOOL_CHAINING + formatter refs | Completed | [phase-03-chaining-and-refs.md](./phase-03-chaining-and-refs.md) |
| 4 | Build & Verify | Completed | [phase-04-build-verify.md](./phase-04-build-verify.md) |

## Dependencies

- Không có dependency ngoài
- Sau deploy cần restart MCP server
