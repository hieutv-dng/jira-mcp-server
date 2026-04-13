# Code Review: Tool Consolidation 9 -> 6

## Scope
- Files: `src/jira/tools.ts`, `src/jira/client.ts`, `src/shared/utils.ts`
- Focus: tool merging logic, stale references, type safety
- TypeScript compile: PASS (no errors)

## Overall Assessment

Refactoring logic is sound. The 4 handler cases in `update_issue` are correct and mutually exclusive. The `create_issue` dryRun path properly absorbs `get_create_meta` functionality. Two critical issues found: stale tool names in config/docs and a duplicated API call.

---

## Critical Issues

### C1. `mcp-config.json` still references removed tools

**File:** `mcp-config.json:8-11`

`requireConfirmation` array still lists `update_issue_status` and `add_comment` -- both removed. If the MCP runtime uses this config to enforce confirmation, `update_issue` will bypass confirmation since it is not in the list.

**Fix:**
```json
"requireConfirmation": [
  "log_work",
  "update_issue",
  "create_issue"
]
```

### C2. Stale tool name in `tools.ts` line 577

```
"💡 Để kiểm tra PAT hoạt động, thử gọi `list_my_open_issues` để xem issues."
```

Tool was renamed to `list_issues`. LLM will try to call a nonexistent tool.

**Fix:** Replace `list_my_open_issues` with `list_issues`.

### C3. Stale tool reference `extract_latest_requirements` (line 652)

```
> 👉 Chạy `extract_latest_requirements` trước khi implement...
```

This tool does not exist in the current 6-tool set. LLM will hallucinate a tool call.

**Fix:** Either remove the drift warning reference or point to an existing tool/workflow.

---

## High Priority

### H1. Redundant `getTransitions` call in `update_issue` Case 4

**File:** `tools.ts:267-270`

```ts
const transitions = await jiraClient.getTransitions(issueKey); // call #1
const available = transitions.map(...);
await jiraClient.transitionIssue(issueKey, transitionName!, ...); // internally calls getTransitions again (call #2)
```

`transitionIssue()` in `client.ts:189` fetches transitions internally to resolve the name to ID. This means Case 4 makes 2 identical API calls to `/issue/{key}/transitions`.

**Impact:** Extra API latency + unnecessary Jira load.

**Fix options:**
1. Pass the already-fetched transitions list into `transitionIssue` to skip the internal fetch
2. Or remove the pre-fetch in tools.ts and build the `available` string from client response (post-transition the list may change anyway)

### H2. `updatePat()` duplicates interceptor logic

**File:** `client.ts:67-103`

The error interceptor is copy-pasted from constructor. If the error formatting logic changes, both copies must be updated.

**Fix:** Extract interceptor into a private method:
```ts
private registerErrorInterceptor() {
  this.http.interceptors.response.use(
    (res) => res,
    (err) => { /* shared logic */ }
  );
}
```

---

## Medium Priority

### M1. Stale references in docs and README

Many files still reference old tool names:
- `README.md`: 15+ references to `list_my_open_issues`, `update_issue_status`, `add_comment`, `get_available_transitions`
- `docs/code-standards.md`, `docs/codebase-summary.md`, `docs/system-architecture.md`, `docs/project-overview-pdr.md`: dozens of stale references

These docs guide LLM behavior. Stale names = LLM tries nonexistent tools.

### M2. `create_issue` validation is runtime-only (no Zod enforcement)

Fields like `summary`, `description`, `priority`, `labels`, `spda`, `congDoan`, `dueDate` are declared `.optional()` in Zod schema but validated manually at runtime (line 445-453). This works but loses the benefit of Zod's compile-time type narrowing -- inside the handler, all these are `T | undefined` even after the validation check, requiring `!` assertions or re-checks downstream.

Not blocking, but a `.refine()` or conditional schema would be cleaner.

### M3. `dryRun` with `comment` or `transitionName` silently ignored in `update_issue`

If user passes `{ dryRun: true, transitionName: "Done", comment: "finished" }`, the dryRun branch executes and the transition/comment are silently discarded. Consider warning the user that extra params are ignored in dryRun mode.

---

## Low Priority

### L1. Tool numbering comments are non-sequential

Comments say TOOL 1, TOOL 2, TOOL 3, TOOL 4, TOOL 6, TOOL 8. Missing 5 and 7 after consolidation. Cosmetic only.

---

## Positive Observations

1. Case logic in `update_issue` is clean and mutually exclusive -- no ambiguity
2. `create_issue` dryRun has graceful fallback chain (createmeta -> latest issue -> raw value)
3. Error messages include actionable hints (`dryRun=true` suggestion)
4. `withErrorHandler` wrapper ensures no unhandled rejections crash the MCP server
5. TOOL_CHAINING map in `utils.ts` correctly updated to new tool names

---

## Recommended Actions (priority order)

1. **[Critical]** Update `mcp-config.json` requireConfirmation list
2. **[Critical]** Fix `list_my_open_issues` reference in PAT tool message (line 577)
3. **[Critical]** Fix or remove `extract_latest_requirements` reference (line 652)
4. **[High]** Eliminate duplicate `getTransitions` call in Case 4
5. **[High]** Extract interceptor to avoid copy-paste in `updatePat`
6. **[Medium]** Update README.md and docs/ to reflect new tool names
7. **[Medium]** Warn when dryRun ignores transition/comment params

## Metrics
- Type Coverage: PASS (strict mode, no errors)
- Test Coverage: N/A (no test files found)
- Linting Issues: 0

## Unresolved Questions
- Is `extract_latest_requirements` planned as a future tool, or should drift warning reference be removed entirely?
- Does the MCP runtime actually enforce `mcp-config.json` requireConfirmation, or is it advisory only?
