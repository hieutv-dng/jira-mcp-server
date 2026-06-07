---
title: "Bắt buộc resolution khi transition resolve (update_issue)"
description: "Hard-validation: chặn call update_issue khi transitionName chứa 'resolve' mà thiếu resolution"
status: pending
priority: P2
branch: "main"
tags: [jira, update_issue, validation]
blockedBy: []
blocks: []
created: "2026-05-29T09:41:00.470Z"
createdBy: "ck:plan"
source: skill
---

# Bắt buộc resolution khi transition resolve (update_issue)

## Overview

Tool `update_issue` hiện chỉ gửi `resolution` khi caller truyền explicit. Khi chuyển issue sang trạng thái "Resolved" mà quên resolution → issue treo "Unresolved", lệch filter/report "done". Thêm hard-validation **fail-fast**: nếu `transitionName` chứa `"resolve"` (case-insensitive) mà thiếu `resolution` → throw error ngay, không apply bất kỳ thay đổi nào.

Quyết định đã chốt (brainstorm):
- Chỉ pattern `"resolve"` bị bắt buộc — KHÔNG đụng `done`/`close`.
- Hard-block, KHÔNG soft-warning, KHÔNG auto-set resolution.
- Chỉ sửa `src/jira/tools/issue-tools.ts`; `client.ts` đã hỗ trợ resolution optional.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Implement](./phase-01-implement.md) | Pending |
| 2 | [Verify](./phase-02-verify.md) | Pending |

## Dependencies

Không có cross-plan dependency. Plan `260524-0120-update-labels` không trùng (field labels, khác concern).
