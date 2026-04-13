# Phase 02 — Sửa `src/shared/utils.ts`

## Context

- File: `src/shared/utils.ts` line 61–76
- `TOOL_CHAINING` map dùng tool name làm key
- Cần update 2 chỗ: key cũ + reference trong value

## Changes

### 1. Rename key `list_my_open_issues` → `list_issues`

```diff
- list_my_open_issues:
-   "→ Tiếp: `get_issue_detail` để đọc chi tiết task cần làm.",
+ list_issues:
+   "→ Tiếp: `get_issue_detail` để đọc chi tiết task cần làm.",
```

### 2. Update reference trong value của `update_issue_status`

```diff
  update_issue_status:
-   "→ Tiếp: Task đã hoàn tất! Hoặc `list_my_open_issues` để xem task tiếp theo.",
+   "→ Tiếp: Task đã hoàn tất! Hoặc `list_issues` để xem task tiếp theo.",
```

## Todo

- [ ] Rename key `list_my_open_issues` → `list_issues` (line 62)
- [ ] Update reference trong `update_issue_status` value (line 69)
