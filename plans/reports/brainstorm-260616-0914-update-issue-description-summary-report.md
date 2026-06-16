# Brainstorm: thêm sửa description/summary cho `update_issue`

**Date:** 2026-06-16
**Status:** Đã chốt thiết kế — sẵn sàng plan/implement
**Trigger:** Feedback user — tool Jira chưa sửa được description của issue.

## Problem

`update_issue` (`src/jira/tools/issue-tools.ts`) hỗ trợ assignee, labels, dueDate, transition, comment — **thiếu hẳn `description` và `summary`**. `JiraClient` không có `updateDescription`/`updateSummary`. Feedback xác nhận: không sửa được mô tả.

## Findings (scout)

- Mọi update field hiện dùng chung pattern `PUT /issue/{key}` với `{ fields: {...} }` (`updateAssignee`/`updateDueDate`/`updateLabels`).
- Jira Server/DC dùng **wiki markup** cho description → string thuần, ghi thẳng `fields.description`, không cần ADF/escape.
- `create_issue` đã set description lúc tạo (`client.ts:579`) → field hoạt động, chỉ chưa expose cho update.
- Convention an toàn ghi: tool yêu cầu agent hỏi user xác nhận trước khi thay đổi.

## Quyết định (user chốt)

| Điểm | Lựa chọn | Lý do |
|------|----------|-------|
| Phạm vi | `description` + `summary` | Cùng cơ chế PUT, chi phí thêm ~0, tránh sửa lần 2 |
| Chế độ sửa | Replace toàn bộ | KISS, không cần đọc trước; append để agent tự get rồi gửi full |
| An toàn ghi | Theo convention hiện tại | Nhất quán, agent bắt buộc hỏi user xác nhận |

Loại bỏ: tool mới (chọn mở rộng `update_issue` — DRY).

## Giải pháp

**1. `src/jira/client.ts`** — thêm method gộp:
```ts
async updateFields(issueKey: string, fields: { summary?: string; description?: string }): Promise<void>
// PUT /issue/{key} với { fields } — chỉ gửi field có giá trị; 1 HTTP call cho cả 2
```
Gộp thay vì 2 method riêng: cả hai là text thuần, batch 1 PUT tiết kiệm round-trip. (`updateAssignee`/`updateLabels` tách riêng vì có logic resolve/add-remove.)

**2. `src/jira/tools/issue-tools.ts`** — mở rộng `update_issue`:
- Schema: `summary: z.string().trim().min(1).optional()`; `description: z.string().min(1).optional()` (không trim — giữ format wiki markup).
- Guard "không có thay đổi" (`issue-tools.ts:254`): thêm `!description && !summary`.
- Step ghi field đặt **trước transition** (giống dueDate): gọi `jira.updateFields(...)` nếu có summary/description.
- Report: `📝 Description: đã cập nhật (N ký tự)` (không in full text); `🏷️ Summary: "..."`.
- Cập nhật mô tả tool + giữ cảnh báo xác nhận.

**3. Docs** — `README.md` + `CLAUDE.md`: cập nhật mô tả `update_issue`.

## Acceptance

- `update_issue({ issueKey, description })` → replace description, report xác nhận.
- `update_issue({ issueKey, summary })` → replace summary.
- Combine với assignee/labels/dueDate/transition/comment trong 1 call.
- `npm run build` pass; verify qua `npm run inspect`.

## Ngoài scope (YAGNI)

Append/prepend mode; dryRun preview description cũ; clear description bằng keyword; sửa priority/custom field (SPDA/Công đoạn); xử lý ADF/Cloud.

## Rủi ro

- Replace ghi đè mất nội dung cũ → convention: agent hỏi user xác nhận; mô tả tool cảnh báo.
- Summary là field bắt buộc Jira → `min(1)` chặn rỗng.

## Touchpoints

- `src/jira/client.ts` (thêm `updateFields`)
- `src/jira/tools/issue-tools.ts` (schema + flow + report + mô tả tool)
- `README.md`, `CLAUDE.md` (mô tả tool)

## Unresolved questions

- Có cần cho phép **clear description** (đặt rỗng) không? Hiện coi ngoài scope; nếu cần sau này thêm keyword `'clear'` giống dueDate.
