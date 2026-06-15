# Brainstorm — Giới hạn 50 assignable users

**Ngày:** 2026-06-15
**Trạng thái:** Đã chốt hướng — chờ implement
**Project verify:** SPTN (>50 members)

## Vấn đề

`getAssignableUsers` hardcode `maxResults: 50` → tool chỉ lấy tối đa 50 thành viên. Xác nhận:

- **Code:** `src/jira/client.ts:725-731` — `params: { project, maxResults: 50 }`.
- **Thực tế:** `create_issue` dryRun trên SPTN trả về đúng "Tổng: 50 thành viên", cắt giữa alphabet tại "Trần Minh Quang" (`quangtm2903`). SPTN còn members sau #50 nhưng không hiển thị.

## Không chỉ cosmetic — functional bug

`getAssignableUsers` (cap 50) ảnh hưởng 3 luồng, gồm cả write ops:

| Luồng | Call site | Hậu quả khi project > 50 |
|-------|-----------|--------------------------|
| `create_issue` dryRun display | `create-issue-tool.ts:134` | Chỉ thấy 50 user đầu |
| `create_issue` assign | `client.ts:593 → resolveAssignee → getAssignableUsers` | Assign FAIL nếu người gán sau #50 |
| `update_issue` assign | `client.ts:318 → updateAssignee → resolveAssignee` | Assign FAIL tương tự |

`resolveAssignee` fuzzy-match chỉ trên 50 user đầu → ném "không tìm thấy" + top-3 gợi ý sai cho user hợp lệ nằm sau #50.

## Hướng đã đánh giá

- **A — nâng maxResults (CHỐT).** 1 dòng. Fix cả 3 luồng nếu project ≤ cap. Giữ nguyên fuzzy + top-3 + full dryRun list.
- **B — pagination loop (startAt).** Mọi quy mô, nhưng N API calls + phức tạp. → YAGNI cho quy mô hiện tại.
- **C — server-side `username` filter cho resolveAssignee.** Đúng + nhanh nhưng 2 code path, gợi ý fuzzy yếu hơn. → over-engineering.

## Quyết định

**Hướng A, `maxResults: 50 → 300`** (user chọn 300 thay 1000; quy mô mục tiêu ≤ vài trăm).

- **File đổi:** `src/jira/client.ts` — `getAssignableUsers`, `maxResults: 50` → `300`.
- **Không đổi:** `create-issue-tool.ts` display (`users.length` tự cập nhật số thật); `resolveAssignee` logic giữ nguyên.
- **Scope OUT:** pagination (B), server-side filter (C), refactor resolveAssignee.

## Acceptance criteria

1. Sau `npm run build`, `create_issue` dryRun trên SPTN hiển thị "Tổng: >50 thành viên" (đúng số thật, ≤300).
2. `create_issue`/`update_issue` assign cho user alphabet sau #50 (vd tên "Vũ…"/"Đ…") thành công, không còn "không tìm thấy".

## Rủi ro / cần kiểm chứng

- **Chưa verify được server có honor `maxResults>50`** — repo không có `.env.local`, MCP tool hardcode 50. Bước impl đầu tiên: rebuild + dryRun SPTN → xác nhận trả về >50. Nếu server cap thấp hơn project size → cân nhắc fallback B.
- Nếu sau này có project > 300 assignable users → vỡ lại; khi đó nâng tiếp hoặc chuyển B.

## Câu hỏi mở

- Không có.
