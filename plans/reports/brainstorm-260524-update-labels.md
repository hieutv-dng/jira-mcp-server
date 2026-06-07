# Brainstorm — Bổ sung Update Labels cho `update_issue`

**Ngày:** 2026-05-24
**Tool ảnh hưởng:** `update_issue`
**Version target:** v1.3.0 → v1.4.0
**Status:** Approved, ready for `/ck:plan`

---

## 1. Problem Statement

`update_issue` hiện hỗ trợ thay đổi assignee, dueDate, transition, comment, resolution — nhưng **không có cách update labels** sau khi issue đã tạo. User phải vào Jira UI để thêm/xoá label, gãy workflow MCP.

## 2. Requirements

### Functional
- Thêm labels mới vào issue (không ghi đè labels có sẵn)
- Xoá labels cụ thể khỏi issue
- Xoá toàn bộ labels (clear)
- Hỗ trợ combine: vừa clear vừa add (= replace toàn bộ trong 1 call)
- Tích hợp vào tool `update_issue` hiện tại (không tạo tool mới)
- Compatible với các field hiện có (assignee/dueDate/transition/comment)

### Non-functional
- Không thêm API call thừa (no pre-fetch)
- Idempotent (gọi lại không đổi kết quả)
- Error message rõ ràng qua interceptor có sẵn
- Tuân thủ pattern "set vs clear" của `dueDate`

## 3. Evaluated Approaches

### Approach A — Add/Remove incremental ✅ (Chosen)
**Pros:** An toàn cho multi-user; không ghi đè labels của người khác; idempotent; map trực tiếp REST `update` operator.
**Cons:** Schema nhiều field hơn (3 thay vì 1).

### Approach B — Replace toàn bộ (như create_issue)
**Pros:** Đơn giản, 1 field `labels: string[]`.
**Cons:** Vô tình xoá labels người khác đặt; không thấy được delta; không phù hợp collaborative work.

### Approach C — Flexible (cả 2)
**Pros:** Linh hoạt tối đa.
**Cons:** Schema rộng, AI dễ confused chọn mode nào; over-engineering.

## 4. Final Solution

### 4.1 Schema (3 field mới trong `update_issue`)

```typescript
addLabels: z.array(z.string().trim().min(1)).optional()
removeLabels: z.array(z.string().trim().min(1)).optional()
clearLabels: z.boolean().default(false)
```

### 4.2 JiraClient method mới

```typescript
async updateLabels(
  issueKey: string,
  opts: { add?: string[]; remove?: string[]; clear?: boolean }
): Promise<void>
```

- `clear=true` → 1 PUT với `fields.labels = (add ?? [])` — atomic clear+set
- `clear=false` → 1 PUT với `update.labels = [{add}|{remove}...]` — incremental

### 4.3 Handler order (in `update_issue`)

```
A. Assignee   (pass workflow guards)
B. Labels     ← MỚI (trước transition để workflow rule thấy state mới)
C. DueDate
D. Transition (+ comment + resolution)
E. Comment standalone
```

### 4.4 Report output format

| Case | Output |
|------|--------|
| Add only | `🏷️ Labels: ➕ backend, urgent` |
| Remove only | `🏷️ Labels: ➖ draft` |
| Add + Remove | `🏷️ Labels: ➕ backend \| ➖ draft` |
| Clear only | `🏷️ Labels: ❌ Đã xoá toàn bộ` |
| Clear + Add | `🏷️ Labels: ❌ Xoá hết → ✅ Set [v2-only, fresh]` |

## 5. Edge Cases (đã chốt)

| Case | Behavior |
|------|----------|
| `clearLabels + addLabels` | Clear → Set (atomic, 1 API call) |
| `removeLabels` chứa label không có | Jira silent ignore (idempotent) |
| Label rỗng / whitespace | Zod reject (trim + min(1)) |
| Label có space/ký tự đặc biệt | Jira reject → interceptor format error |
| Combine với assignee/transition | Order A→B→C→D→E |
| `dryRun=true` | Vẫn chỉ list transitions, không động labels |
| Cả 3 field không truyền | No-op guard mở rộng |

## 6. Out of Scope (KISS — không làm)

- ❌ Pre-fetch issue để cảnh báo label không tồn tại
- ❌ Fuzzy-match labels theo project
- ❌ Validate format client-side (regex)
- ❌ Tách tool riêng `update_labels`
- ❌ Whitelist labels từ Jira config

## 7. Files to Modify

| File | Change | LOC |
|------|--------|-----|
| `src/jira/client.ts` | Thêm `updateLabels()` | ~25 |
| `src/jira/tools/issue-tools.ts` | Schema 3 field + Step B handler + tool description | ~30 |
| `README.md` | Ví dụ update_issue với labels | ~15 |
| `package.json` | v1.3.0 → v1.4.0 | 1 |
| `docs/codebase-summary.md` | Mention labels capability | ~5 |

## 8. Success Criteria

- [ ] `npm run build` pass không lỗi
- [ ] `npm run inspect` test được tất cả case sau với issue thật:
  - [ ] Add only
  - [ ] Remove only
  - [ ] Add + Remove cùng lúc
  - [ ] Clear only
  - [ ] Clear + Add (= set toàn bộ)
  - [ ] Combine: addLabels + assignee + transitionName + comment
- [ ] Report message hiển thị đúng emoji + delta
- [ ] `dryRun=true` không gọi `updateLabels`
- [ ] Labels không tồn tại trong removeLabels → không lỗi
- [ ] Empty array / undefined → no-op (không gọi API)

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Workflow rule chặn transition vì labels cũ | Order: Labels (B) trước Transition (D) |
| AI confuse `clearLabels` vs `removeLabels` | Description rõ + ví dụ trong README |
| User typo label name → label sai trên Jira | Acceptable — KISS, không validate |
| Concurrent update với người khác | Incremental mode an toàn (chỉ add/remove cái mình quan tâm) |

## 10. Security Considerations

- ✅ Vẫn nằm dưới `withErrorHandler` của shared utils
- ✅ Vẫn yêu cầu PAT permission edit issue (Jira tự enforce)
- ✅ Không log content nhạy cảm
- ✅ Tool description nhắc "yêu cầu xác nhận user trước khi đổi" (như các write op khác)

## 11. Next Steps

1. Chạy `/ck:plan` với report này làm input → tạo phase implementation
2. Implement theo plan (predicted: 1 phase, dưới 100 LOC change)
3. Test với `npm run inspect` + 1 issue test trên Jira nội bộ
4. Bump version + commit + update docs

## 12. Open Questions

Không còn — tất cả decision đã chốt qua AskUserQuestion với user.
