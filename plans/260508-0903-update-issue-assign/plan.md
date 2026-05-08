---
title: "update_issue assign/unassign support"
description: "Bổ sung khả năng assign/unassign user vào tool update_issue, combine tự do với transition + comment"
status: in_progress
priority: P2
branch: "main"
tags: [jira, mcp, tool-extension]
blockedBy: []
blocks: []
created: "2026-05-08T02:05:12.709Z"
createdBy: "ck:plan"
source: skill
---

# update_issue assign/unassign support

## Overview

Tool `update_issue` hiện thiếu khả năng assign/unassign user. Bổ sung field `assignee` (optional, fuzzy-matched) để combine tự do với transition + comment trong cùng 1 call. Tái dùng `resolveAssignee()` đã có trong client.ts (DRY). Backward compatible 100%.

**Brainstorm reference:** [`plans/reports/brainstorm-260508-0903-update-issue-assign.md`](../reports/brainstorm-260508-0903-update-issue-assign.md)

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Implement](./phase-01-implement.md) | Completed |
| 2 | [Validate](./phase-02-validate.md) | Pending (user testing) |

## Key Decisions

- **Endpoint:** `PUT /issue/{key}` với `fields.assignee` (đồng nhất, dễ extend)
- **Reserved keyword:** `assignee="unassigned"` → set null
- **Order of ops:** assignee → transition → comment (assign trước để pass workflow guards)
- **Project key:** parse từ issueKey (`"PROJAI-123".split("-")[0]`)

## Files Modified

- `src/jira/client.ts` — `updateAssignee()` method (~25 lines)
- `src/jira/tools.ts` — extend `update_issue` schema + handler + description (~20 lines)

## Out of Scope (YAGNI)

- Bulk assign nhiều issues
- "me"/`currentUser()` shortcut
- List assignable users trong dryRun của `update_issue`
- History/audit khi đổi assignee

## Dependencies

Không có cross-plan dependency.
