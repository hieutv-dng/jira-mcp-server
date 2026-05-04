---
phase: 3
title: "Test & Docs"
status: completed
priority: P2
effort: "30m"
dependencies: [2]
---

# Phase 3: Test & Docs

## Overview

Manual test qua MCP Inspector + cập nhật README và CLAUDE.md. Project này không có test runner — verify bằng inspect + smoke test với Jira thật.

## Requirements

- **Functional:**
  - 4 scenarios pass qua MCP Inspector
  - README + CLAUDE.md update tool count: 6 → 7, list tool mới
- **Non-functional:**
  - `npm run build` clean
  - Không break tools cũ

## Architecture

N/A — pure validation + docs.

## Related Code Files

- Read: `dist/` after build (artifact check)
- Modify: `README.md` — thêm `list_worklogs` vào tool list
- Modify: `CLAUDE.md` — update tool count + tên tool ở section "Project Overview"

## Implementation Steps

### 3.1. Build & Inspect

1. `npm run build` — verify zero errors.
2. `npm run inspect` — mở MCP Inspector.
3. Test 4 scenarios:

| # | Input | Expected |
|---|-------|----------|
| 1 | `list_worklogs {}` | Bảng worklog tháng này của current user |
| 2 | `list_worklogs { dateFrom: "2026-04-01", dateTo: "2026-04-07" }` | Chỉ tuần 1/4 |
| 3 | `list_worklogs { username: "<other-user>" }` | Worklog của user khác (nếu có quyền) |
| 4 | `list_worklogs { dateFrom: "2025-01-01", dateTo: "2025-01-02" }` (range không có data) | Empty state message |

### 3.2. Edge cases verify

- Username không tồn tại → JQL trả 0 issues → empty message (không crash)
- Issue không còn worklog match (đã xóa) → loại khỏi bảng (filter `totalSeconds > 0`)
- Date format sai → Jira trả lỗi JQL → caught by `withErrorHandler` → format error rõ ràng

### 3.3. Update README

Trong `README.md`, tìm section liệt kê 6 tools. Thêm:
```md
- **list_worklogs** — Truy vấn tổng giờ đã logwork của 1 user trong khoảng thời gian, group theo issue
```
Update tool count từ 6 → 7.

### 3.4. Update CLAUDE.md

Trong `CLAUDE.md` section `## Project Overview`:
```
6 tools: get_current_user, list_issues, get_issue_detail, log_work, update_issue, create_issue.
```
→
```
7 tools: get_current_user, list_issues, get_issue_detail, log_work, list_worklogs, update_issue, create_issue.
```

### 3.5. Commit

Conventional commit:
```
feat(jira): add list_worklogs tool to query logged hours per issue
```

## Success Criteria

- [ ] 4 scenarios qua MCP Inspector trả output đúng kỳ vọng (manual smoke test — pending user run)
- [x] Empty state hiển thị đúng (không crash) — formatter handles `rows.length === 0`
- [x] README + CLAUDE.md cập nhật count + tên tool
- [x] `npm run build` clean
- [ ] Commit gọn, không lẫn unrelated changes (pending user approval)

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Không có Jira instance để smoke test | Tối thiểu run inspect + verify schema; user smoke test sau |
| Doc drift (README vs CLAUDE.md) | Update cả 2 trong cùng commit |
