---
phase: 3
title: "Update docs and verify"
status: pending
priority: P3
effort: "30m"
dependencies: [2]
---

# Phase 3: Update docs and verify

## Overview

Cập nhật README, codebase-summary, system-architecture cho tool count 7→8 và directory structure mới. Chạy verification end-to-end.

## Requirements

- **Functional:** Docs khớp với code thực tế
- **Non-functional:** Tone tiếng Việt nhất quán với README hiện tại, concise

## Architecture

Không thay đổi code. Chỉ cập nhật markdown:
- `README.md` — tools table, ví dụ usage, project structure
- `docs/codebase-summary.md` — cập nhật directory structure + tools list
- `docs/system-architecture.md` — cập nhật tool diagram nếu có
- `CLAUDE.md` — tool count 7→8

## Related Code Files

- **Modify:** `README.md`
- **Modify:** `docs/codebase-summary.md`
- **Modify:** `docs/system-architecture.md`
- **Modify:** `CLAUDE.md`

## Implementation Steps

### 1. README.md updates

**Section "Tính năng":**
```diff
- **7 Tools:** get_current_user, list_issues, get_issue_detail, log_work, list_worklogs, update_issue, create_issue
+ **8 Tools:** get_current_user, list_issues, get_issue_detail, log_work, list_worklogs, delete_worklog, update_issue, create_issue
```

**Tools Reference table:** thêm row
```markdown
| **delete_worklog** | Xoá worklog (batch + dryRun + best-effort) | Sửa log nhầm |
```

**Ví dụ nhanh:** thêm
```markdown
# Xem worklog detail để lấy ID
list_worklogs({ detail: true })

# Preview trước khi xoá
delete_worklog({
  issueKey: "PROJ-123",
  worklogIds: ["12345", "12346"],
  dryRun: true
})

# Xoá thật sau khi user confirm
delete_worklog({
  issueKey: "PROJ-123",
  worklogIds: ["12345", "12346"]
})
```

<!-- Updated: Validation Session 1 - 5-file structure -->
**Project Structure section:** update
```diff
src/
├── index.ts
├── jira/
│   ├── client.ts
-│   ├── tools.ts
+│   ├── tools/
+│   │   ├── index.ts              # barrel + registerJiraTools
+│   │   ├── user-tools.ts         # get_current_user
+│   │   ├── issue-tools.ts        # list_issues, get_issue_detail, update_issue
+│   │   ├── create-issue-tool.ts  # create_issue (riêng do schema lớn)
+│   │   └── worklog-tools.ts      # 3 worklog tools (gồm delete_worklog)
│   └── formatter.ts
```

### 2. CLAUDE.md updates

```diff
- MCP Server providing Jira integration for Claude AI. Targets Jira Server/Data Center (not Cloud) with PAT authentication. 7 tools: get_current_user, list_issues, get_issue_detail, log_work, list_worklogs, update_issue, create_issue.
+ MCP Server providing Jira integration for Claude AI. Targets Jira Server/Data Center (not Cloud) with PAT authentication. 8 tools: get_current_user, list_issues, get_issue_detail, log_work, list_worklogs, delete_worklog, update_issue, create_issue.
```

**Core modules section:**
```diff
-- `src/jira/tools.ts` — Tool registration, Zod schemas, request handlers
+- `src/jira/tools/` — Tool registration split theo concern (index, user-tools, issue-tools, create-issue-tool, worklog-tools)
```

**Adding New Tools steps:** update step 2/3 path từ `src/jira/tools.ts` sang `src/jira/tools/{group}-tools.ts`. Note: tool `create_issue` ở file riêng `create-issue-tool.ts`.

### 3. docs/codebase-summary.md

Cập nhật directory tree + tools count. Read file trước, sửa các section liên quan.

### 4. docs/system-architecture.md

Nếu có sơ đồ liệt kê tools — thêm `delete_worklog`. Nếu có module diagram — split `tools.ts` thành 4 box (user/issue/create-issue/worklog).

### 5. Final verification

```bash
npm run build      # Build sạch
npm run inspect    # Load tools
```

Test full flow end-to-end:
1. `get_current_user` → lấy username
2. `list_worklogs({ detail: true })` → lấy 1 worklogId thực
3. `delete_worklog({ issueKey, worklogIds: [id], dryRun: true })` → preview
4. `delete_worklog({ issueKey, worklogIds: [id] })` → xoá thật
5. `list_worklogs({ detail: true })` → verify entry đã biến mất

Manual verify trên Jira UI: worklog đã xoá khỏi issue.

### 6. Optional: bump version

Trong `package.json`:
```diff
- "version": "1.1.0",
+ "version": "1.2.0",
```

Reason: thêm tool mới = minor bump per semver.

## Success Criteria

- [ ] README.md tool count 7→8, có ví dụ delete_worklog
- [ ] README.md project structure phản ánh `tools/` directory với 5 file (gồm create-issue-tool.ts)
- [ ] CLAUDE.md tool count 7→8, core modules section đúng
- [ ] docs/codebase-summary.md cập nhật 5-file structure
- [ ] docs/system-architecture.md cập nhật (nếu có tool diagram)
- [ ] End-to-end test pass: list detail → dryRun → real delete → verify
- [ ] `npm run build` pass cuối phase
- [ ] (Optional) version bump v1.1.0 → v1.2.0

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Docs nói 8 tool nhưng code chỉ load 7 | `npm run inspect` count tools trước khi commit |
| Ví dụ delete_worklog sai syntax | Test ví dụ thực tế trong inspect trước khi paste vào README |
| codebase-summary.md đã có diagram cũ | Read file trước, replace toàn bộ section relevant không patch lẻ tẻ |

## Next Steps

→ Plan complete. Có thể commit + tạo PR hoặc tiếp tục với plan khác.
