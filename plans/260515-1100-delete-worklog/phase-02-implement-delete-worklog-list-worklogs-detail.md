---
phase: 2
title: "Implement delete_worklog + list_worklogs detail"
status: pending
priority: P1
effort: "2h"
dependencies: [1]
---

# Phase 2: Implement delete_worklog + list_worklogs detail

## Overview

Bổ sung `JiraClient.deleteWorklog()`, formatter `formatWorklogDetail()`, tool mới `delete_worklog` (batch + dryRun + best-effort), và mở rộng `list_worklogs` với param `detail: boolean`.

## Requirements

### Functional
- `delete_worklog` xoá 1 hoặc nhiều worklog trên 1 issue theo array `worklogIds`
- `dryRun=true` show preview không gọi DELETE
- Best-effort: 1 entry fail không stop batch
- `list_worklogs(detail=true)` show từng worklog entry với worklogId, date, hours, comment

### Non-functional
- Tuân thủ pattern client → tools → formatter
- Safety annotation: yêu cầu user xác nhận (tool description nhấn mạnh dryRun trước)
- adjustEstimate=auto (Jira default)
- Zod validation strict

## Architecture

### Data flow `delete_worklog`

```
Claude → tools.delete_worklog handler
  ├── dryRun=true:
  │     jira.getIssueWorklogs(issueKey)
  │       → filter entries match worklogIds
  │       → format preview markdown (count, total hours, per-entry detail)
  │       → return WITHOUT calling DELETE
  └── dryRun=false:
        for each worklogId:
          jira.deleteWorklog(issueKey, worklogId)
            DELETE /issue/{key}/worklog/{id}?adjustEstimate=auto
            collect { id, status: "success" | error }
        format summary (X success / Y failed with reasons)
```

### Data flow `list_worklogs detail`

Reuse existing logic, branch ở step 4 (format):
- `detail=false` (default): `formatWorklogSummary(rows, grandTotal, meta)` — như cũ
- `detail=true`: `formatWorklogDetail(entries, meta)` — flatten tất cả worklog entries qua các issue, sort by date desc

## Related Code Files

- **Modify:** `src/jira/client.ts` — thêm `deleteWorklog()`
- **Modify:** `src/jira/formatter.ts` — thêm `WorklogEntry` interface + `formatWorklogDetail()`
- **Modify:** `src/jira/tools/worklog-tools.ts` — thêm `delete_worklog` tool + extend `list_worklogs` schema
- **Modify:** `src/shared/utils.ts` — update `TOOL_CHAINING`

## Implementation Steps

### 1. Client method (`src/jira/client.ts`)

Thêm sau `getIssueWorklogs`:

```ts
/**
 * Xoá 1 worklog entry. Jira sẽ auto-adjust remaining estimate
 * bằng cách cộng lại thời gian đã xoá vào remaining (adjustEstimate=auto).
 *
 * @throws 403 nếu không có quyền (worklog của user khác và không phải admin)
 * @throws 404 nếu worklogId không tồn tại trên issue đó
 */
async deleteWorklog(issueKey: string, worklogId: string): Promise<void> {
  await this.http.delete(`/issue/${issueKey}/worklog/${worklogId}`, {
    params: { adjustEstimate: "auto" },
  });
}
```

### 2. Formatter (`src/jira/formatter.ts`)

Thêm interface + function:

```ts
export interface WorklogEntry {
  id: string;
  issueKey: string;
  issueSummary: string;
  date: string;        // YYYY-MM-DD
  hours: number;       // seconds / 3600, làm tròn 2 chữ số
  comment?: string;
}

export function formatWorklogDetail(
  entries: WorklogEntry[],
  meta: { username: string; from: string; to: string; truncated?: boolean }
): string {
  if (entries.length === 0) {
    return `📊 **Worklog Detail** — \`${meta.username}\` (${meta.from} → ${meta.to})\n\n` +
           `_Không có worklog nào._`;
  }
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const total = sorted.reduce((s, e) => s + e.hours, 0);
  const lines = [
    `📊 **Worklog Detail** — \`${meta.username}\` (${meta.from} → ${meta.to})`,
    "",
    "| WorklogID | Issue | Date | Hours | Comment |",
    "|-----------|-------|------|-------|---------|",
    ...sorted.map(e =>
      `| \`${e.id}\` | ${e.issueKey} | ${e.date} | ${e.hours}h | ${(e.comment || "").slice(0, 80)} |`
    ),
    "",
    `**Tổng:** ${total.toFixed(2)}h trên ${sorted.length} entries`,
  ];
  if (meta.truncated) lines.push("", "⚠️ _Kết quả bị truncate (>500 issues)._");
  return lines.join("\n");
}
```

### 3. Extend `list_worklogs` (`src/jira/tools/worklog-tools.ts`)

Thêm vào schema:
```ts
detail: z.boolean().optional()
  .describe("true = show từng worklog entry với worklogId (dùng cho delete_worklog). false/bỏ trống = summary aggregate theo issue."),
```

Trong handler, sau khi build `worklogResults`:
```ts
if (detail) {
  const entries: WorklogEntry[] = [];
  issues.forEach((issue, idx) => {
    (worklogResults[idx].worklogs || [])
      .filter(e =>
        e.author.name === resolvedUser &&
        e.started.slice(0, 10) >= from &&
        e.started.slice(0, 10) <= to
      )
      .forEach(e => entries.push({
        id: e.id,
        issueKey: issue.key,
        issueSummary: issue.fields.summary,
        date: e.started.slice(0, 10),
        hours: Math.round((e.timeSpentSeconds / 3600) * 100) / 100,
        comment: e.comment,
      }));
  });
  return {
    content: [{
      type: "text",
      text: formatWorklogDetail(entries, { username: resolvedUser, from, to, truncated })
        + getChainHint("list_worklogs"),
    }],
  };
}
// else: giữ nguyên formatWorklogSummary logic
```

### 4. Thêm `delete_worklog` tool (`src/jira/tools/worklog-tools.ts`)

```ts
server.tool(
  "delete_worklog",
  "Xoá 1 hoặc nhiều worklog trên 1 Jira issue. ⚠️ DESTRUCTIVE. " +
  "BẮT BUỘC chạy dryRun=true trước, show preview cho user, đợi xác nhận rồi mới chạy dryRun=false. " +
  "adjustEstimate=auto (Jira tự cộng giờ đã xoá vào remaining estimate). " +
  "Chỉ xoá được worklog của chính mình (hoặc admin).",
  {
    issueKey: z.string().describe("Jira issue key, VD: 'VNPTAI-123'"),
    worklogIds: z.array(z.string()).min(1)
      .describe("Array worklog ID cần xoá. Lấy từ `list_worklogs` với detail=true."),
    dryRun: z.boolean().optional()
      .describe("true = preview, không xoá thật. KHUYẾN CÁO mạnh chạy dryRun trước."),
  },
  withErrorHandler("delete_worklog", async ({ issueKey, worklogIds, dryRun }) => {
    if (dryRun) {
      const data = await jira.getIssueWorklogs(issueKey);
      const matched = (data.worklogs || []).filter(w => worklogIds.includes(w.id));
      const notFound = worklogIds.filter(id => !matched.find(m => m.id === id));
      const totalSec = matched.reduce((s, w) => s + w.timeSpentSeconds, 0);
      const lines = [
        `🔍 **Dry Run** — sẽ xoá ${matched.length}/${worklogIds.length} worklog trên \`${issueKey}\``,
        "",
        "| WorklogID | Date | Hours | Author | Comment |",
        "|-----------|------|-------|--------|---------|",
        ...matched.map(w =>
          `| \`${w.id}\` | ${w.started.slice(0, 10)} | ${w.timeSpent} | ${w.author.name} | ${(w.comment || "").slice(0, 60)} |`
        ),
        "",
        `**Tổng giờ sẽ xoá:** ${(totalSec / 3600).toFixed(2)}h`,
        `**Remaining estimate:** sẽ tự cộng thêm ${(totalSec / 3600).toFixed(2)}h (adjustEstimate=auto)`,
      ];
      if (notFound.length > 0) {
        lines.push("", `⚠️ **${notFound.length} ID không tìm thấy:** ${notFound.join(", ")}`);
      }
      lines.push("", "👉 Gọi lại với `dryRun=false` (sau khi user xác nhận) để xoá thật.");
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    // Real delete: best-effort
    const results = await Promise.all(
      worklogIds.map(async id => {
        try {
          await jira.deleteWorklog(issueKey, id);
          return { id, ok: true as const };
        } catch (err: any) {
          const status = err?.response?.status;
          const msg = status === 403 ? "403 — không có quyền (worklog của user khác?)"
                    : status === 404 ? "404 — worklog không tồn tại"
                    : err?.message || "lỗi không xác định";
          return { id, ok: false as const, error: msg };
        }
      })
    );
    const success = results.filter(r => r.ok);
    const failed = results.filter(r => !r.ok);
    const lines = [
      `🗑️  **Delete Worklog** — issue \`${issueKey}\``,
      "",
      `✅ **Đã xoá:** ${success.length} worklog`,
    ];
    if (success.length > 0) lines.push(...success.map(r => `  - \`${r.id}\``));
    if (failed.length > 0) {
      lines.push("", `❌ **Thất bại:** ${failed.length} worklog`);
      lines.push(...failed.map(r => `  - \`${r.id}\`: ${(r as any).error}`));
    }
    lines.push(getChainHint("delete_worklog"));
    return { content: [{ type: "text", text: lines.join("\n") }] };
  })
);
```

### 5. Update tool chaining (`src/shared/utils.ts`)

```ts
list_worklogs:
  "→ Tiếp: `list_worklogs` với `detail=true` để xem worklog ID, " +
  "hoặc `get_issue_detail` xem chi tiết, hoặc `delete_worklog` nếu cần xoá nhầm.",
delete_worklog:
  "→ Tiếp: `list_worklogs` để verify đã xoá, hoặc `log_work` log lại đúng.",
```

### 6. Build + smoke test

```bash
npm run build
npm run inspect
```

Test scenarios:
- `list_worklogs({ detail: true })` → table có column WorklogID
- `delete_worklog({ issueKey: "PROJ-X", worklogIds: ["<real-id>"], dryRun: true })` → preview
- `delete_worklog({ issueKey: "PROJ-X", worklogIds: ["<real-id>"], dryRun: false })` → xoá thật, verify trên Jira UI
- `delete_worklog` với 1 ID sai → trả error 404 trong report
- `delete_worklog` với worklog của user khác → trả error 403

## Success Criteria

- [ ] `deleteWorklog()` method tồn tại trong `client.ts`
- [ ] `formatWorklogDetail()` tồn tại trong `formatter.ts`
- [ ] `delete_worklog` tool registered, schema đúng
- [ ] `list_worklogs` có param `detail` hoạt động
- [ ] `TOOL_CHAINING` cập nhật cho `delete_worklog` + `list_worklogs`
- [ ] `npm run build` pass
- [ ] Smoke test 5 scenarios trên đều pass
- [ ] Verify trên Jira UI sau khi xoá thật

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| AI agent skip dryRun → xoá thẳng | Description nhấn mạnh "BẮT BUỘC dryRun trước"; tool description trở thành hint mạnh |
| User truyền worklogIds của issue khác | Best-effort sẽ trả 404 cho từng ID không match issueKey → user thấy ngay |
| Xoá worklog không phải của mình | Jira trả 403, error message rõ ràng |
| Race condition: list_worklogs cũ → xoá → ID đã bị xoá bởi user khác | Trả 404, skip best-effort, không crash |
| `adjustEstimate=auto` gây bất ngờ với user | Preview dryRun ghi rõ "remaining sẽ +Xh" |
| Format số giờ float lệch (timeSpentSeconds = 5400 → 1.5h) | Dùng `Math.round(... * 100) / 100` để giữ 2 chữ số |

## Next Steps

→ Phase 3: cập nhật docs (README, codebase-summary, system-architecture) và verify đầy đủ.
