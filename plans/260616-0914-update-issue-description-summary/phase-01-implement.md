---
phase: 1
title: "Implement"
status: complete
priority: P1
effort: "1h"
dependencies: []
---

# Phase 1: Implement

## Overview

Thêm `JiraClient.updateFields` (1 PUT gộp summary+description) và mở rộng tool `update_issue` với 2 param optional `description`, `summary`.

## Requirements

- Functional: sửa được description và/hoặc summary qua `update_issue`; combine được với các thay đổi khác trong 1 call.
- Non-functional: backward-compatible (param optional); giữ format wiki markup của description nguyên vẹn (không trim); 1 HTTP call cho cả 2 field.

## Architecture

Tái dùng pattern sẵn có `PUT /issue/{key}` với `{ fields: {...} }`. Gộp summary+description vào 1 method `updateFields` (cả hai là text thuần, không cần resolve/ops như assignee/labels). Đặt step ghi field **trước transition** để workflow rule thấy field đã update (giống `dueDate`).

## Related Code Files

- Modify: `src/jira/client.ts` — thêm method `updateFields`
- Modify: `src/jira/tools/issue-tools.ts` — schema + flow + report + mô tả tool

## Implementation Steps

1. **`src/jira/client.ts`** — thêm method (đặt gần `updateDueDate`, khu vực `// ─── ISSUES ───` hoặc sau `updateLabels`):
   ```ts
   /**
    * Cập nhật các text field đơn giản của issue (summary, description).
    * Gộp 1 PUT — chỉ gửi field có giá trị. Description giữ nguyên wiki markup.
    */
   async updateFields(
     issueKey: string,
     fields: { summary?: string; description?: string }
   ): Promise<void> {
     const payload: Record<string, unknown> = {};
     if (fields.summary !== undefined) payload.summary = fields.summary;
     if (fields.description !== undefined) payload.description = fields.description;
     if (Object.keys(payload).length === 0) return;
     await this.http.put(`/issue/${issueKey}`, { fields: payload });
   }
   ```

2. **`src/jira/tools/issue-tools.ts`** — thêm vào Zod schema của `update_issue` (sau `comment`):
   ```ts
   summary: z.string().trim().min(1).optional()
     .describe("Tiêu đề (title) mới cho issue. Replace toàn bộ. Bỏ trống = không đổi. ⚠️ PHẢI hỏi user xác nhận trước khi đổi."),
   description: z.string().min(1).optional()
     .describe("Mô tả mới (wiki markup). Replace TOÀN BỘ description cũ — không append. Muốn thêm nội dung: đọc get_issue_detail trước rồi gửi lại full text. ⚠️ PHẢI hỏi user xác nhận trước khi ghi đè."),
   ```
   - Lưu ý: `description` KHÔNG `.trim()` để bảo toàn xuống dòng/format wiki markup; `summary` có `.trim()` vì title không nên có khoảng trắng thừa.

3. Thêm `summary`, `description` vào danh sách destructure tham số của handler `withErrorHandler("update_issue", async ({ ... })`.

4. Cập nhật guard "không có gì để làm" (hiện tại `issue-tools.ts:254`):
   ```ts
   if (!transitionName && !comment && !assignee && !dueDate && !hasLabelChanges && !description && !summary) {
   ```
   - Cập nhật cả message hint trong block đó để liệt kê thêm description, summary.

5. Thêm step ghi field **trước Step D (transition)** — sau Step C (due date):
   ```ts
   // Step C2: Summary / Description (set trước transition để workflow rule thấy field đã update)
   if (summary !== undefined || description !== undefined) {
     await jira.updateFields(issueKey, { summary, description });
     if (summary !== undefined) reportLines.push(`🏷️ Summary: "${summary}"`);
     if (description !== undefined) reportLines.push(`📝 Description: đã cập nhật (${description.length} ký tự)`);
   }
   ```
   - Không in full description vào report (tránh dài) — chỉ confirm + số ký tự.

6. Cập nhật chuỗi mô tả tool `update_issue` (đoạn description dài đầu `server.tool(...)`): bổ sung mention "Truyền summary để đổi tiêu đề (title). Truyền description để replace toàn bộ mô tả." và giữ nguyên cảnh báo xác nhận cuối.

## Success Criteria

- [ ] `JiraClient.updateFields` tồn tại, chỉ gửi field có giá trị, 1 PUT.
- [ ] Schema `update_issue` có `summary` (trim) + `description` (no trim), cả hai optional.
- [ ] Guard "không có thay đổi" tính cả description/summary.
- [ ] Step ghi field nằm trước transition; report in `🏷️ Summary` / `📝 Description (N ký tự)`.
- [ ] Mô tả tool đề cập 2 field mới + giữ cảnh báo xác nhận.
- [ ] Không phá vỡ call cũ (param optional, default behavior nguyên vẹn).

## Risk Assessment

- **Ghi đè mất description cũ:** giảm thiểu bằng convention — mô tả tool bắt agent hỏi user xác nhận; replace là hành vi được user chốt.
- **Summary rỗng:** `min(1)` chặn; Jira cũng yêu cầu summary non-empty.
- **Merge với plan require-resolution:** cùng file, khác vùng code (guard validate vs step ghi field) — không conflict logic, chỉ cần đặt đúng thứ tự step.
