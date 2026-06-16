---
title: "Thêm sửa description + summary(title) cho update_issue"
description: "Mở rộng update_issue: thêm 2 param optional description + summary, replace toàn bộ, dùng JiraClient.updateFields (1 PUT gộp)"
status: done
priority: P2
branch: "main"
tags: [jira, update_issue, description, summary]
blockedBy: []
blocks: []
created: "2026-06-16T02:21:21.137Z"
createdBy: "ck:plan"
source: skill
---

# Thêm sửa description + summary(title) cho update_issue

## Overview

Tool `update_issue` thiếu khả năng sửa `description` và `summary` (tiêu đề). Feedback user xác nhận không sửa được mô tả. Mở rộng `update_issue` thêm 2 param optional, dùng đúng pattern `PUT /issue/{key}` sẵn có. Replace toàn bộ (không append). An toàn ghi theo convention hiện tại (agent hỏi user xác nhận). Backward-compatible — chỉ thêm param optional.

Brainstorm: `plans/reports/brainstorm-260616-0914-update-issue-description-summary-report.md`

## Acceptance Criteria

- [x] `update_issue({ issueKey, description })` → replace description, report xác nhận.
- [x] `update_issue({ issueKey, summary })` → replace summary (title).
- [x] Combine được với assignee/labels/dueDate/transition/comment trong 1 call.
- [x] Guard "không có thay đổi" tính cả description/summary.
- [x] `npm run build` pass; verify thủ công qua `npm run inspect` (⏳ user chạy live với issue thật).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Implement](./phase-01-implement.md) | Complete |
| 2 | [Docs](./phase-02-docs.md) | Complete |
| 3 | [Verify](./phase-03-verify.md) | Complete (build pass; live inspect = user) |

## Dependencies

- Không có hard dependency.
- **Coordination note:** plan `260529-1636-require-resolution-on-resolve-transition` (pending) cũng sửa cùng file `src/jira/tools/issue-tools.ts` nhưng concern khác (validate resolution). Hai thay đổi additive độc lập — ai implement sau cần merge cẩn thận trong handler `update_issue`, không có conflict logic.

## Validation Log

### Session 1 — 2026-06-16
**Trigger:** `/ck:plan validate` — phỏng vấn câu hỏi phản biện trước khi implement.
**Questions asked:** 3

#### Verification Results
- Claims checked: 14
- Verified: 14 | Failed: 0 | Unverified: 0
- Tier: Standard (3 phase — Fact Checker + Contract Verifier)
- Evidence: `updateDueDate` client.ts:332, `updateLabels` client.ts:343, pattern `PUT /issue/{key}` `{ fields }` (322/333/348/361); region `COMMENTS` bắt đầu client.ts:366 (vị trí chèn `updateFields` hợp lệ); guard "không có thay đổi" đúng `issue-tools.ts:254`; field cuối schema `comment` 225-226; Step C due-date 301-315 → Step D transition 317; README bảng tool dòng 112; CLAUDE.md "8 tools" dòng 7.
- Failures: none.

#### Questions & Answers

1. **[Assumption/Scope]** Schema dự kiến `description: z.string().min(1)` → KHÔNG thể set description rỗng (xoá sạch mô tả). Có cần hỗ trợ "xoá sạch description" không?
   - Options: Không cần, chỉ replace (giữ min(1)) | Có, thêm clear (sentinel 'clear' hoặc empty string)
   - **Answer:** Không cần, chỉ replace
   - **Rationale:** Đúng nhu cầu user (sửa được mô tả). Giữ `min(1)`, không thêm nhánh clear. Phase 1 giữ nguyên.

2. **[Risk]** Replace description ghi đè toàn bộ mô tả cũ (không khôi phục được). Convention (⚠️ trong tool description) đủ hay cần dryRun preview như delete_worklog?
   - Options: Convention đủ | Thêm dryRun preview old→new
   - **Answer:** Convention đủ
   - **Rationale:** Nhất quán với assignee/labels/transition (cùng dựa convention). Không thêm nhánh flow. Risk Assessment Phase 1 giữ nguyên.

3. **[Assumption]** Jira Server giới hạn summary 255 ký tự. Pre-validate hay để Jira báo lỗi?
   - Options: Để Jira báo lỗi (interceptor format rõ) | Thêm `.max(255)`
   - **Answer:** Để Jira báo lỗi
   - **Rationale:** YAGNI, khớp pattern tối giản hiện tại (dueDate chỉ regex). Schema `summary` giữ `z.string().trim().min(1)`, KHÔNG thêm `.max(255)`.

#### Confirmed Decisions
- Description: replace-only, giữ `min(1)`, không hỗ trợ clear/empty.
- An toàn ghi đè: convention-based (cảnh báo trong tool description), không thêm dryRun cho description/summary.
- Summary length: không pre-validate `.max(255)`, để Jira trả lỗi.

#### Impact on Phases
- Phase 1/2/3: không thay đổi. Cả 3 quyết định xác nhận plan as-is.

#### Whole-Plan Consistency Sweep
- Re-read `plan.md` + `phase-01..03`. Không có thuật ngữ/field/API stale; không claim bị superseded (mọi quyết định khớp nội dung phase đã viết). Schema `min(1)` cho description, không `.max(255)` cho summary, không nhánh clear/dryRun — nhất quán toàn plan.
- Unresolved contradictions: none.
