# Brainstorm — Bổ sung chức năng xoá worklog

**Date:** 2026-05-15
**Status:** APPROVED (chờ /ck:plan)
**Topic:** Thêm `delete_worklog` tool + mở rộng `list_worklogs` để show worklog ID + refactor `tools.ts`

---

## 1. Problem statement

Hiện tại MCP server hỗ trợ `log_work` (tạo) và `list_worklogs` (truy vấn aggregate) nhưng KHÔNG có cách xoá worklog đã log nhầm. User phải vào Jira UI thủ công.

Gap phụ: `list_worklogs` không expose `worklogId` → nếu thêm `delete_worklog` thì user không có cách lấy ID dễ dàng từ chính MCP server.

Gap kỹ thuật: `src/jira/tools.ts` ~400 dòng, sau khi thêm sẽ ~470 — vượt ngưỡng 200 dòng theo development-rules.

## 2. Requirements

### Functional
- Xoá 1 hoặc nhiều worklog entries trên 1 issue theo worklogId.
- Hỗ trợ `dryRun` preview trước khi xoá thật.
- Best-effort: 1 entry fail không stop batch.
- `list_worklogs` có mode chi tiết show từng entry với worklogId.

### Non-functional
- Tuân thủ pattern hiện tại (client.ts → tools.ts → formatter.ts).
- Safety annotation: yêu cầu user xác nhận (như log_work).
- File ≤ 200 dòng (development-rules) → tách `tools.ts`.

### Constraints
- Jira Server/DC v7+ REST API (không Cloud).
- TypeScript ES2022, NodeNext, strict mode.
- Zod validation cho mọi input.
- Không phá backward compat với 7 tools hiện có.

## 3. Approaches evaluated

### A. Tool độc lập + mở rộng list_worklogs (CHOSEN)
- `delete_worklog` riêng biệt.
- `list_worklogs` thêm flag `detail`.
- Tách `tools.ts` thành 3 file theo concern.

**Pros:** SRP, khớp pattern, safety rõ ràng, AI agent dễ chọn, scalable.
**Cons:** Tăng 1 tool (7→8), thêm work refactor.

### B. Gom log_work + delete_worklog → manage_worklog (REJECTED)
**Pros:** Giảm tool count.
**Cons:** Discriminated union phức tạp, description phình to, safety annotation loãng, phá pattern codebase, không scale tốt khi thêm update_worklog.

### C. Không tách tools.ts, chỉ thêm tool (REJECTED)
**Pros:** Scope nhỏ nhất.
**Cons:** Vi phạm ngưỡng 200 dòng/file, tech debt tích luỹ.

## 4. Final solution

### 4.1 Refactor `src/jira/tools.ts` → directory

```
src/jira/tools/
├── index.ts             # registerJiraTools() barrel, ~30 dòng
├── user-tools.ts        # get_current_user, ~30 dòng
├── issue-tools.ts       # list_issues, get_issue_detail, update_issue, create_issue, ~250 dòng
└── worklog-tools.ts     # log_work, list_worklogs, delete_worklog, ~180 dòng
```

`src/index.ts` import `registerJiraTools` từ `./jira/tools/index.js` (path không đổi nếu rename tools.ts → tools/index.ts).

**Lưu ý:** `issue-tools.ts` vẫn ~250 dòng vì update_issue + create_issue khá lớn. Chấp nhận vì gộp logic issue lại với nhau hợp lý hơn split thêm.

### 4.2 Mở rộng `list_worklogs`

Thêm param:
```ts
detail: z.boolean().optional()
  .describe("true = show từng worklog entry với ID (để delete_worklog dùng). false/bỏ trống = summary theo issue.")
```

Khi `detail=true`: dùng `formatWorklogDetail(entries, meta)` thay vì `formatWorklogSummary`. Output có table:
```
| WorklogID | Issue | Date | Hours | Comment |
```

Không thêm API call — đã có `getIssueWorklogs` rồi.

### 4.3 Tool mới `delete_worklog`

**Input schema:**
```ts
{
  issueKey: z.string().describe("Jira issue key, VD: 'VNPTAI-123'"),
  worklogIds: z.array(z.string()).min(1).describe("Array worklog ID cần xoá (lấy từ list_worklogs detail=true)"),
  dryRun: z.boolean().optional().describe("true = preview, không xoá thật. KHUYẾN CÁO chạy dryRun trước.")
}
```

**Description (tool annotation):**
> "Xoá 1 hoặc nhiều worklog trên 1 issue. ⚠️ DESTRUCTIVE. PHẢI chạy dryRun=true trước, show preview cho user, đợi xác nhận rồi mới chạy dryRun=false. adjustEstimate=auto (Jira tự cộng giờ vào remaining estimate)."

**Handler logic:**
1. Nếu `dryRun=true`:
   - Gọi `getIssueWorklogs(issueKey)`, filter các entry có ID nằm trong `worklogIds`.
   - Trả về preview: số entry, tổng giờ, từng entry chi tiết, warning về adjustEstimate.
2. Nếu `dryRun=false`:
   - Loop từng `worklogId`, gọi `DELETE /issue/{key}/worklog/{id}?adjustEstimate=auto`.
   - Collect `{ id, status: "success" | error_message }`.
   - Trả về summary: ✅ X thành công (tổng Yh), ❌ Z lỗi (với từng lý do).

### 4.4 Client method

```ts
async deleteWorklog(issueKey: string, worklogId: string): Promise<void> {
  await this.http.delete(`/issue/${issueKey}/worklog/${worklogId}`, {
    params: { adjustEstimate: "auto" }
  });
}
```

### 4.5 Tool chaining update

```ts
list_worklogs: "→ Tiếp: `list_worklogs` với detail=true để xem worklog ID, " +
               "hoặc `get_issue_detail` xem chi tiết, hoặc `delete_worklog` nếu cần xoá nhầm.",
delete_worklog: "→ Tiếp: `list_worklogs` để verify đã xoá, hoặc `log_work` log lại đúng."
```

### 4.6 Files cần touch

| File | Action | Dòng ước tính |
|------|--------|--------------|
| `src/jira/client.ts` | Thêm `deleteWorklog()` | +10 |
| `src/jira/tools.ts` | **DELETE** (thay bằng directory) | -400 |
| `src/jira/tools/index.ts` | NEW — barrel + registerJiraTools | ~30 |
| `src/jira/tools/user-tools.ts` | NEW — get_current_user | ~30 |
| `src/jira/tools/issue-tools.ts` | NEW — 4 issue tools | ~250 |
| `src/jira/tools/worklog-tools.ts` | NEW — 3 worklog tools (gồm delete_worklog mới + list_worklogs detail) | ~180 |
| `src/jira/formatter.ts` | Thêm `formatWorklogDetail()`, có thể tách `WorklogEntry` interface | +40 |
| `src/shared/utils.ts` | Thêm `delete_worklog` vào TOOL_CHAINING, update `list_worklogs` hint | +3 |
| `src/index.ts` | Verify import path vẫn ổn (nên không đổi) | 0 |
| `README.md` | Bump tool count 7→8, thêm ví dụ delete_worklog, list_worklogs detail | +20 |
| `docs/codebase-summary.md` | Update tools list + directory structure | +15 |
| `docs/system-architecture.md` | Update sơ đồ tools nếu có | +5 |

## 5. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Refactor `tools.ts` gây regression | Medium | High | Build + `npm run inspect` test từng tool cũ sau split |
| User xoá nhầm worklog của người khác (403) | High | Low | Best-effort + error message rõ ràng kèm author info |
| AI agent skip dryRun → xoá thẳng | Medium | High | Description bắt buộc dryRun, MCP annotation `destructiveHint: true` |
| adjustEstimate=auto bất ngờ tăng remaining estimate | Low | Low | DryRun hiển thị warning về behavior |
| WorklogId không tồn tại (đã xoá / sai ID) | Medium | Low | Best-effort skip + report 404 |
| Import path đổi sau refactor → break index.ts | Low | High | Rename `tools.ts` → `tools/index.ts` để giữ path |

## 6. Acceptance criteria

### Refactor
- [ ] `tools.ts` không còn tồn tại; `tools/` directory hoạt động.
- [ ] `npm run build` pass, không có TS error.
- [ ] `npm run inspect` load đủ 8 tools.
- [ ] 7 tool cũ hoạt động đúng như trước (smoke test get_current_user, list_issues, get_issue_detail, log_work, list_worklogs, update_issue, create_issue).

### Feature
- [ ] `list_worklogs(detail=true)` show table có column WorklogID.
- [ ] `delete_worklog(dryRun=true)` show preview không gọi DELETE API.
- [ ] `delete_worklog(dryRun=false, worklogIds=[id])` xoá thành công 1 entry, verify trong Jira.
- [ ] `delete_worklog` với 3 IDs trong đó 1 sai → 2 success + 1 error 404 trong report.
- [ ] `delete_worklog` worklog của user khác → 403, message rõ.
- [ ] README + docs cập nhật tool count 7→8, có ví dụ.

## 7. Out of scope

- Update worklog (sửa timeSpent/comment) — brainstorm riêng nếu cần.
- Filter-based delete (date range, user) — rejected do rủi ro xoá nhầm.
- Cross-issue batch delete — rejected do API Jira yêu cầu issueKey trong URL.
- Test framework formal (codebase chưa có) — manual test qua `npm run inspect`.

## 8. Next steps

1. Handoff sang `/ck:plan` để tạo phase-by-phase plan.
2. Cân nhắc mode `/ck:plan --tdd` không? **Recommend default `/ck:plan`** vì codebase chưa có test framework, TDD sẽ tạo overhead không tương xứng. Manual test qua `npm run inspect` đủ.
3. Sau plan: implement → smoke test → review → ship.

## 9. Unresolved questions

Không còn. Tất cả 5 hard-gate items đã rõ:
- **Expected output:** 1 tool mới `delete_worklog`, 1 param `detail` mới cho `list_worklogs`, `tools.ts` được tách thành directory.
- **Acceptance:** xem section 6.
- **Scope boundary:** xem section 7.
- **Constraints:** xem section 2 (Non-functional + Constraints).
- **Touchpoints:** xem section 4.6.
