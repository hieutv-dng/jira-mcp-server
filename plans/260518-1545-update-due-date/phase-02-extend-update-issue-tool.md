---
phase: 2
title: "Extend update_issue Tool"
status: completed
priority: P1
effort: "30m"
dependencies: [1]
---

# Phase 2: Extend update_issue Tool

## Overview

Mở rộng tool `update_issue` thêm param `dueDate` với Zod regex validation, sentinel `'clear'`, past-date warning, integrate vào combine flow.

## Requirements

- Functional:
  - `dueDate: "YYYY-MM-DD"` → set
  - `dueDate: "clear"` → null (gỡ)
  - Invalid format → Zod reject sớm
  - Past date → vẫn set, kèm warning line
  - Combine với assignee + transition + comment trong 1 call
- Non-functional: backward compat (param optional), không break call hiện có

## Architecture

Thứ tự execute trong handler (Case 3 combine flow):

```
A. Assignee   (existing)
B. Due date   (NEW — TRƯỚC transition để workflow rule thấy field đã set)
C. Transition (existing — kèm resolution + comment)
D. Comment   (existing — chỉ khi no transition)
```

Empty-args guard (Case 2, line ~217): thêm `!dueDate` vào điều kiện.

Description tool: bổ sung mô tả param dueDate trong tool description string.

## Related Code Files

- Modify: `src/jira/tools/issue-tools.ts` — schema (line ~186), handler (line ~203), empty check (line ~217), combine flow (line ~227)

## Implementation Steps

1. **Schema** — Trong `server.tool("update_issue", ...)` schema, thêm sau `assignee`:

```ts
dueDate: z.string()
  .regex(/^(\d{4}-\d{2}-\d{2}|clear)$/, "Format: YYYY-MM-DD hoặc 'clear'")
  .optional()
  .describe(
    "Ngày hết hạn mới, format YYYY-MM-DD. " +
    "'clear' = gỡ due date. " +
    "Bỏ trống = không đổi. " +
    "VD: '2026-06-15'."
  ),
```

2. **Update tool description string** — append vào description hiện có:

```
"Truyền dueDate để đổi/gỡ deadline ('clear' = gỡ). "
```

3. **Handler signature** — thêm `dueDate` vào destructure:

```ts
withErrorHandler("update_issue", async ({ issueKey, dryRun, transitionName, comment, resolution, assignee, dueDate }) => {
```

4. **Empty check (Case 2)** — bổ sung `!dueDate`:

```ts
if (!transitionName && !comment && !assignee && !dueDate) {
  return { content: [{ type: "text", text: `⚠️ Không có thay đổi — truyền assignee, dueDate, transitionName, comment, hoặc dryRun=true.` }] };
}
```

5. **Step B: Due date** — chèn sau khối assignee (sau line ~238), trước transition block:

```ts
// Step B: Due date (set trước transition để workflow rule thấy field đã update)
if (dueDate) {
  if (dueDate === "clear") {
    await jira.updateDueDate(issueKey, null);
    reportLines.push(`📅 Due date: ❌ Đã gỡ`);
  } else {
    await jira.updateDueDate(issueKey, dueDate);
    const todayUtc = new Date().toISOString().slice(0, 10);
    if (dueDate < todayUtc) {
      reportLines.push(`📅 Due date: ${dueDate} (⚠️ đã qua so với hôm nay UTC ${todayUtc})`);
    } else {
      reportLines.push(`📅 Due date: ${dueDate}`);
    }
  }
}
```

Lưu ý timezone: dùng UTC (per validation decision 1). User ở VN (UTC+7) cần biết: trước 7h sáng UTC thì "hôm nay UTC" = hôm qua VN. Note "UTC" trong report giúp user nhận diện edge case này. Warning chỉ là cảnh báo — vẫn set thành công.

6. **Relabel existing step comments** — đổi label trong `src/jira/tools/issue-tools.ts` để khớp sequence mới A→B→C→D:
   - Line ~240: `// Step B: Transition` → `// Step C: Transition (kèm comment + resolution nếu có)`
   - Line ~247: `// Step C: Comment standalone` → `// Step D: Comment standalone (chỉ khi không có transition để tránh duplicate)`

7. **Build** — `npm run build` verify TypeScript compile pass.

<!-- Updated: Validation Session 1 — UTC note, step relabel, partial-fail accepted -->

## Success Criteria

- [ ] `npm run build` pass
- [ ] `npm run inspect` test 5 scenarios:
  - Set future: `update_issue({ issueKey, dueDate: "2026-12-31" })` → set + report
  - Set past: `update_issue({ issueKey, dueDate: "2020-01-01" })` → set + warning với note "UTC"
  - Clear: `update_issue({ issueKey, dueDate: "clear" })` → null + report "Đã gỡ"
  - Invalid: `update_issue({ issueKey, dueDate: "tomorrow" })` → Zod reject
  - Combine: `update_issue({ issueKey, dueDate: "2026-12-31", transitionName: "Done", resolution: "Fixed" })` → cả 3 line report
  - Combine partial fail: nếu transition fail (workflow rule), due date đã apply — error message từ Jira interceptor là OK (không revert)
- [ ] Regression: `update_issue({ issueKey, comment: "test" })` không có `dueDate` → hành xử y nguyên
- [ ] Output Markdown chứa `📅 Due date:` line khi `dueDate` được truyền

## Risk Assessment

- **Low**: param optional, không breaking
- **Medium**: workflow rule cấm clear/past-date → Jira reject; error message từ interceptor đã rõ
- **Edge**: timezone — `new Date().toISOString().slice(0, 10)` dùng UTC. Validation decision 1: giữ UTC, note rõ "UTC" trong warning line để user VN biết edge case (trước 7h UTC sáng = hôm qua VN). Cost rẻ, không cần thêm dep timezone
- **Edge**: partial-fail combine — validation decision 2: chấp nhận, pattern nhất quán với assignee+transition hiện có. Axios interceptor format Jira error rõ ràng
