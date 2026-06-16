---
phase: 2
title: "Docs"
status: complete
priority: P3
effort: "15m"
dependencies: [1]
---

# Phase 2: Docs

## Overview

Cập nhật mô tả tool `update_issue` trong tài liệu để phản ánh khả năng sửa description + summary(title).

## Requirements

- Functional: README + CLAUDE.md mô tả đúng năng lực mới của `update_issue`.
- Non-functional: chỉ sửa phần liên quan, không viết lại doc.

## Related Code Files

- Modify: `README.md` — phần liệt kê/mô tả tool `update_issue`
- Modify: `CLAUDE.md` — dòng "Project Overview" liệt kê 8 tools + mô tả update_issue (nếu có)

## Implementation Steps

1. Grep `update_issue` trong `README.md` → cập nhật mô tả: bổ sung "sửa description (mô tả) và summary (tiêu đề)".
2. `CLAUDE.md` dòng Project Overview: kiểm tra mô tả `update_issue`; nếu có liệt kê khả năng thì bổ sung description/summary. Số lượng tool không đổi (vẫn 8 tools — chỉ mở rộng update_issue, không thêm tool mới).
3. Nếu README có bảng tham số tool `update_issue` → thêm 2 dòng `description`, `summary`.

## Success Criteria

- [ ] README mô tả `update_issue` nhắc tới sửa description + summary.
- [ ] CLAUDE.md nhất quán (không sai số lượng tool, không claim thừa).
- [ ] Không tạo doc mới thừa.

## Risk Assessment

- Thấp. Chỉ sửa text. Rủi ro duy nhất: bỏ sót chỗ mô tả → grep `update_issue` toàn repo để chắc chắn.
