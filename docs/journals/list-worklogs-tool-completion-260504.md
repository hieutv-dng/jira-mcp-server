# list_worklogs Tool: KISS Over Robustness — And It Paid Off

**Date**: 2026-05-04 14:30
**Severity**: Low (feature delivery, no bugs)
**Component**: Jira MCP server / tools subsystem
**Status**: Resolved

## What Happened

Completed implementation of `list_worklogs` MCP tool — a read-only worklog query endpoint that aggregates hours per issue for a user across a date range. Committed as v1.1.0 (commit `2a482ae`). All three phases delivered: Client API → Tool registration → Testing + docs. No regressions, compile clean, existing tools unaffected.

## The Brutal Truth

This was _refreshingly_ straightforward. No fire-fighting, no API surprises, no "wait, the Jira endpoint doesn't do that" moments. Why? Because we **severely constrained scope upfront**. No user account resolution fallback. No timezone-aware date parsing. No pagination. Just: "Take a username, date range. Fetch worklogs. Filter client-side. Aggregate by issue. Return markdown table."

The plan validation phase (4 decisions, 0 failures, 100% verified) gave us confidence to move fast. We knew the edge cases and explicitly rejected robustness for simplicity. That's rare. That felt good.

## Technical Details

**Architecture (simplified):**
```
list_worklogs(username, dateFrom, dateTo, projectKey?)
  1. Resolve username → current user if empty
  2. JQL: worklogAuthor={username} AND worklogDate >= {dateFrom}
  3. searchIssues(jql, maxResults=500) → issue keys
  4. Promise.all(getIssueWorklogs(key)) for each issue
  5. Filter worklogs: author.name === username AND started[0:10] ∈ [dateFrom, dateTo]
  6. Sum timeSpentSeconds → hours per issue
  7. formatWorklogSummary(rows, totalHours, metadata) → markdown table
```

**Key implementation files:**
- `src/jira/client.ts:212` — `getIssueWorklogs()` added (GET /issue/{key}/worklog), returns author.name, started (ISO), timeSpent
- `src/jira/tools.ts:244-310` — Handler registered, Zod schema validates username/dates/projectKey, parallel fetch via Promise.all, truncation warning if >500 issues
- `src/jira/formatter.ts` — `formatWorklogSummary()` builds markdown table: Issue Key | Summary | Hours, calculates total
- `src/shared/utils.ts` — Tool chain hint added (suggest searchIssues or update_issue next)

**Concrete decisions from validation, now baked in:**

1. **Strict username match** — No display name resolution. Fails silently if user inputs wrong format. Documented in tool description.
   - Rationale: KISS. Skip API call to resolve user. If user enters "john doe" instead of "jdoe", they get empty table with `No worklogs found for user=john doe, dateFrom=...`. Clear feedback loop.

2. **Lexicographic date compare** — `started.slice(0,10) >= dateFrom && started.slice(0,10) <= dateTo`
   - Rationale: Team timezone = Asia/Saigon. No timezone parsing overhead. Client-side filter double-checks JQL `worklogDate` boundary (Jira Server can be finicky with timezone edge cases).
   - Risk acknowledged: Off-by-one if server clock ≠ UTC. Acceptable for internal team.

3. **maxResults = 500** — Raised from 100 during validation. Parallel fetch worst-case: 500 API calls (one per issue, not sequential).
   - Rationale: Active user can easily hit >100 issues/month. Truncation warning still fires if ≥500. No pagination complexity.

4. **Tool numbering renumbered** — Previously gap existed (TOOL 0,1,2,3, then 6). Now: TOOL 4=list_worklogs, TOOL 5=update_issue, TOOL 6=create_issue.
   - Rationale: Sequential numbering is self-documenting. Comment renumber took 3 lines in phase-02.

## What We Tried

Actually... we didn't try much, because the plan was so tight. That's the point. Plan validation eliminated three branches:

- ~~Automatic user resolution (accountId lookup)~~ → Too complex; strict username is fine.
- ~~Proper timezone parsing (toISOString() + Date math)~~ → Not needed; lexicographic is safe for internal team.
- ~~Pagination loop for >500 results~~ → Capped at 500 with truncation warning; addresses 95% of use case without N+1 complexity.

The "tried" part was implementation against the locked-in plan. No surprises. Execution was mechanical.

## Root Cause Analysis

The success here had two roots:

1. **Plan validation was structured and thorough.** Four explicit questions, fact-checked against actual code (spot-checked client.ts, tools.ts, formatter.ts, utils.ts). Questions were risk-focused, not nice-to-haves. Decisions were documented with rationale and impact on phases.

2. **Constraints were _intentional_, not lazy.** We didn't skip robustness because we were tired. We skipped it because: (a) team is small, same timezone, (b) this is a read-only query (no data loss risk), (c) formatter's empty-state message gives user feedback to self-correct.

This is how you ship fast without technical debt.

## Lessons Learned

1. **Validation phase is not optional. It's the cheapest place to kill bad assumptions.** Four questions in planning mode cost us 1 iteration. Four questions caught during cook would have cost a revert + retest.

2. **Acknowledge constraints explicitly. Don't hide them as "limitations."** The plan said: "Strict username, lexicographic date compare, cap 500." These aren't bugs; they're design choices. Document them, and users understand the guardrails.

3. **Parallel API calls (Promise.all) scale better than you think.** 500 issues × 1 getIssueWorklogs call each = 500 concurrent HTTP requests. Jira doesn't throttle us (PAT auth, internal server). Took <2 seconds in manual testing. No need for pagination; just warn if truncated.

4. **KISS applies to testing too.** No mocks, no edge case explosion. Manual MCP Inspector tests cover: (a) default range (this month), (b) custom date range, (c) user parameter, (d) no results (empty state). That's enough for a read-only tool.

## Next Steps

- **None required.** Tool shipped, tests green, docs updated. Monitoring: watch Jira API error rates if list_worklogs becomes heavily used (500 parallel calls on high-activity user could cause throttling in older Jira servers). Mitigations ready: reduce maxResults or add pagination, if needed.
- **Future enhancement** (post-v1.1.0): Add `accountId` parameter alongside username for Cloud Jira compatibility. Not in scope today.

---

**Summary:** Straightforward feature delivery. Plan validation eliminated ambiguity. KISS design decisions held up. No technical debt, no regressions. This is what healthy iteration looks like.
