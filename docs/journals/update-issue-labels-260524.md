# update_issue labels support

Date: 2026-05-24
Component: Jira MCP Server — `update_issue`, `JiraClient`, docs

## Summary

Implemented v1.4.0 labels support in existing `update_issue` tool. No new tool added.

## Changes

- Added `JiraClient.updateLabels(issueKey, { add, remove, clear })`.
- Added `addLabels`, `removeLabels`, `clearLabels` Zod fields to `update_issue`.
- Added pre-flight conflict check before any Jira write when the same label appears in add/remove.
- Preserved combine flow order: assignee → labels → due date → transition → comment.
- Synced runtime/config/package/docs version metadata to v1.4.0.
- Updated README examples and live docs to current `issueKey` schema and split tool registration pattern.

## Decisions

- `clearLabels + addLabels` uses one atomic `fields.labels` write.
- Add/remove mode uses Jira `update.labels` operations to avoid touching unrelated labels.
- Missing labels in `removeLabels` remain Jira-idempotent.
- `issue-tools.ts` refactor deferred; current size is 334 LOC and outside this task.

## Verification

- `npm run build` passed.
- `npm test --if-present` exited 0; package has no test script.
- `git diff --check` passed.
- Manual MCP Inspector Jira write test remains user-side after merge.

## Unresolved Questions

None.
