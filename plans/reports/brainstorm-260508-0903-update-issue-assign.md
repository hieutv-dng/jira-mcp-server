# Brainstorm Summary — Bổ sung assign vào `update_issue`

**Date:** 2026-05-08
**Status:** Approved → ready for `/ck:plan`
**Scope:** Small (~50 lines change, 2 files)

## Problem Statement

Tool `update_issue` hiện hỗ trợ: dryRun (list transitions), thêm comment, transition status (+resolution/comment). **Thiếu khả năng assign/unassign** user — user phải gọi Jira UI thủ công, phá vỡ workflow MCP.

## Requirements

### Functional
- Assign issue cho username cụ thể (fuzzy match)
- Unassign (clear assignee → null)
- Combine tự do với transition + comment trong cùng 1 call
- Tool description có warning xác nhận trước khi assign (nhất quán với transition/log_work/create_issue)

### Non-functional
- Tái dùng `resolveAssignee()` đã có trong client.ts (DRY)
- Không thay đổi hành vi hiện tại của `update_issue` khi không truyền assignee (backward compatible)
- Error message rõ ràng khi username không khớp (fuzzy match đã handle)

## Approaches Evaluated

| Approach | Pros | Cons | Decision |
|---|---|---|---|
| **Extend `update_issue`** (chọn) | DRY, ít tool, combine ops linh hoạt | Handler dài hơn | ✅ |
| Tool mới `assign_issue` | Tách bạch, single-purpose | Tăng số tool, không combine được với transition | ❌ |
| Chỉ trong `update_issue` nhưng không combine | An toàn rõ ràng | Mất linh hoạt, user phải gọi nhiều lần | ❌ |

## Final Solution

### Schema thay đổi (`src/jira/tools.ts`)

Thêm 1 field vào `update_issue` input schema:
```ts
assignee: z.string().optional()
  .describe(
    "Username muốn assign. " +
    "'unassigned' = gỡ assignee (set null). " +
    "Bỏ trống = không đổi assignee. " +
    "VD: 'nghiath', 'hieutv'. Hỗ trợ fuzzy match."
  ),
```

Update tool description:
- Thêm "assign/unassign user" vào danh sách actions
- Thêm warning `⚠️ PHẢI hỏi user xác nhận TRƯỚC KHI assign`

### API method mới (`src/jira/client.ts`)

```ts
async updateAssignee(issueKey: string, username: string | null): Promise<void>
```
- `username === null` → PUT body `{ fields: { assignee: null } }` (clear)
- `username` string → resolve qua `resolveAssignee(projectKey, username)`, projectKey parse từ issueKey (`"PROJAI-123".split("-")[0]`), sau đó PUT body `{ fields: { assignee: { name: resolvedName } } }`
- Endpoint: `PUT /issue/{key}` (đồng nhất, dễ extend update field khác sau này)

### Logic flow trong handler

```
1. dryRun=true     → list transitions (giữ nguyên)
2. Validate empty  → if (!transitionName && !comment && !assignee) → warning
3. assignee?       → updateAssignee() trước (assign trước transition để pass workflow guards)
4. transitionName? → transitionIssue() (kèm comment + resolution nếu có)
5. comment alone?  → addComment() (chỉ khi không có transition để tránh duplicate)
```

### Output combined

```
✅ Đã cập nhật thành công!
📌 Issue: PROJAI-123
👤 Assignee: nghiath (Nguyễn Anh Hậu)
🔄 Trạng thái mới: In Progress
💬 Comment: "Bắt đầu làm"
```

Khi unassign:
```
👤 Assignee: ❌ Đã gỡ assignee
```

## Files Modified

- `src/jira/client.ts` — thêm `updateAssignee()` method (~25 lines)
- `src/jira/tools.ts` — extend `update_issue` schema + handler (~20 lines)

## Files NOT Modified

- `src/jira/formatter.ts` — output build inline trong handler
- `src/shared/utils.ts` — TOOL_CHAINING không cần đổi (assign không tạo chain mới)

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Non-atomic: assign OK nhưng transition fail → partial state | Document trong tool description. User retry phần fail |
| issueKey malformed (no `-`) | resolveAssignee throw error rõ ràng từ Jira API |
| Reserved keyword `"unassigned"` collide với username thật | Cực hiếm. Document trong description |
| Workflow guard reject assignee change | Jira API trả error → withErrorHandler format rõ |

## Out of Scope (YAGNI)

- ❌ Bulk assign nhiều issues
- ❌ Assign theo email/displayName ngoài fuzzy match
- ❌ List assignable users trong dryRun của `update_issue` (đã có ở `create_issue dryRun`)
- ❌ History/audit khi đổi assignee (Jira tự log)
- ❌ Shortcut `me`/`currentUser()` (chưa cần, có thể bổ sung sau)

## Success Criteria

- `npm run build` pass không lỗi
- MCP Inspector test: 4 cases — assign new user, unassign, combine assign+transition, combine assign+transition+comment
- Backward compat: existing test cases (dryRun, comment-only, transition-only) vẫn hoạt động
- Error case: username không khớp → trả top-3 suggestions từ `resolveAssignee`

## Next Steps

1. Run `/ck:plan` để tạo phase-by-phase implementation plan trong `plans/260508-0903-update-issue-assign/`
2. Implement theo plan
3. Test qua MCP Inspector
4. Update `docs/codebase-summary.md` nếu cần
5. Journal entry sau khi merge

## Unresolved Questions

Không có — design đã được duyệt, scope rõ ràng.
