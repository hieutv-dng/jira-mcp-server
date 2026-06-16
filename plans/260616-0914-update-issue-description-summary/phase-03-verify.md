---
phase: 3
title: "Verify"
status: complete
priority: P2
effort: "20m"
dependencies: [1]
---

# Phase 3: Verify

## Overview

Build TypeScript và verify thủ công tool `update_issue` sửa được description + summary.

## Requirements

- Functional: tool chạy đúng với issue thật trên Jira Server/DC.
- Non-functional: không lỗi build, không regression call cũ.

## Related Code Files

- Run: `src/` (build → `dist/`)

## Implementation Steps

1. `npm run build` — TypeScript compile pass, không type error.
2. `npm run inspect` — mở MCP Inspector.
3. Test cases trên 1 issue test (dùng issue không quan trọng):
   - `update_issue({ issueKey, dryRun: true })` → vẫn list transitions (không regression).
   - `update_issue({ issueKey, summary: "Test title mới" })` → title đổi, report `🏷️ Summary`.
   - `update_issue({ issueKey, description: "Mô tả test\n\n* dòng 1\n* dòng 2" })` → description replace, giữ xuống dòng/markup, report `📝 Description (N ký tự)`.
   - `update_issue({ issueKey, summary, description, comment })` combine → tất cả áp dụng, report đủ dòng.
   - `update_issue({ issueKey })` (rỗng) → trả message guard "không có thay đổi" có nhắc description/summary.
4. Mở issue trên Jira UI xác nhận description/summary đúng như gửi.

## Success Criteria

- [ ] `npm run build` pass.
- [ ] Sửa summary thành công, hiển thị đúng trên Jira.
- [ ] Sửa description thành công, giữ format wiki markup.
- [ ] Combine flow áp dụng đủ thay đổi.
- [ ] Call cũ (dryRun, assignee, labels...) không regression.

## Risk Assessment

- Cần issue test thật + PAT hợp lệ. Nếu không có quyền edit field → Jira trả 403, error interceptor đã format rõ.
- Wiki markup hiển thị: Jira render markup khi lưu — kiểm tra trên UI để chắc không bị double-escape.
