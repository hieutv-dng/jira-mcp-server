---
title: "Add list_worklogs tool to Jira MCP server"
description: "Bổ sung tool truy vấn worklog: tổng giờ đã log, list issues + giờ/issue trong khoảng thời gian"
status: completed
priority: P2
branch: "main"
tags: ["jira", "mcp-tool", "worklog"]
blockedBy: []
blocks: []
created: "2026-04-29T08:41:57.417Z"
createdBy: "ck:plan"
source: skill
---

# Add list_worklogs tool to Jira MCP server

## Overview

Thêm 1 MCP tool `list_worklogs` để truy vấn worklog của 1 user trong khoảng thời gian, aggregate theo issue. Đáp ứng nhu cầu: "tôi/ai đó đã log bao nhiêu giờ tháng này, trên những task nào, mỗi task bao nhiêu giờ".

**Scope:** Read-only query tool. Không sửa worklog. KISS — 1 tool đủ.

**Brainstorm reference:** không có file rời (in-conversation). Quyết định chốt:
- 1 tool duy nhất `list_worklogs`
- Hỗ trợ user bất kỳ (default = current user)
- Default range: tháng hiện tại (`YYYY-MM-01` → today)
- Output: bảng aggregate theo issue + tổng giờ

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Client API](./phase-01-client-api.md) | Completed |
| 2 | [Tool & Formatter](./phase-02-tool-formatter.md) | Completed |
| 3 | [Test & Docs](./phase-03-test-docs.md) | Completed |

## Dependencies

Không phụ thuộc plan khác. Dùng lại `searchIssues()` và `getCurrentUser()` đã có trong `src/jira/client.ts`.

## Architecture Summary

```
Claude → MCP stdio → tools.ts (list_worklogs handler)
  ├─ jira.getCurrentUser()              [nếu username trống]
  ├─ jira.searchIssues(jql, maxResults) [JQL: worklogAuthor + worklogDate]
  └─ Promise.all(jira.getIssueWorklogs(key) for each issue)
       └─ filter author + started ∈ [from, to] → sum timeSpentSeconds
  → formatter.formatWorklogSummary(rows, total, meta)
  → Markdown table response
```

## Success Criteria

- [x] User chạy `list_worklogs` không param → trả tổng giờ tháng này của current user
- [x] User truyền `username, dateFrom, dateTo` → filter đúng
- [x] Output: bảng issueKey · summary · hours + Total
- [x] N+1 calls chạy parallel (`Promise.all`)
- [x] Compile sạch, không break tools cũ
- [x] README + CLAUDE.md cập nhật count tool: 6 → 7

## Validation Log

### Session 1 — 2026-05-04
**Trigger:** `/ck:plan validate` trước khi cook
**Questions asked:** 4

#### Verification Results
- **Tier:** Standard (3 phases)
- **Roles:** Fact Checker + Contract Verifier
- **Claims checked:** 12
- **Verified:** 12 | **Failed:** 0 | **Unverified:** 0
- **Spot-checks:**
  - `addWorklog` @ `src/jira/client.ts:198` ✓
  - `searchIssues` @ `src/jira/client.ts:152` (returns `res.data` raw → `.issues[].key` + `.fields.summary` ✓)
  - `getCurrentUser` @ `src/jira/client.ts:131` ✓
  - `// ─── WORKLOG ──────` @ `src/jira/client.ts:190` ✓
  - `TOOL_CHAINING` / `withErrorHandler` / `getChainHint` @ `src/shared/utils.ts:61/36/79` ✓
  - `formatIssueForAI` / `formatIssueListForAI` / `formatCurrentUser` @ `src/jira/formatter.ts:74/37/210` ✓
  - `log_work` block @ `src/jira/tools.ts:205` (TOOL 3) ✓
  - `update_issue` @ `src/jira/tools.ts:243` (commented "TOOL 4" — sequential gap noted) ✓
  - `create_issue` @ `src/jira/tools.ts:314` (commented "TOOL 6" — gap at 5) ✓
  - `README.md:14` "6 Tools:" ✓ ; `CLAUDE.md:7` "6 tools" ✓

#### Questions & Answers

1. **[Assumptions]** Plan dùng `author.name === resolvedUser` để filter worklog entries. Nếu user truyền display name, JQL `worklogAuthor` trả 0 issues silently. Xử lý?
   - Options: Strict username + doc rõ (Recommended) | Resolve qua user search API | Accept cả username + accountId
   - **Answer:** Strict username + doc rõ
   - **Rationale:** Giữ KISS, chỉ document rõ trong tool description. Empty-state message của formatter đã in user/range để user tự verify.

2. **[Risks]** `started.slice(0,10)` lexicographic compare có thể off-by-one nếu Jira server timezone ≠ user timezone. Xử lý?
   - Options: Lexicographic như plan (Recommended) | Parse Date + toISOString | Bỏ filter date phía client
   - **Answer:** Lexicographic như plan
   - **Rationale:** Team nội bộ cùng timezone Asia/Saigon. Filter client-side là double-check phòng JQL `worklogDate` mismatch — đủ tốt cho 95% case.

3. **[Architecture]** Cap maxResults = 100 có thể quá thấp. Bound ra sao?
   - Options: Cap 100 + warn truncated (Recommended) | Pagination tự động | Tăng cap lên 500
   - **Answer:** Tăng cap lên 500
   - **Rationale:** User active có thể log work cho >100 issues/tháng. 500 đủ headroom mà tránh complexity của pagination. Truncated warning vẫn giữ.

4. **[Architecture]** Tool numbering `// ── TOOL 3.5: ──` vs gap hiện tại (TOOL 0,1,2,3,4,6). Convention?
   - Options: Renumber: 4=list_worklogs, 5=update_issue, 6=create_issue (Recommended) | Giữ TOOL 3.5 như plan | Bỏ numbering hoàn toàn
   - **Answer:** Renumber: 4=list_worklogs, 5=update_issue, 6=create_issue
   - **Rationale:** Comment numbering phải sequential để dễ đọc. Tận dụng gap sẵn có ở TOOL 5.

#### Confirmed Decisions
- Username resolution: strict username, no API fallback
- Date compare: lexicographic, no timezone parsing
- maxResults cap: 500 (was 100)
- Tool comment: renumber `update_issue` → TOOL 5, list_worklogs chiếm slot TOOL 4

#### Action Items
- [x] Phase 2: đổi `MAX = 100` → `MAX = 500`
- [x] Phase 2: đổi comment `// ── TOOL 3.5: ──` → `// ── TOOL 4: Truy vấn worklog ──`
- [x] Phase 2: bổ sung step renumber `// ── TOOL 4: Cập nhật issue ──` → `// ── TOOL 5: ──`
- [x] Phase 2: cập nhật truncated warning text "100" → "500"

#### Impact on Phases
- **Phase 1:** Không đổi.
- **Phase 2:** Cập nhật Architecture/Implementation Steps cho MAX=500 + renumber comments. Risk Assessment ghi chú parallel call worst-case 500.
- **Phase 3:** Không đổi (test scenarios vẫn valid).

#### Recommendation
✅ **Proceed to cook.** Verification 100% passed, không có FAILED, decisions confirmed và đã propagate xuống phase-02.

