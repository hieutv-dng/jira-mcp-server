---
phase: 1
title: "Implement"
status: completed
priority: P2
effort: "1h"
dependencies: []
---

# Phase 1: Implement

## Overview

Thêm method `updateAssignee()` vào `JiraClient` và extend `update_issue` tool để hỗ trợ assign/unassign. Combine tự do với transition + comment.

## Requirements

### Functional
- `assignee` string không rỗng → resolve qua `resolveAssignee()` rồi PUT assignee
- `assignee="unassigned"` → set null (clear assignee)
- `assignee` undefined → không thay đổi assignee (backward compat)
- Combine với transition/comment trong cùng 1 call

### Non-functional
- DRY: tái dùng `resolveAssignee()` đã có
- KISS: không thêm helper class/module mới
- Error message rõ ràng (đã handled qua `resolveAssignee` + axios interceptor)

## Architecture

**Flow trong handler `update_issue`:**

```
1. dryRun=true     → list transitions (giữ nguyên)
2. !transition && !comment && !assignee → warning message
3. assignee?       → updateAssignee() trước
4. transitionName? → transitionIssue() (kèm comment + resolution nếu có)
5. !transition && comment? → addComment() standalone
6. Combine all results vào output report
```

**Lý do order assignee trước transition:** một số workflow yêu cầu có assignee trước khi transition sang Done/In Progress. Assign trước → transition sau dễ pass.

## Related Code Files

- Modify: `src/jira/client.ts` — thêm `updateAssignee()` method
- Modify: `src/jira/tools.ts` — extend schema + handler + description

## Implementation Steps

### Step 1 — `src/jira/client.ts`: thêm method `updateAssignee()`

Vị trí: trong class `JiraClient`, đặt sau `transitionIssue()` (~line 287), trước section `// ─── COMMENTS ───`.

```ts
/**
 * Cập nhật assignee của issue.
 * @param issueKey - VD: "PROJAI-123"
 * @param username - Username để assign. null = unassign (clear).
 *                   String hỗ trợ fuzzy match qua resolveAssignee().
 */
async updateAssignee(issueKey: string, username: string | null): Promise<void> {
  let assigneeField: { name: string } | null = null;

  if (username !== null) {
    // Parse projectKey từ issueKey để gọi resolveAssignee
    const projectKey = issueKey.split("-")[0];
    if (!projectKey) {
      throw new Error(
        `Issue key không hợp lệ: "${issueKey}". Định dạng đúng: PROJECT-NUMBER (VD: PROJAI-123)`
      );
    }
    const resolvedName = await this.resolveAssignee(projectKey, username);
    assigneeField = { name: resolvedName };
  }

  await this.http.put(`/issue/${issueKey}`, {
    fields: { assignee: assigneeField },
  });
}
```

**Note:** `resolveAssignee()` đã `private` — gọi nội bộ trong cùng class OK, không cần đổi visibility.

### Step 2 — `src/jira/tools.ts`: update tool description

Vị trí: trong `server.tool("update_issue", ...)`, line ~316-321.

Đổi description thành:
```ts
"Cập nhật Jira issue: assign/unassign user, chuyển trạng thái, thêm comment, " +
"hoặc xem transitions khả dụng. " +
"Dùng dryRun=true để xem danh sách transitions mà không thay đổi gì. " +
"Truyền assignee để gán/gỡ người làm. " +
"Truyền chỉ comment (không transitionName) để thêm ghi chú mà không đổi status. " +
"Truyền transitionName để chuyển trạng thái (kèm comment, resolution nếu cần). " +
"Có thể combine assignee + transitionName + comment trong cùng 1 call. " +
"⚠️ PHẢI hỏi user xác nhận TRƯỚC KHI thay đổi assignee, status hoặc thêm comment.",
```

### Step 3 — `src/jira/tools.ts`: thêm field `assignee` vào schema

Trong input schema object (sau field `comment`):
```ts
assignee: z.string().optional()
  .describe(
    "Username muốn assign. " +
    "'unassigned' = gỡ assignee (set null). " +
    "Bỏ trống = không đổi assignee. " +
    "VD: 'nghiath', 'hieutv'. Hỗ trợ fuzzy match."
  ),
```

### Step 4 — `src/jira/tools.ts`: update handler logic

Trong `withErrorHandler("update_issue", async ({ ... }) => { ... })`:

1. Thêm `assignee` vào destructure params:
   ```ts
   async ({ issueKey, dryRun, transitionName, comment, resolution, assignee }) => {
   ```

2. Cập nhật Case 3 "không có gì để làm":
   ```ts
   if (!transitionName && !comment && !assignee) {
     return {
       content: [{
         type: "text",
         text: `⚠️ Không có thay đổi — truyền assignee để gán/gỡ user, transitionName để đổi status, comment để thêm ghi chú, hoặc dryRun=true để xem transitions.`,
       }],
     };
   }
   ```

3. Refactor Case 2/4 thành combine flow (sau dryRun check):
   ```ts
   const reportLines: string[] = [`✅ Đã cập nhật thành công!`, `📌 Issue: ${issueKey}`];

   // Step A: Assignee (nếu có)
   if (assignee) {
     if (assignee.toLowerCase() === "unassigned") {
       await jira.updateAssignee(issueKey, null);
       reportLines.push(`👤 Assignee: ❌ Đã gỡ assignee`);
     } else {
       await jira.updateAssignee(issueKey, assignee);
       reportLines.push(`👤 Assignee: ${assignee} (đã gán)`);
     }
   }

   // Step B: Transition (kèm comment + resolution)
   if (transitionName) {
     await jira.transitionIssue(issueKey, transitionName, { resolution, comment });
     reportLines.push(`🔄 Trạng thái mới: ${transitionName}`);
     if (resolution) reportLines.push(`✔️ Resolution: ${resolution}`);
     if (comment) reportLines.push(`💬 Comment: "${comment}"`);
   } else if (comment) {
     // Step C: Comment standalone (không transition)
     await jira.addComment(issueKey, comment);
     reportLines.push(`💬 Comment: "${comment}"`);
   }

   return {
     content: [{ type: "text", text: reportLines.join("\n") + getChainHint("update_issue") }],
   };
   ```

4. Xóa Case 2 (chỉ comment) và Case 4 (transition) cũ vì đã merge vào combine flow.

### Step 5 — Build check

```bash
npm run build
```

Expect: 0 errors, dist/ updated.

## Success Criteria

- [x] `updateAssignee()` method tồn tại trong `JiraClient`
- [x] Schema `update_issue` có field `assignee` optional
- [x] Tool description nhắc đến "assign/unassign" + warning xác nhận
- [x] Handler: assignee → transition → comment order
- [x] Combine output report chứa đủ các phần đã thực hiện
- [x] `npm run build` pass không error
- [x] Backward compat: gọi update_issue không truyền assignee → không touch assignee field

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Non-atomic: assign OK nhưng transition fail | Document trong tool description; user retry phần fail |
| issueKey malformed (no "-") | Throw rõ ràng trong `updateAssignee` trước khi gọi API |
| Reserved keyword `"unassigned"` collide username | Cực hiếm; document trong field description |
| Workflow guard reject assignee change | Jira API trả error → withErrorHandler format clean |
| Phá vỡ logic hiện tại khi refactor handler | Test backward cases trong Phase 2 |
