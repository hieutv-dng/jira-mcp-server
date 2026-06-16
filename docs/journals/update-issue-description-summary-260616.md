# update_issue description & summary support

Date: 2026-06-16
Component: Jira MCP Server — `update_issue`, `JiraClient`, docs

## Summary

Implemented description + summary field editing in existing `update_issue` tool. User feedback confirmed missing mô tả (description) editing was blocker; now both title and body editable in one tool call.

## Changes

- Added `JiraClient.updateFields(issueKey, { summary?, description? })` — single PUT `/issue/{key}` with `{ fields }`, sends only defined fields, returns early if empty. Mirrors updateAssignee/updateDueDate/updateLabels pattern.
- Added optional `summary` (z.string().trim().min(1)) and `description` (z.string().min(1), no trim to preserve wiki markup) to `update_issue` schema.
- Updated tool handler: new Step C2 executes *before* transition (Step D) so workflow rules see updated fields. Guard check covers both fields. Reports `✏️ Summary` / `📝 Description (N chars)`.
- Updated README + 5 docs files with the new parameters. No version bump (out of plan scope; package.json stays 1.4.0).

## Decisions

- **Description min(1), no clear support**: User need is "edit mô tả", not "empty it". No feature creep. Matches project principle: YAGNI.
- **No dryRun preview for text fields**: Tool description + emoji warnings provide safety; consistent with assignee/labels pattern. dryRun preview overkill for text edits.
- **No .max(255) for summary**: Let Jira API reject oversized text (YAGNI). Mirrors dueDate pattern — minimal client-side validation.
- **Backward compatible**: Both params optional, existing calls unaffected.
- **Step order C2 → D**: description/summary execute before transition so workflow rule conditions check updated state. Prevents "rule would pass if field X were changed first" conflicts.

## Technical Details

**Client Layer** (`src/jira/client.ts`):
```typescript
async updateFields(issueKey: string, fields: { summary?: string; description?: string }): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (fields.summary !== undefined) payload.summary = fields.summary;
  if (fields.description !== undefined) payload.description = fields.description;
  if (Object.keys(payload).length === 0) return;
  await this.http.put(`/issue/${issueKey}`, { fields: payload });
}
```

**Tool Schema** (`src/jira/tools/issue-tools.ts`):
- `summary`: z.string().trim().min(1) — input hygiene, reject empty after trim
- `description`: z.string().min(1) — no trim, preserve user's wiki formatting (bullets, code blocks, etc.)
- Both optional, empty-check updated to include both

**Handler Flow**:
- Step C2 (new): calls updateFields if either param set; logs `✏️ Summary: "[new]"` or `📝 Description: đã cập nhật ([N] ký tự)`
- Step D: transition executes after, sees fresh fields
- No dryRun preview (differs from delete_worklog safety pattern; text edits lower risk)

## Verification

- `npm run build` passed, no TS errors (run twice — after implement, after emoji fix)
- No automated test suite in repo; verification = build + code review reading
- Code review (code-reviewer subagent): PASS, 5/5 acceptance criteria, 1 minor fixed (emoji 🏷️ collision → ✏️ for summary)
- Manual MCP Inspector test (requires live Jira + PAT) — user responsibility post-merge

## Unresolved Questions

None. Design chilled with user; implementation delivered as spec.

---

**Status:** DONE  
**Summary:** Shipped description + summary editing for update_issue. Build passes, docs synced, backward compat verified by review. Code review minor (emoji) resolved. Live MCP Inspector check pending (user).
