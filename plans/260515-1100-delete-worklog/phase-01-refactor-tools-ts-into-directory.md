---
phase: 1
title: "Refactor tools.ts into directory"
status: pending
priority: P2
effort: "1h"
dependencies: []
---

# Phase 1: Refactor tools.ts into directory

<!-- Updated: Validation Session 1 - split create_issue into separate file + fix import path mandatory -->

## Overview

Tách `src/jira/tools.ts` (663 dòng) thành directory `src/jira/tools/` với 5 file theo concern: `index.ts` (barrel), `user-tools.ts`, `issue-tools.ts`, `create-issue-tool.ts`, `worklog-tools.ts`. Behavior KHÔNG đổi — chỉ tổ chức lại code.

## Requirements

- **Functional:** Tất cả 7 tool hiện có hoạt động đúng như trước
- **Non-functional:** Mỗi file ≤ 270 dòng (target 200, trừ `create-issue-tool.ts` ~270 do schema lớn)
- **Import resolution:** NodeNext ESM **không** support directory imports → **bắt buộc** đổi `src/index.ts:13` từ `./jira/tools.js` → `./jira/tools/index.js`

## Architecture

```
src/jira/
├── client.ts                  # giữ nguyên (843 dòng - refactor plan sau)
├── formatter.ts               # giữ nguyên (phase 2 thêm formatWorklogDetail)
├── tools.ts                   # DELETE
└── tools/                     # NEW
    ├── index.ts               # registerJiraTools() barrel
    ├── user-tools.ts          # get_current_user (~40 dòng)
    ├── issue-tools.ts         # list_issues, get_issue_detail, update_issue (~230 dòng)
    ├── create-issue-tool.ts   # create_issue riêng (~270 dòng do schema lớn)
    └── worklog-tools.ts       # log_work, list_worklogs (chưa có delete_worklog) (~110 dòng)
```

`index.ts` pattern:
```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { JiraClient } from "../client.js";
import { registerUserTools } from "./user-tools.js";
import { registerIssueTools } from "./issue-tools.js";
import { registerCreateIssueTool } from "./create-issue-tool.js";
import { registerWorklogTools } from "./worklog-tools.js";

export function registerJiraTools(server: McpServer, jira: JiraClient) {
  registerUserTools(server, jira);
  registerIssueTools(server, jira);
  registerCreateIssueTool(server, jira);
  registerWorklogTools(server, jira);
}
```

Mỗi sub-file pattern:
```ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JiraClient } from "../client.js";
import { withErrorHandler, getChainHint } from "../../shared/utils.js";
import { /* relevant formatters */ } from "../formatter.js";

export function registerWorklogTools(server: McpServer, jira: JiraClient) {
  server.tool("log_work", ...);
  server.tool("list_worklogs", ...);
}
```

## Related Code Files

- **Create:** `src/jira/tools/index.ts`, `src/jira/tools/user-tools.ts`, `src/jira/tools/issue-tools.ts`, `src/jira/tools/create-issue-tool.ts`, `src/jira/tools/worklog-tools.ts`
- **Delete:** `src/jira/tools.ts`
- **Modify:** `src/index.ts:13` — đổi import `./jira/tools.js` → `./jira/tools/index.js` (NodeNext ESM bắt buộc)

## Implementation Steps

1. **Tạo `src/jira/tools/user-tools.ts`** — copy phần `get_current_user` từ `tools.ts:50-68`, wrap trong `registerUserTools(server, jira)`. Import `withErrorHandler`, `getChainHint`, `formatCurrentUser`.
2. **Tạo `src/jira/tools/issue-tools.ts`** — copy `list_issues` (tools.ts:69-175), `get_issue_detail` (176-204), `update_issue` (315-396) từ `tools.ts`. Wrap trong `registerIssueTools(server, jira)`. Import `formatIssueForAI`, `formatIssueListForAI`, `withErrorHandler`, `getChainHint`. **Không gồm `create_issue`.**
3. **Tạo `src/jira/tools/create-issue-tool.ts`** — copy phần `create_issue` từ `tools.ts:399-663`, wrap trong `registerCreateIssueTool(server, jira)`. Tách riêng do schema lớn (custom fields, epics, dryRun metadata) — giữ file ≤ 270 dòng. [validation session 1]
4. **Tạo `src/jira/tools/worklog-tools.ts`** — copy `log_work` (tools.ts:205-242), `list_worklogs` (243-312) từ `tools.ts`. Wrap trong `registerWorklogTools(server, jira)`. Import `formatWorklogSummary`, `withErrorHandler`, `getChainHint`. **Chưa thêm `delete_worklog` — để phase 2.**
5. **Tạo `src/jira/tools/index.ts`** — barrel export `registerJiraTools()` gọi 4 register function trên.
6. **Đổi import path** ở `src/index.ts:13`: `from "./jira/tools.js"` → `from "./jira/tools/index.js"`. **Bắt buộc** vì NodeNext ESM không hỗ trợ directory imports. [validation session 1]
7. **Delete `src/jira/tools.ts`.**
8. **Build:** `npm run build`. Fix bất kỳ TS error nào (thường là missing imports).
9. **Smoke test:** `npm run inspect`, verify 7 tools load đầy đủ và execute được:
   - `get_current_user` — chạy thẳng, expect user info
   - `list_issues` — chạy với mặc định, expect danh sách issue
   - `get_issue_detail` — chạy 1 issue key bất kỳ
   - `log_work` (chỉ verify schema load — không có dryRun)
   - `list_worklogs` — chạy với mặc định, expect aggregate
   - `update_issue` với `dryRun=true` — verify transitions list
   - `create_issue` với `dryRun=true` — verify metadata (custom fields, epics, users) [validation session 1]

## Success Criteria

- [ ] 5 file mới tồn tại trong `src/jira/tools/` (index, user, issue, create-issue, worklog)
- [ ] `src/jira/tools.ts` không còn tồn tại
- [ ] `src/index.ts:13` import đổi sang `./jira/tools/index.js`
- [ ] `npm run build` pass, 0 TS error
- [ ] `npm run inspect` load đủ 7 tools
- [ ] Smoke test 6 tool pass (5 read-only + `create_issue` dryRun); `log_work` chỉ verify schema load
- [ ] `wc -l src/jira/tools/*.ts` cho thấy mỗi file ≤ 270 dòng

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Import path không resolve sau khi delete tools.ts | Step 6 đã đổi tường minh sang `./jira/tools/index.js`; `npm run build` ở step 8 sẽ catch ngay nếu sai |
| Logic copy thiếu sót giữa 4 sub-file | Compare diff cẩn thận; chạy smoke test 6 tool ở step 9 |
| Circular import giữa sub-files | Không có vì các sub-files không import lẫn nhau, chỉ import từ `client`, `formatter`, `utils` |
| File create-issue-tool.ts vượt 270 dòng | Nếu vượt, xem xét trích phần schema (zod) ra file riêng `create-issue-schema.ts` |

## Next Steps

→ Phase 2: thêm `deleteWorklog` client method + `delete_worklog` tool + `list_worklogs` detail flag vào `worklog-tools.ts` mới.
