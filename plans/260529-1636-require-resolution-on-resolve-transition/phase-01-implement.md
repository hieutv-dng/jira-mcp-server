---
phase: 1
title: "Implement"
status: pending
priority: P2
effort: "20m"
dependencies: []
---

# Phase 1: Implement

## Overview

Thêm hard-validation fail-fast vào tool `update_issue`: transition chứa `"resolve"` mà thiếu `resolution` → throw, không mutate gì.

## Requirements
- Functional: chặn call khi `transitionName` chứa `"resolve"` (case-insensitive) và `resolution` rỗng/undefined.
- Non-functional: fail-fast TRƯỚC mọi mutation (assignee/labels/dueDate/transition) để tránh side-effect nửa vời. KISS — chỉ check substring, không gọi API thêm.

## Architecture

Flow hiện tại trong handler `update_issue`: dryRun → no-op check → labelConflict check → Step A assignee → B labels → C dueDate → D transition. Validation mới chèn **ngay sau labelConflict check, trước Step A**, nên throw xảy ra trước khi bất kỳ API mutation nào chạy.

`client.ts::transitionIssue()` đã nhận `resolution` optional — không cần sửa.

## Related Code Files
- Modify: `src/jira/tools/issue-tools.ts`
  - Helper `isResolveTransition` (cạnh `findLabelConflict`, ~line 38)
  - Validation block (sau `labelConflict`, ~line 269)
  - Cập nhật `.describe()` của zod param `resolution` (~line 223-224)
- Không sửa: `src/jira/client.ts`

## Implementation Steps

1. Thêm helper cạnh `findLabelConflict` (~line 38):
   ```ts
   // Transition "resolve" bắt buộc có resolution, nếu không issue sẽ treo "Unresolved".
   function isResolveTransition(name: string): boolean {
     return name.toLowerCase().includes("resolve");
   }
   ```

2. Chèn validation fail-fast SAU khối `labelConflict` (~line 269), TRƯỚC Step A:
   ```ts
   if (transitionName && isResolveTransition(transitionName) && !resolution) {
     throw new Error(
       `Transition "${transitionName}" bắt buộc phải có resolution ` +
       `(nếu không issue sẽ treo "Unresolved"). ` +
       `Truyền thêm resolution, VD: resolution: "Done" (hoặc "Fixed", "Won't Do" tùy workflow).`
     );
   }
   ```

3. Cập nhật mô tả param `resolution` (~line 223-224):
   ```ts
   resolution: z.string().optional()
     .describe("Resolution khi đóng task. VD: 'Done', 'Fixed'. BẮT BUỘC khi transitionName chứa 'resolve' (thiếu sẽ báo lỗi)."),
   ```

## Success Criteria

- [ ] Helper `isResolveTransition` thêm vào, comment giải thích "why" (không tham chiếu plan/phase).
- [ ] Validation đặt trước Step A (assignee), throw trước mọi mutation.
- [ ] Mô tả zod `resolution` cập nhật nêu rõ bắt buộc.
- [ ] `npm run build` pass (no TS error).

## Risk Assessment

- **Sai-dương với tên transition lạ chứa "resolve"** nhưng không phải đóng task: hiếm; chấp nhận được vì user đã chọn pattern này. Mitigation: comment rõ trong code.
- **Khắc phục sau khó** nếu issue đã resolve thiếu resolution từ trước: ngoài scope (validation chỉ chặn call mới).
