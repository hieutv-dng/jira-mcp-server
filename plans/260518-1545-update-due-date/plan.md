---
title: "Update Due Date in update_issue tool"
description: "Mở rộng update_issue thêm param dueDate (set/clear) với regex validation và past-date warning"
status: completed
priority: P2
branch: "main"
tags: [feature, jira-tool, update-issue]
blockedBy: []
blocks: []
created: "2026-05-18T08:44:12.772Z"
completed: "2026-05-18T09:30:00.000Z"
createdBy: "ck:plan"
source: skill
---

# Update Due Date in update_issue tool

## Overview

Bổ sung tính năng update due date qua MCP. Mở rộng tool `update_issue` thêm param `dueDate` hỗ trợ set (`YYYY-MM-DD`), clear (`'clear'`), past-date warning. Reuse pattern combine (assignee + transition + comment) đã có.

Context: `plans/reports/brainstorm-260518-update-due-date.md`

## Scope

**In:** Schema + handler + client method + report line + docs.
**Out:** Relative date, bulk update, đổi due date qua create_issue (đã có).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Implement Client Method](./phase-01-implement-client-method.md) | Completed |
| 2 | [Extend update_issue Tool](./phase-02-extend-update-issue-tool.md) | Completed |
| 3 | [Update Docs](./phase-03-update-docs.md) | Completed |

## Key Files

- `src/jira/client.ts` — add `updateDueDate()`
- `src/jira/tools/issue-tools.ts` — extend `update_issue` schema + handler
- `README.md`, `docs/codebase-summary.md`, `docs/project-overview-pdr.md` — doc updates
- `package.json` — version bump decision

## Dependencies

No cross-plan dependency. Standalone feature, additive change (backward compat).

## Validation Log

### Session 1 — 2026-05-18

**Verification Results**
- Tier: Standard (3 phases) — Fact Checker + Contract Verifier
- Claims checked: 15 | Verified: 13 | Failed: 0 | Surfaced: 4 design issues
- Verified anchors: `client.ts:308` updateAssignee, `client.ts:57` interceptor, `issue-tools.ts` schema/handler/empty-check/combine (186/203/217/226), README.md (7/112/151), `project-overview-pdr.md:7`, `codebase-summary.md:172` update_issue row, `package.json` v1.2.0
- Note: `issue-tools.ts` đã 258 LOC (vượt soft cap 200) — tồn tại từ trước, plan không làm xấu hơn đáng kể (~+30 LOC). Để dành cho refactor sau.

**Decisions**

1. **Past-date timezone** → Giữ UTC. Warning text format: `📅 Due date: YYYY-MM-DD (⚠️ đã qua so với hôm nay UTC YYYY-MM-DD)`. Note rõ "UTC" để user VN biết edge case (trước 7h UTC = hôm qua VN). Lý do: warning chỉ là cảnh báo, không block.
2. **Partial success on combine fail** → Chấp nhận. Pattern hiện tại (assignee đã đổi rồi transition fail cũng không revert) giữ nguyên. Nếu step sau fail, error message của axios interceptor sẽ chứa Jira reason. Steps đã chạy thành công không cần list lại vì error đã throw. KISS.
3. **Step labels relabel** → Rename A(Assignee) → B(Due date NEW) → C(Transition) → D(Comment standalone). Update 2 comment dòng cũ trong `issue-tools.ts:240, 247`.
4. **codebase-summary.md:172** → Thêm `dueDate?` vào input column của row `update_issue`. Thêm bullet `updateDueDate(key, value | null)` ở client methods section.

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01, phase-02, phase-03
- Decision deltas checked: 4 (timezone note, partial-fail, step labels, codebase-summary row)
- Reconciled stale references: phase-02 (timezone note + step labels), phase-03 (codebase-summary line 172)
- Unresolved contradictions: 0
