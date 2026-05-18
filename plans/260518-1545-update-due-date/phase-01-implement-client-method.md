---
phase: 1
title: "Implement Client Method"
status: completed
priority: P2
effort: "15m"
dependencies: []
---

# Phase 1: Implement Client Method

## Overview

Thêm method `updateDueDate(issueKey, dueDate | null)` vào `JiraClient`. Mirror pattern `updateAssignee`. Dùng `PUT /issue/{key}` với `fields.duedate`.

## Requirements

- Functional: set due date string `YYYY-MM-DD` hoặc clear (null)
- Non-functional: reuse axios instance, lỗi đi qua interceptor hiện có

## Architecture

```
update_issue handler → jira.updateDueDate(key, value | null)
                        ↓
                       PUT /issue/{key} { fields: { duedate: value | null } }
                        ↓
                       Jira API
```

`null` body → Jira clear field (chuẩn REST v2).

## Related Code Files

- Modify: `src/jira/client.ts` — chèn method sau `updateAssignee` (~line 326)

## Implementation Steps

1. Mở `src/jira/client.ts`, locate `updateAssignee` (line ~308)
2. Sau method `updateAssignee`, thêm:

```ts
/**
 * Cập nhật due date của issue.
 * @param issueKey - VD: "PROJAI-123"
 * @param dueDate  - "YYYY-MM-DD" hoặc null (= clear)
 */
async updateDueDate(issueKey: string, dueDate: string | null): Promise<void> {
  await this.http.put(`/issue/${issueKey}`, {
    fields: { duedate: dueDate },
  });
}
```

3. Run `npm run build` — verify compile pass.

## Success Criteria

- [ ] `npm run build` không lỗi
- [ ] Method visible từ `jira.updateDueDate(...)` trong TypeScript intellisense
- [ ] Không thay đổi public API khác (additive only)

## Risk Assessment

- **Low**: chỉ thêm method, không sửa existing logic
- **Edge**: project workflow có rule cấm null/past-date → Jira API reject; axios interceptor (line 57) format error chuẩn
