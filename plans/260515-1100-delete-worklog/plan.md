---
title: "Delete worklog + tools.ts split"
description: "Bổ sung delete_worklog tool (batch + dryRun + best-effort), mở rộng list_worklogs với detail flag, refactor src/jira/tools.ts thành directory theo concern (user/issue/worklog)."
status: completed
priority: P2
branch: "main"
tags: [jira, mcp, tool-extension, refactor, worklog]
blockedBy: []
blocks: []
created: "2026-05-15T10:48:45.233Z"
createdBy: "ck:plan"
source: skill
---

# Delete worklog + tools.ts split

## Overview

Hiện tại MCP server thiếu cách xoá worklog đã log nhầm. Bổ sung `delete_worklog` (batch, dryRun, best-effort) + mở rộng `list_worklogs` với flag `detail` để expose worklogId. Đồng thời tách `src/jira/tools.ts` (~400 dòng) thành directory `src/jira/tools/` theo concern để khớp ngưỡng 200 dòng/file.

**Brainstorm reference:** [`plans/reports/brainstorm-260515-delete-worklog.md`](../reports/brainstorm-260515-delete-worklog.md)

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Refactor tools.ts into directory](./phase-01-refactor-tools-ts-into-directory.md) | Completed |
| 2 | [Implement delete_worklog + list_worklogs detail](./phase-02-implement-delete-worklog-list-worklogs-detail.md) | Completed |
| 3 | [Update docs and verify](./phase-03-update-docs-and-verify.md) | Completed |

## Key Decisions

- **Refactor trước, feature sau:** Phase 1 split `tools.ts` không thay đổi behavior, build + smoke test pass rồi mới thêm tool mới. Giảm rủi ro regression.
- **delete_worklog scope:** Batch theo `worklogIds: string[]` trên 1 issueKey. KHÔNG filter-based (rủi ro xoá nhầm). KHÔNG cross-issue (Jira API yêu cầu issueKey trong URL).
- **dryRun=true:** Bắt buộc theo description, AI agent phải chạy preview trước.
- **adjustEstimate=auto:** Jira tự cộng giờ vào remaining estimate (default behavior).
- **list_worklogs detail:** Reuse cùng API call (`getIssueWorklogs`), chỉ format khác. Không thêm cost.
- **Tools directory structure:** `user-tools.ts` / `issue-tools.ts` / `create-issue-tool.ts` / `worklog-tools.ts` + barrel `index.ts`. Phải đổi import path tường minh `./jira/tools.js` → `./jira/tools/index.js` (NodeNext ESM không support directory imports).

## Files Modified/Created

- `src/jira/client.ts` — thêm `deleteWorklog()` method (~10 lines)
- `src/jira/tools.ts` — **DELETE** (thay bằng directory) [actual ~663 dòng, plan cũ ghi sai ~400]
- `src/jira/tools/index.ts` — NEW barrel + `registerJiraTools()` (~30 lines)
- `src/jira/tools/user-tools.ts` — NEW `get_current_user` (~40 lines)
- `src/jira/tools/issue-tools.ts` — NEW 3 issue tools: list_issues + get_issue_detail + update_issue (~230 lines)
- `src/jira/tools/create-issue-tool.ts` — NEW `create_issue` riêng (~270 lines) [validation session 1]
- `src/jira/tools/worklog-tools.ts` — NEW 3 worklog tools incl. `delete_worklog` (~210 lines)
- `src/jira/formatter.ts` — thêm `formatWorklogDetail()` (~40 lines)
- `src/shared/utils.ts` — update `TOOL_CHAINING` cho `delete_worklog` + `list_worklogs` (~3 lines)
- `src/index.ts` — **MUST** đổi import `./jira/tools.js` → `./jira/tools/index.js` (NodeNext không auto-resolve directory) [validation session 1]
- `README.md` — tool count 7→8, thêm ví dụ (~20 lines)
- `docs/codebase-summary.md` — update structure + tools list
- `docs/system-architecture.md` — update tool diagram nếu có

## Out of Scope (YAGNI)

- Update worklog (sửa timeSpent/comment) — brainstorm riêng nếu cần
- Filter-based delete (date range, user)
- Cross-issue batch delete
- Setup test framework formal (codebase chưa có; manual test qua `npm run inspect` đủ)
- Refactor `client.ts` (843 dòng) và `formatter.ts` (290 dòng) — để plan riêng [validation session 1]
- Tách `issue-tools.ts` thêm theo từng tool — `~230 dòng sau khi tách create_issue ra riêng` chấp nhận được [validation session 1]

## Dependencies

Không có cross-plan dependency. Plan `260508-0903-update-issue-assign` đã merge vào main (commit 2ca0fc9), phase 2 chỉ là user validation không touch code → không block.

## Success Criteria (Plan Level)

- [ ] `npm run build` pass sau mọi phase
- [ ] 8 tools load đầy đủ qua `npm run inspect`
- [ ] 7 tool cũ hoạt động đúng (smoke test, gồm `create_issue` dryRun)
- [ ] `delete_worklog` xoá thành công 1 entry + verify trong Jira
- [ ] `delete_worklog` dryRun trả preview không gọi DELETE API
- [ ] `list_worklogs detail=true` show worklogId
- [ ] README + docs cập nhật tool count 7→8
- [ ] 5 file `src/jira/tools/*.ts` ≤ 270 dòng mỗi file

## Validation Log

### Session 1 — 2026-05-15
**Trigger:** `/ck:plan validate plans/260515-1100-delete-worklog/plan.md`
**Questions asked:** 4

#### Verification Results
- Claims checked: 12
- Verified: 8 | Failed: 4 | Unverified: 0
- Tier: Standard (3 phases)
- Failures:
  - `tools.ts` size: plan ~400 dòng vs actual 663 dòng (file:wc-l)
  - `issue-tools.ts` ~250 dòng estimate vs derived ~485 dòng (sum of list_issues 107 + get_issue_detail 29 + update_issue 84 + create_issue 265 từ tools.ts:69/176/315/399)
  - Phase 1 step 5 claim "Node ESM tự resolve `tools/index.js`": SAI — NodeNext ESM không hỗ trợ directory imports, phải đổi import path tường minh
  - `client.ts` 843 dòng + `formatter.ts` 290 dòng cũng vượt 200-line guideline (ngoài scope plan)

#### Questions & Answers

1. **[Architecture]** tools.ts thực tế 663 dòng (plan ghi ~400), sau split issue-tools.ts sẽ ~485 dòng (không phải ~250). Xử lý sao?
   - Options: Tách create_issue ra file riêng (Recommended) | Chấp nhận issue-tools.ts ~485 dòng | Tách theo từng tool riêng
   - **Answer:** Tách create_issue ra file riêng
   - **Rationale:** issue-tools.ts còn ~230 dòng + create-issue-tool.ts ~270 dòng. Tất cả file ≤ 270 dòng, sát guideline 200. create_issue có schema lớn (custom fields, dryRun metadata) nên tách riêng hợp lý.

2. **[Risk]** NodeNext ESM không auto-resolve directory imports. Cần đổi src/index.ts:13 từ './jira/tools.js' → './jira/tools/index.js'. Confirm?
   - Options: Đổi import path tường minh (Recommended) | Thử dùng tsconfig paths/exports field
   - **Answer:** Đổi import path tường minh
   - **Rationale:** Đúng spec NodeNext, đơn giản, 1 dòng. Tránh phức tạp hoá build config.

3. **[Scope]** client.ts (843 dòng) và formatter.ts (290 dòng) cũng vượt ngưỡng 200 dòng. Refactor cùng plan này?
   - Options: YAGNI — chỉ refactor tools.ts như plan (Recommended) | Thêm phase refactor client.ts + formatter.ts | Chỉ split client.ts thêm
   - **Answer:** YAGNI — chỉ refactor tools.ts như plan
   - **Rationale:** Giữ scope nhỏ, ship feature delete_worklog sớm. client.ts/formatter.ts để brainstorm + plan riêng nếu cần.

4. **[Assumption]** Phase 1 smoke test plan skip thực thi log_work + create_issue. Đủ chưa?
   - Options: Test cả 2 với dryRun=true nếu có (Recommended) | Giữ nguyên skip 2 tool write | Test cả 7 tool thực thi
   - **Answer:** Test cả 2 với dryRun=true nếu có
   - **Rationale:** `create_issue` có dryRun (metadata) → test được. `log_work` không có dryRun → chỉ verify schema load. Tăng coverage không tốn effort.

#### Confirmed Decisions
- 5 file trong `src/jira/tools/`: index, user-tools, issue-tools, create-issue-tool, worklog-tools
- `src/index.ts:13` import path **MUST** đổi sang `./jira/tools/index.js` (không phải optional verify)
- `client.ts` + `formatter.ts` refactor để plan sau, không gộp vào plan này
- Phase 1 smoke test thêm `create_issue` dryRun

#### Action Items
- [ ] Phase 1: thêm step tạo `create-issue-tool.ts`, cập nhật phase 1 architecture diagram
- [ ] Phase 1 step 5: viết lại — không phải "verify", mà là "MUST đổi import path"
- [ ] Phase 1 step 8: thêm `create_issue` dryRun test
- [ ] Phase 3: cập nhật docs reflect 5-file structure (không phải 4)

#### Impact on Phases
- **Phase 1:** Architecture diagram (5 file), implementation steps (+1 step tách create_issue), step 5 rewrite (import path mandatory), smoke test thêm create_issue dryRun
- **Phase 2:** Không đổi
- **Phase 3:** Docs reflect 5-file structure + import path note

### Whole-Plan Consistency Sweep
- Re-read plan.md + 3 phase files
- Files Modified section đã cập nhật 5 file
- Key Decisions đã reflect đổi import path tường minh
- Out of Scope giữ nguyên (client.ts/formatter.ts split là YAGNI)
- Success Criteria thêm check 5 file ≤ 270 dòng + smoke create_issue dryRun
- Không còn contradictions giữa overview, phase architecture, success criteria
- **Status:** Zero unresolved contradictions
