# Code Review — `delete_worklog` + tools/ refactor

**Plan:** `plans/260515-1100-delete-worklog/` · **Branch:** main · **Date:** 2026-05-15

## Status
**DONE_WITH_CONCERNS** — production-ready. Two minor doc/version drift items; no behavioral bugs.

## Critical bugs
**None.** `tsc` clean. All 8 tools register. No logic regressions.

## Acceptance criteria coverage

| # | Item | Result |
|---|------|--------|
| 1 | `registerJiraTools(server, client?)` signature compat | PASS — `tools/index.ts:18-19` singleton fallback |
| 2 | 7 existing tools behavior preserved | PASS — diffed each against `git show HEAD:src/jira/tools.ts`; only differences are file-boundary scaffolding and `// TOOL N` numbering. Schemas, JQL, response strings, control flow byte-identical |
| 3a | `delete_worklog` dryRun: list + preview, no DELETE | PASS — `worklog-tools.ts:172-194` early return |
| 3b | Real delete: Promise.all + per-item try/catch | PASS — `worklog-tools.ts:197-223` |
| 3c | 403/404 → descriptive messages | PASS — `worklog-tools.ts:204-206` |
| 3d | `adjustEstimate=auto` | PASS — `client.ts:236` |
| 4 | `list_worklogs.detail=true` flatten + filter + sort desc | PASS — filter `worklog-tools.ts:102-127` (mirrors aggregate); sort `formatter.ts:298` |
| 5 | NodeNext explicit `./jira/tools/index.js` | PASS — `src/index.ts:13`, `src/transports/http-transport.ts:5` |
| 6 | Build passes | PASS |
| 7 | All `tools/*.ts` ≤ 270 LOC | PASS — 25/29/79/204/227/258 |
| (a) | Logic lost? | NO — diff identical |
| (b) | Missing exports/types? | NO — `WorklogEntry` exported `formatter.ts:281`, imported `worklog-tools.ts:4` |
| (c) | All worklogIds invalid → no throw? | PASS — Promise.all wraps each in try/catch; all-fail path returns 0/N report |
| (d) | `detail=true` skips aggregate? | PASS — `if (detail) { ... return; }` line 102 returns before aggregate line 130 |
| (e) | `WorklogEntry` re-exported? | PASS |
| (f) | Lint/type errors? | NONE |
| (g) | Stale `tools.ts` refs? | 1 stale ref in `docs/codebase-summary.md:455` (Dependencies Tree). Lines 179-181 are intentional refactor notes — keep |

## Side effects / regressions
None. JQL, MAX=500 truncation, drift heuristic thresholds, response strings preserved verbatim.

## Recommendations (non-blocking)

1. **`src/transports/http-transport.ts:74`** — hardcoded `version: "1.1.0"` while `src/index.ts:19` + `package.json` say `1.2.0`. Version drift stdio vs HTTP. Fix: sync to `1.2.0` or read from package.json.
2. **`docs/codebase-summary.md:455`** — Dependencies Tree still shows `./jira/tools.ts`. Update to `./jira/tools/index.ts`.
3. **`worklog-tools.ts:193`** — `delete_worklog` dryRun path omits `getChainHint("delete_worklog")` (other dryRun paths in `update_issue:211`, `create_issue:164` do append). Intentional?
4. **`worklog-tools.ts:97`** — `Promise.all` over up to 500 issues fires unbounded concurrent HTTP calls. Pre-existing; flag for future hardening (p-limit batching).
5. **`worklog-tools.ts:107-109`** — date filter via `e.started.slice(0,10) >= from` correct for ISO YYYY-MM-DD but fragile if Jira format ever drifts. Pre-existing.

## Unresolved questions

1. Should HTTP transport version be sourced from `package.json` to avoid manual sync? (Recommend yes, out of scope.)
2. Is missing `getChainHint` on `delete_worklog` dryRun path intentional?
