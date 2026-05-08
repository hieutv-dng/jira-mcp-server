---
phase: 2
title: "Validate"
status: pending
priority: P2
effort: "30m"
dependencies: [1]
---

# Phase 2: Validate

## Overview

Build TypeScript + chạy MCP Inspector test 4 use cases chính + 3 backward-compat cases để đảm bảo Phase 1 không phá vỡ behavior cũ.

## Requirements

### Functional
- 4 cases mới hoạt động: assign, unassign, combine assign+transition, combine assign+transition+comment
- 3 cases cũ vẫn pass: dryRun, comment-only, transition+comment
- Error case: username sai → trả top-3 suggestions

### Non-functional
- Build clean (0 TS errors)
- Tool description hiển thị đúng trong MCP Inspector

## Architecture

Test qua MCP Inspector (`npm run inspect`) — yêu cầu Jira server thực + PAT trong `.env.local`.

## Related Code Files

Không tạo/sửa code mới. Chỉ verify Phase 1.

## Implementation Steps

### Step 1 — Build

```bash
npm run build
```

Expect: 0 errors. `dist/jira/client.js` + `dist/jira/tools.js` updated.

### Step 2 — Khởi động MCP Inspector

```bash
npm run inspect
```

Truy cập UI inspector → tool `update_issue`.

### Step 3 — Test cases mới

**Case A: Assign user mới**
```json
{ "issueKey": "PROJ-123", "assignee": "nghiath" }
```
Expect: `✅ Đã cập nhật thành công! ... 👤 Assignee: nghiath (đã gán)`. Verify trên Jira UI.

**Case B: Unassign**
```json
{ "issueKey": "PROJ-123", "assignee": "unassigned" }
```
Expect: `👤 Assignee: ❌ Đã gỡ assignee`. Verify Jira UI assignee = Unassigned.

**Case C: Combine assign + transition**
```json
{ "issueKey": "PROJ-123", "assignee": "hieutv", "transitionName": "In Progress" }
```
Expect: report có cả 2 dòng `👤 Assignee` và `🔄 Trạng thái mới`.

**Case D: Combine assign + transition + comment**
```json
{ "issueKey": "PROJ-123", "assignee": "hieutv", "transitionName": "In Progress", "comment": "Bắt đầu làm" }
```
Expect: report có 3 dòng. Comment được attach vào transition (không tạo comment riêng).

### Step 4 — Test backward compat

**Case E: dryRun (không assignee)**
```json
{ "issueKey": "PROJ-123", "dryRun": true }
```
Expect: list transitions như cũ.

**Case F: Comment-only (không assignee, không transition)**
```json
{ "issueKey": "PROJ-123", "comment": "Test comment" }
```
Expect: `✅ ... 💬 Comment: "Test comment"`.

**Case G: Transition-only (không assignee)**
```json
{ "issueKey": "PROJ-123", "transitionName": "Done", "resolution": "Fixed" }
```
Expect: report có status + resolution, không có assignee line.

### Step 5 — Test error case

**Case H: Username sai**
```json
{ "issueKey": "PROJ-123", "assignee": "khongtontai_xyz" }
```
Expect: error message từ `resolveAssignee` chứa top-3 suggestions.

### Step 6 — Verify tool description

Trong MCP Inspector, hover tool `update_issue` → description chứa:
- "assign/unassign user"
- Warning "⚠️ PHẢI hỏi user xác nhận"

### Step 7 — (Tùy chọn) Manual smoke test trong Claude Desktop

Restart Claude Desktop → thử prompt: "Assign issue PROJ-123 cho nghiath và chuyển sang In Progress". Verify Claude gọi `update_issue` với cả 2 fields.

## Success Criteria

- [ ] `npm run build` exit code 0
- [ ] Cases A-D pass đúng expected output
- [ ] Cases E-G (backward compat) vẫn pass
- [ ] Case H trả error message có top-3 suggestions
- [ ] Tool description trong inspector chứa "assign/unassign user" + warning
- [ ] Verify thực tế trên Jira UI: assignee thay đổi đúng

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Không có Jira server để test | Skip Step 2-7, chỉ giữ Step 1 (build); test sẽ làm khi user có sẵn server |
| Workflow guard chặn transition | Báo user; không phải bug của tool |
| Case D có thể tạo duplicate comment nếu logic sai | Đã đảm bảo trong Phase 1: chỉ `addComment()` standalone khi `!transitionName` |

## Rollback Plan

Nếu phát hiện regression:
```bash
git checkout src/jira/client.ts src/jira/tools.ts
npm run build
```
