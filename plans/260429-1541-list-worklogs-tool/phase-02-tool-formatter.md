---
phase: 2
title: "Tool & Formatter"
status: completed
priority: P1
effort: "1h"
dependencies: [1]
---

# Phase 2: Tool & Formatter

## Overview

Đăng ký MCP tool `list_worklogs` với Zod schema, handler logic (search → fetch worklogs parallel → aggregate), và formatter Markdown.

## Requirements

- **Functional:**
  - Tool tên `list_worklogs`
  - Input: `username?`, `dateFrom?`, `dateTo?`, `projectKey?`
  - Default: current user (qua `getCurrentUser()`), tháng hiện tại
  - Output: Markdown table aggregate theo issue + total
- **Non-functional:**
  - Bọc bằng `withErrorHandler`
  - N+1 calls chạy parallel `Promise.all`
  - Cap `maxResults=500`, cảnh báo nếu chạm trần

<!-- Updated: Validation Session 1 - MAX raised 100 → 500 to cover heavy-loggers -->
<!-- Updated: Validation Session 1 - Renumber TOOL comments to keep sequential 0..6 -->


## Architecture

```
list_worklogs(username?, dateFrom?, dateTo?, projectKey?)
  ├─ resolve username (param ?? getCurrentUser().name)
  ├─ resolve dateFrom (param ?? "YYYY-MM-01")
  ├─ resolve dateTo   (param ?? today YYYY-MM-DD)
  ├─ build JQL:
  │    worklogAuthor = "user"
  │    AND worklogDate >= "from" AND worklogDate <= "to"
  │    [AND project = "X"]
  ├─ searchIssues(jql, 100) → issues[]
  ├─ Promise.all(issues.map(i => getIssueWorklogs(i.key)))
  ├─ filter entries: author.name === username && started date ∈ [from, to]
  ├─ aggregate: Map<issueKey, { summary, totalSec }>
  └─ formatWorklogSummary(rows, totalSec, { username, from, to })
```

**Date filter:** so sánh date-only — cắt 10 ký tự đầu của `started` (`YYYY-MM-DD`) so với `dateFrom`/`dateTo` lexicographically. Tránh edge case timezone.

## Related Code Files

- Modify: `src/jira/tools.ts` — register `list_worklogs` ngay sau `log_work` block (TOOL 4); renumber comment cho `update_issue` thành TOOL 5, `create_issue` giữ TOOL 6
- Modify: `src/jira/formatter.ts` — thêm `formatWorklogSummary()`
- Modify: `src/shared/utils.ts` — thêm entry `list_worklogs` vào `TOOL_CHAINING`

## Implementation Steps

### 2.1. Formatter (`src/jira/formatter.ts`)

Thêm function:
```ts
export interface WorklogRow {
  issueKey: string;
  summary: string;
  totalSeconds: number;
}

export function formatWorklogSummary(
  rows: WorklogRow[],
  totalSeconds: number,
  meta: { username: string; from: string; to: string; truncated?: boolean }
): string {
  const toHours = (sec: number) => (sec / 3600).toFixed(2) + "h";
  const toDays = (sec: number) => (sec / 28800).toFixed(2); // 8h = 1d

  if (rows.length === 0) {
    return `📊 **Worklogs** — \`${meta.username}\` (${meta.from} → ${meta.to})\n\n` +
           `_Không có worklog nào trong khoảng thời gian này._`;
  }

  const lines = [
    `📊 **Worklogs** — \`${meta.username}\` (${meta.from} → ${meta.to})`,
    "",
    "| Issue | Summary | Hours |",
    "|-------|---------|-------|",
    ...rows.map(r => `| ${r.issueKey} | ${r.summary} | ${toHours(r.totalSeconds)} |`),
    "",
    `🧮 **Total:** ${toHours(totalSeconds)} (${toDays(totalSeconds)} days @ 8h) · ${rows.length} issues`,
  ];
  if (meta.truncated) {
    lines.push("", `⚠️ Đã chạm giới hạn 500 issues — kết quả có thể chưa đầy đủ. Hãy thu hẹp date range hoặc thêm projectKey.`);
  }
  return lines.join("\n");
}
```

### 2.2. Tool registration (`src/jira/tools.ts`)

Trong `registerJiraTools`, sau `log_work` block. Đồng thời renumber comment hiện tại:
- `// ── TOOL 4: Cập nhật issue (transition + comment) ───────` → `// ── TOOL 5: Cập nhật issue (transition + comment) ───────`
- `// ── TOOL 6: Tạo issue mới (hoặc xem metadata với dryRun) ───────` giữ nguyên

```ts
// ── TOOL 4: Truy vấn worklog ───────────────
server.tool(
  "list_worklogs",
  "Truy vấn tổng giờ đã logwork của 1 user trong khoảng thời gian, group theo issue. " +
  "Mặc định: current user, tháng hiện tại. " +
  "Use case: 'tháng này tôi log bao nhiêu giờ', 'user X log những task nào tuần qua'.",
  {
    username: z.string().optional()
      .describe("Username Jira (không phải display name). Bỏ trống = current user."),
    dateFrom: z.string().optional()
      .describe("Ngày bắt đầu YYYY-MM-DD. Bỏ trống = ngày 1 tháng hiện tại."),
    dateTo: z.string().optional()
      .describe("Ngày kết thúc YYYY-MM-DD. Bỏ trống = hôm nay."),
    projectKey: z.string().optional()
      .describe("Filter theo project key, VD: 'VNPTAI'. Bỏ trống = tất cả."),
  },
  withErrorHandler("list_worklogs", async ({ username, dateFrom, dateTo, projectKey }) => {
    // 1. Resolve defaults
    const resolvedUser = username || (await jira.getCurrentUser()).name;
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const monthStart = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;
    const from = dateFrom || monthStart;
    const to = dateTo || todayStr;

    // 2. Build JQL
    const clauses = [
      `worklogAuthor = "${resolvedUser}"`,
      `worklogDate >= "${from}"`,
      `worklogDate <= "${to}"`,
    ];
    if (projectKey) clauses.push(`project = "${projectKey}"`);
    const jql = clauses.join(" AND ");

    // 3. Search issues + fetch worklogs parallel
    const MAX = 500;
    const search = await jira.searchIssues(jql, MAX);
    const issues = (search.issues || []) as Array<{ key: string; fields: { summary: string } }>;
    const truncated = (search.total || 0) > MAX;

    const worklogResults = await Promise.all(
      issues.map(i => jira.getIssueWorklogs(i.key))
    );

    // 4. Aggregate
    const rows = issues.map((issue, idx) => {
      const entries = worklogResults[idx].worklogs || [];
      const totalSec = entries
        .filter(e =>
          e.author.name === resolvedUser &&
          e.started.slice(0, 10) >= from &&
          e.started.slice(0, 10) <= to
        )
        .reduce((sum, e) => sum + e.timeSpentSeconds, 0);
      return { issueKey: issue.key, summary: issue.fields.summary, totalSeconds: totalSec };
    }).filter(r => r.totalSeconds > 0);

    const grandTotal = rows.reduce((s, r) => s + r.totalSeconds, 0);

    return {
      content: [{
        type: "text",
        text: formatWorklogSummary(rows, grandTotal, { username: resolvedUser, from, to, truncated })
          + getChainHint("list_worklogs"),
      }],
    };
  })
);
```

Cập nhật import ở đầu file:
```ts
import { formatIssueForAI, formatIssueListForAI, formatCurrentUser, formatWorklogSummary } from "./formatter.js";
```

### 2.3. Tool chaining (`src/shared/utils.ts`)

Thêm entry vào `TOOL_CHAINING`:
```ts
list_worklogs:
  "→ Tiếp: `get_issue_detail` để xem chi tiết worklog của 1 issue, hoặc `log_work` nếu thiếu giờ.",
```

## Success Criteria

- [x] Tool `list_worklogs` xuất hiện khi `npm run inspect`
- [x] Gọi không param → trả Markdown đúng format, current user, tháng này
- [x] Gọi với `username, dateFrom, dateTo` → filter đúng
- [x] Issues có total = 0 bị loại khỏi bảng (filter cuối)
- [x] `npm run build` pass clean

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| N+1 chậm khi user có 100+ issues | Promise.all parallel; cap 500; warn truncated. Worst-case 500 parallel HTTP calls — chấp nhận, Jira Server enterprise đủ headroom |
| Lexicographic date compare lỗi nếu format khác YYYY-MM-DD | Zod chỉ là `z.string()` — chấp nhận, doc rõ format trong description; user truyền sai sẽ trả 0 results (không crash) |
| `searchIssues` có response shape khác | Đã check shape ở line 152-179 client.ts: `res.data.issues[].key` + `fields.summary` ✓ |
| Username sai → 0 results khó debug | `formatWorklogSummary` empty case in rõ user/range để user tự verify |
| JQL injection qua username | Username từ Jira chỉ chứa alphanumeric/dấu chấm; risk thấp. Nếu cần khắt khe: escape `"` trong username |
