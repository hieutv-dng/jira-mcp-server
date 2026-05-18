# Add dueDate Parameter to update_issue Tool

**Date**: 2026-05-18 16:28  
**Severity**: Low  
**Component**: Jira MCP Server — issue-tools.ts, client.ts  
**Status**: Resolved  
**Commit**: 37c552a

## What Shipped

Extended `update_issue` tool with optional `dueDate` parameter. Users can now set due dates (`YYYY-MM-DD`), clear them (`'clear'` sentinel), and see past-date warnings inline. Feature integrates into existing combine flow: assignee → due date → transition → comment. Version bumped 1.2.0 → 1.3.0.

## Key Decisions & Trade-Offs

**1. Timezone Edge Case: Keep UTC, Add Explicit Note**  
Compared past dates against UTC today via `new Date().toISOString().slice(0, 10)`. This catches timezone bugs early but creates a VN-specific gotcha: before 7am UTC, "today UTC" is yesterday in VN. Decision: Print warning as `📅 Due date: YYYY-MM-DD (⚠️ đã qua so với hôm nay UTC YYYY-MM-DD)`. The explicit "UTC" note educates rather than assuming users understand epoch conversions. Cost: zero (no extra dependency), clarity: high for target region.

**2. Partial-Success on Combine Fail: No Revert**  
If due date applies but subsequent transition fails (e.g., workflow rule blocks), the due date stays set. This mirrors existing assignee+transition behavior — inconsistent rollback logic is worse than transparent partial success. The Jira API error message from the axios interceptor (line 57 of client.ts) surfaces the underlying reason clearly. Users see both "step X succeeded" in report and "step Y failed with reason Z" in error. Kept KISS.

**3. Step Relabeling: A→B→C→D**  
Reordered combine steps: A(Assignee) → B(Due date, **new**) → C(Transition) → D(Comment). Due date executes *before* transition so workflow rules see the updated field. This prevents state conflicts where a rule would have accepted the issue if due date were already changed. Relabeled existing steps in comments to match. Pedantic but correct.

**4. File Size Creep Accepted (Not Escalated)**  
`issue-tools.ts` was already 258 LOC (over soft 200-line cap) before this work. Feature added ~30 LOC, bringing total to ~290. Decision: acceptable for now, flag for future modularization (extract issue-tools → issue-read-tools + issue-write-tools). Not made meaningfully worse; refactor more valuable than premature split.

## Technical Details

**Client Layer** (`src/jira/client.ts:326`):
```typescript
async updateDueDate(issueKey: string, dueDate: string | null): Promise<void> {
  await this.http.put(`/issue/${issueKey}`, {
    fields: { duedate: dueDate },
  });
}
```
Mirrors `updateAssignee` pattern. Null body tells Jira REST v2 to clear the field.

**Tool Schema** (`src/jira/tools/issue-tools.ts:186`):
```typescript
dueDate: z.string()
  .regex(/^(\d{4}-\d{2}-\d{2}|clear)$/, "Format: YYYY-MM-DD hoặc 'clear'")
  .optional()
```
Sentinel `'clear'` rejected by Zod, then explicitly checked in handler to convert to `null` before API call. Fail-fast validation.

**Handler Integration** (lines ~240–255):
- Empty-check now includes `!dueDate`
- Step B (due date): Executes *before* transition, logs warning if `dueDate < todayUtc`
- Combine flow tested with 5 scenarios: set future, set past, clear, invalid format, combine with transition

**Docs Updated**: README v1.3.0, Tools Reference table, codebase-summary.md (input params, client methods), package.json.

## What Went Right

- Zod schema validation fast-fails bad input before any API call
- Combine flow design clean: natural execution order (update field → execute transition → comment)
- Backward compat rock-solid: param optional, no existing code breaks
- Timezone note solved a real UX problem without adding code complexity

## What Hurt

Nothing severe. Soft cap violation pre-existed; this work made it incrementally worse but not materially. Real refactor (modularize issue-tools) scheduled for later, when ROI clearer.

## Lessons

- **Explicit timezone notes beat automatic timezone handling**: Regional edge cases (UTC+7) deserve visible, searchable markers in output, not silent conversions. One extra string with "UTC" in warning text saved future debugging sessions.
- **Partial success is OK when error messages are good**: Combined operations that fail mid-stream only work if step N+1 error is loud and clear. Rely on interceptor, not rollback ceremony.
- **Sentinel strings work better than boolean flags for schema**: `dueDate: "clear"` is self-documenting; `clearDueDate: true` forces reading adjacent code to understand intent.

## Next Steps

1. ~~Phase 1: Implement client method~~ ✓
2. ~~Phase 2: Extend update_issue tool~~ ✓
3. ~~Phase 3: Update docs~~ ✓
4. **Future**: Modularize issue-tools.ts when next feature requires it (current ~290 LOC, soft cap 200)
5. Monitor user feedback on UTC timezone warning clarity; tweak note if confusion reported

---

**Status:** DONE  
**Summary:** Shipped dueDate parameter for update_issue, v1.3.0. All tests pass, docs synced, backward compat verified. UTC timezone edge case documented explicitly to reduce VN user confusion.
