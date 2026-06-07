---
phase: 2
title: "Verify"
status: pending
priority: P2
effort: "15m"
dependencies: [1]
---

# Phase 2: Verify

## Overview

Xác minh validation hoạt động đúng. Repo **không có test framework** (chỉ `tsc`), nên verify = build + kiểm thử thủ công qua MCP Inspector.

## Requirements
- Functional: pass toàn bộ acceptance criteria dưới đây.
- Non-functional: không phát sinh TS error; không vỡ các path hiện có (comment-only, assignee-only, transition non-resolve).

## Implementation Steps

1. `npm run build` — đảm bảo `tsc` pass, không error.
2. `npm run inspect` — mở MCP Inspector, gọi `update_issue` thử các case ở bảng dưới (dùng issue thật trên Jira test, hoặc kiểm tra qua dryRun/đọc code path nếu không có issue thử).
3. Đọc lại diff `src/jira/tools/issue-tools.ts` xác nhận validation nằm trước Step A.

## Success Criteria

Acceptance criteria (bảng đối chiếu):

- [ ] `transitionName: "Resolved"`, thiếu `resolution` → **throw error**, KHÔNG mutate assignee/labels/dueDate.
- [ ] `transitionName: "Resolve Issue"`, `resolution: "Done"` → chạy bình thường, set resolution.
- [ ] `transitionName: "Done"`, thiếu `resolution` → **vẫn chạy** (ngoài diện bắt buộc).
- [ ] `transitionName: "In Progress"`, thiếu `resolution` → chạy bình thường.
- [ ] Chỉ `comment` / `assignee` (không `transitionName`) → chạy bình thường (validation không kích hoạt).
- [ ] `npm run build` pass.

## Risk Assessment

- Không có issue Jira thử → fallback đọc kỹ code path + verify logic nhánh. Đủ tin cậy vì thay đổi là pure guard clause, không gọi API mới.
