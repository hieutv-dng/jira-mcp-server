# Brainstorm — Update Due Date

**Date:** 2026-05-18
**Skill:** /ck:brainstorm
**Status:** Approved — ready for /ck:plan

---

## Problem Statement

`update_issue` hiện hỗ trợ assignee, transition, comment, resolution — KHÔNG cho set/clear due date. User cần mở rộng để chỉnh deadline qua MCP mà không phải vào Jira UI.

## Requirements (exact)

| Item | Value |
|------|-------|
| **Expected output** | Param `dueDate` mới trong `update_issue`; client method `updateDueDate`; report line trong response |
| **Acceptance** | Set, clear ('clear'), invalid reject sớm, past-date warning, combine cùng assignee+transition+comment |
| **Scope OUT** | Relative date, bulk update, đổi due date qua create_issue (đã có) |
| **Constraints** | Pattern hiện có (Zod, withErrorHandler, dryRun, getChainHint), Jira Server REST v2 |
| **Touchpoints** | `src/jira/client.ts`, `src/jira/tools/issue-tools.ts`, `README.md`, `docs/codebase-summary.md` |

## Evaluated Approaches

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| A. Mở rộng `update_issue` | DRY, consistent với combine flow, ít tool hơn cho AI nhớ | Schema dài hơn | **Chosen** |
| B. Tool riêng `update_due_date` | Schema gọn | Vi phạm DRY pattern combine; tăng tool count |  |

Clear support:
- **Chosen**: sentinel `'clear'` (giống `assignee='unassigned'`)
- Rejected: chỉ set (user kẹt khi cần gỡ deadline)

Date validation:
- **Chosen**: Zod regex `^(\d{4}-\d{2}-\d{2}|clear)$`
- Rejected: no-validate (error Jira khó đọc), relative date (YAGNI)

Past-date:
- **Chosen**: warn + cho set (cover backfill)
- Rejected: block (cản use case hợp lệ), silent (UX kém)

## Recommended Solution

### 1. Schema (`issue-tools.ts`)
```ts
dueDate: z.string()
  .regex(/^(\d{4}-\d{2}-\d{2}|clear)$/)
  .optional()
  .describe("Ngày hết hạn YYYY-MM-DD. 'clear' = gỡ. Bỏ trống = không đổi.")
```

### 2. Client method (`client.ts`, sau `updateAssignee`)
```ts
async updateDueDate(issueKey: string, dueDate: string | null): Promise<void> {
  await this.http.put(`/issue/${issueKey}`, { fields: { duedate: dueDate } });
}
```

### 3. Handler flow (mở rộng combine, `issue-tools.ts:227`)
Thứ tự execute:
1. **A. Assignee** (existing)
2. **B. Due date** (NEW) — chạy TRƯỚC transition để workflow rule thấy field đã set
3. **C. Transition** (existing)
4. **D. Comment standalone** (existing)

Empty-args check: thêm `!dueDate` vào điều kiện Case 2.

### 4. Past-date warning
```ts
const today = new Date().toISOString().slice(0, 10);
if (dueDate && dueDate !== 'clear' && dueDate < today) {
  reportLines.push(`⚠️ Due date "${dueDate}" đã qua (hôm nay ${today}) — vẫn áp dụng.`);
}
```
ISO string compare an toàn cho `YYYY-MM-DD`.

### 5. Report lines
- Set: `📅 Due date: 2026-06-01`
- Clear: `📅 Due date: ❌ Đã gỡ`
- Past-date: warn line + set line

### 6. Docs
- `README.md`: cập nhật mô tả `update_issue` + example
- `docs/codebase-summary.md`: note feature mới
- `docs/project-overview-pdr.md`: bump version note nếu cần
- `package.json`: bump → 1.3.0 (decision tại commit step)

## Implementation Considerations & Risks

- **Low risk**: Jira Server v7+ chấp nhận `fields.duedate=null` để clear; axios interceptor đã format error rõ.
- **Workflow rule edge**: nếu project có rule cấm null/past-date, Jira sẽ reject — error chuẩn từ interceptor.
- **Backward compat**: param optional → không break call hiện có.

## Success Metrics

- `npm run build` pass
- `npm run inspect` test 5 scenarios: set, clear, past-date warn, invalid (zod reject), combine với transition
- Output report combine chứa đủ 4 line khi pass 4 params
- No regression: gọi `update_issue` không có `dueDate` hành xử y nguyên

## Next Steps

1. `/ck:plan` → phase implementation (client → tool → docs)
2. `/ck:cook` → run plan
3. `/ck:test` → MCP Inspector verify 5 scenarios
4. `/ck:ship` → commit + PR

## Open Questions

- Thứ tự B-trước-C có cần test với workflow rule cụ thể không? — Để cook step verify trên project thật.
- Bump version `v1.3.0` tại commit hay tách release riêng? — Decision tại ship step.
