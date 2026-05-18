---
phase: 3
title: "Update Docs"
status: completed
priority: P3
effort: "20m"
dependencies: [2]
---

# Phase 3: Update Docs

## Overview

Sync docs với feature mới: README, codebase-summary, project-overview-pdr. Bump version `1.3.0` trong package.json + README header.

## Requirements

- README mô tả `update_issue` có due date capability
- Codebase summary note method `updateDueDate`
- Project overview bump version
- Example trong README ví dụ set/clear due date

## Architecture

N/A — chỉ doc edits.

## Related Code Files

- Modify: `README.md` — section Tools Reference + example
- Modify: `docs/codebase-summary.md` — note feature
- Modify: `docs/project-overview-pdr.md` — version note
- Modify: `package.json` — version 1.2.0 → 1.3.0
- Modify: `CLAUDE.md` (root) — cập nhật tool list nếu cần (8 tools không đổi, chỉ mở rộng capability)

## Implementation Steps

1. **package.json** — bump version:

```json
"version": "1.3.0"
```

2. **README.md** — locate bảng phiên bản (line ~5-10), update:

```markdown
| **Phiên bản** | v1.3.0 |
```

3. **README.md** — locate row `update_issue` trong Tools Reference (line ~112):

```markdown
| **update_issue** | Assign, transition, comment, **set/clear due date** | Cập nhật trạng thái, deadline |
```

4. **README.md** — thêm example sau ví dụ "Chuyển sang Done" (line ~152):

```markdown
# Update due date
update_issue({
  issueKey: "PROJ-123",
  dueDate: "2026-06-30"
})

# Gỡ due date
update_issue({
  issueKey: "PROJ-123",
  dueDate: "clear"
})
```

5. **docs/codebase-summary.md** — 2 update cụ thể (per validation decision 4):
   - **Line 172** (table row update_issue): thêm `dueDate?` vào input column và `updateDueDate` vào output column. Sửa từ:
     ```
     | `update_issue` | issue-tools.ts | `{key, assignee?, transitionName?, comment?, resolution?, dryRun?}` | updateAssignee → transitionIssue + addComment (combine flow) | **CONFIRM** |
     ```
     thành:
     ```
     | `update_issue` | issue-tools.ts | `{key, assignee?, dueDate?, transitionName?, comment?, resolution?, dryRun?}` | updateAssignee → updateDueDate → transitionIssue + addComment (combine flow) | **CONFIRM** |
     ```
   - **Client methods section**: thêm bullet `updateDueDate(key, value \| null)` — set/clear due date qua `PUT /issue/{key}` với `fields.duedate`. Sentinel `'clear'` ở tool layer chuyển thành `null` ở client layer.
   - Cập nhật LOC count `issue-tools.ts (258 LOC)` ở line 25 → giá trị mới sau khi build (~290 LOC)

6. **docs/project-overview-pdr.md** — bump version hoặc thêm changelog entry v1.3.0.

7. **CLAUDE.md** (root project) — verify `## Project Overview` section. Hiện liệt kê 8 tools by name, không mô tả param cụ thể → không cần đổi.

<!-- Updated: Validation Session 1 — pin codebase-summary.md:172 row + client methods bullet -->

## Success Criteria

- [ ] README hiển thị v1.3.0 và example set/clear due date
- [ ] Tools Reference table phản ánh capability mới của `update_issue`
- [ ] codebase-summary.md có entry cho `updateDueDate`
- [ ] package.json version = 1.3.0
- [ ] Grep `update_issue` trong docs/ trả về kết quả nhất quán (không có chỗ nào nói "không hỗ trợ due date")

## Risk Assessment

- **Low**: pure doc edits
- **Edge**: nếu docs có drift trước đó, cần ghi nhận trong commit message thay vì sửa lan man ngoài scope
