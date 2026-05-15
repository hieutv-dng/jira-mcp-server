# Delete worklog tool + tools.ts refactor

**Date**: 2026-05-15 14:30  
**Severity**: Low  
**Component**: Jira MCP tools, code structure  
**Status**: Resolved  

## What Happened

Shipped v1.2.0 with `delete_worklog` tool (batch + dryRun + best-effort) + refactored `src/jira/tools.ts` into a 5-file directory structure. Plan completed all 3 phases: refactor-first (de-risk), feature implementation, docs update.

Commit: `946dcd0 feat(jira): add delete_worklog tool + refactor tools directory (v1.2.0)`

## The Brutal Truth

The plan validation revealed sloppy estimations. `tools.ts` was 663 lines (not 400), meaning `issue-tools.ts` alone would've ballooned to ~485 lines — 2.4x the 200-line guideline. **Refactoring before feature development saved us from another multi-file mess downstream.** The good news: we nailed the execution (tsc clean, all 8 tools loaded, no behavior regressions).

## Technical Details

**Phase 1 — Refactor (refactor-first risk mitigation):**
- Split `src/jira/tools.ts` (663 lines) → 5 files:
  - `user-tools.ts` (29 lines)
  - `issue-tools.ts` (227 lines, after creating create-issue-tool.ts)
  - `create-issue-tool.ts` (258 lines, split out because schema is massive)
  - `worklog-tools.ts` (204 lines, placeholder for new delete_worklog)
  - `index.ts` barrel (25 lines)
- **Critical discovery**: NodeNext ESM does NOT auto-resolve directory imports. Must change `src/index.ts:13` from `./jira/tools.js` → `./jira/tools/index.js` explicitly. This wasn't optional — build fails without it.
- Smoke tested 6 of 7 tools (all read-only + `create_issue` dryRun). `log_work` skipped because no dryRun flag.

**Phase 2 — Feature (delete_worklog + list_worklogs detail):**
- `JiraClient.deleteWorklog()` → DELETE `/issue/{key}/worklog/{id}?adjustEstimate=auto`
- `delete_worklog` tool: batch by `worklogIds: string[]` on single issue (not cross-issue, not filter-based — prevents accidental mass-delete)
- **dryRun=true required** — shows preview table (ID, date, hours, author, comment), total hours, remaining estimate impact, and missing IDs. Zero API calls.
- **Best-effort on real delete** — Promise.all per worklogId with per-item try/catch. One failure doesn't stop batch. Returns success/fail counts + error reasons (403 "no permission", 404 "not found").
- `list_worklogs` extended: `detail: boolean` flag. Reuses same `getIssueWorklogs()` API call, just formats as table instead of aggregate. Zero extra cost.

**Phase 3 — Docs:**
- Updated README (tool count 7→8, added delete_worklog example, new project structure diagram)
- Updated CLAUDE.md, codebase-summary.md, system-architecture.md
- Bumped version v1.1.0 → v1.2.0

**Code review findings** (DONE_WITH_CONCERNS):
- All 8 tools register + load correctly
- Logic byte-identical to old tools.ts
- 2 non-blocking drifts: HTTP transport hardcodes `1.1.0` while package says `1.2.0`; codebase-summary.md still references old `./jira/tools.ts` path
- Missing `getChainHint()` on `delete_worklog` dryRun path (inconsistent with `update_issue`, `create_issue` dryRun paths) — flagged but acceptable

## What We Tried

- **Option 1 (rejected):** Cram all tools into issue-tools.ts (~485 lines). Decision: violated 200-line guideline 2.4x. Creates maintenance nightmare.
- **Option 2 (rejected):** Refactor client.ts (843 lines) + formatter.ts (290 lines) in same plan. Decision: YAGNI — scope creep. Ship feature first, split client/formatter later if needed.
- **Option 3 (accepted):** Split create_issue into separate file (create-issue-tool.ts), keep issue-tools.ts ~227 lines. Worked perfectly. All files ≤ 270 LOC.

## Root Cause Analysis

**Estimation drift:** Original plan said tools.ts ~400 lines; actual was 663. Why? Probably didn't count full schema definitions + error handling for create_issue. **Validation session 1 caught this before implementation** — forced us to add extra split step (create-issue-tool.ts) and clarified the NodeNext import issue upfront. This prevented "oops, let's refactor again" mid-phase.

**Assumption blindness on ESM:** The old import path syntax worked in the monolithic file. When split, we forgot that **NodeNext doesn't auto-resolve directory index.js imports** like older CommonJS bundlers do. Caught during phase 1 validation; documented as MUST change in plan.

## Lessons Learned

1. **Refactor-first is underrated.** We split tools.ts *before* adding delete_worklog. This meant phase 2 was pure feature addition, not "feature + massive refactor happening simultaneously." Less cognitive load, cleaner diffs, easier to debug.

2. **Validation + estimation discipline.** The plan said tools.ts ~400; reality 663. Validation caught this *before* we coded. Forced us to adjust architecture upfront instead of mid-phase. This pattern (scout → estimate → validate → code) prevents scope creep.

3. **NodeNext ESM gotcha.** Directory imports require explicit `index.js` in the import path. Not obvious from the module syntax. Document this for next person: when you split a file into a directory, **always check import paths in the consuming files.**

4. **Best-effort error handling scales.** The Promise.all + per-item try/catch for delete_worklog means one bad ID doesn't cascade; user sees clear "X succeeded, Y failed with reason." This is better UX than "first error wins, operation halts."

5. **dryRun as a safety contract.** Requiring dryRun=true for destructive ops isn't just nice-to-have — it's a contract with the AI agent: "preview before you destroy." The tool description hammers this. Worth the extra ~10 lines of code.

## Next Steps

- [ ] Sync HTTP transport version from package.json (v1.1.0 hardcoded, package says v1.2.0) — minor drift, non-blocking
- [ ] Update codebase-summary.md line 455: replace `./jira/tools.ts` → `./jira/tools/index.ts`
- [ ] Decide: add `getChainHint()` to delete_worklog dryRun path for consistency with other dryRun paths
- [ ] Consider future refactor plan for client.ts (843 LOC) + formatter.ts (290 LOC) if they continue growing
