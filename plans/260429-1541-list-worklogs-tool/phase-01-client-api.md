---
phase: 1
title: "Client API"
status: completed
priority: P1
effort: "30m"
dependencies: []
---

# Phase 1: Client API

## Overview

Bổ sung method `getIssueWorklogs(issueKey)` vào `JiraClient` để fetch danh sách worklog entries của 1 issue. Tái dùng `searchIssues()` đã có cho JQL search.

## Requirements

- **Functional:**
  - `getIssueWorklogs(key)` gọi `GET /issue/{key}/worklog`
  - Trả về raw `worklogs` array với fields: `id`, `author.{name,displayName}`, `started`, `timeSpent`, `timeSpentSeconds`, `comment`
- **Non-functional:**
  - Tái dùng axios instance + interceptor đã có
  - Không thêm dependency mới

## Architecture

```
JiraClient
├─ getIssueWorklogs(issueKey: string)
│   GET /issue/{key}/worklog
│   → { worklogs: WorklogEntry[], total, maxResults, startAt }
```

**WorklogEntry shape (Jira Server v2):**
```ts
{
  id: string;
  author: { name: string; displayName: string; key: string };
  started: string;          // "2026-04-15T09:00:00.000+0700"
  timeSpent: string;        // "2h 30m"
  timeSpentSeconds: number; // 9000
  comment?: string;
}
```

## Related Code Files

- Modify: `src/jira/client.ts` — thêm method `getIssueWorklogs` ở section `// ─── WORKLOG ──────`

## Implementation Steps

1. Mở `src/jira/client.ts`. Tìm method `addWorklog` (line ~198).
2. Bên dưới `addWorklog`, thêm method mới:
   ```ts
   /**
    * Lấy toàn bộ worklog entries của 1 issue.
    * Jira Server endpoint: GET /issue/{key}/worklog
    */
   async getIssueWorklogs(issueKey: string) {
     const res = await this.http.get(`/issue/${issueKey}/worklog`);
     return res.data as {
       worklogs: Array<{
         id: string;
         author: { name: string; displayName: string; key: string };
         started: string;
         timeSpent: string;
         timeSpentSeconds: number;
         comment?: string;
       }>;
       total: number;
     };
   }
   ```
3. Chạy `npm run build` → verify không lỗi TypeScript.

## Success Criteria

- [x] Method `getIssueWorklogs` có trong `JiraClient`
- [x] `npm run build` pass clean
- [x] Type signature đúng với Jira Server v2 response

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Field `author.name` khác tên trên Cloud | Project chỉ target Server (đã ghi README). OK. |
| `comment` có thể là object (ADF) | Server v2 trả plain text. Phase 2 chỉ dùng `timeSpentSeconds`, không render comment. |
