---
phase: 2
title: "Gom create_issue + get_create_meta → create_issue với dryRun"
status: completed
priority: high
effort: S
---

# Phase 2: Thêm `dryRun` vào `create_issue`

## Overview

Gom `get_create_meta` vào `create_issue` bằng cách thêm param `dryRun`.
Khi `dryRun = true` → chỉ trả metadata (custom fields, users, epics), không tạo issue.
Các field còn lại optional khi dryRun.

## Implementation

### File: `src/jira/tools.ts`

**Xóa:** Tool 7 `get_create_meta` (line 384-485)

**Sửa:** Tool 6 `create_issue` — thêm param `dryRun`, các field khác thành optional khi dryRun

```typescript
// Thêm vào schema:
dryRun: z.boolean().default(false)
  .describe("true = chỉ xem metadata (custom fields, users, epics) — không tạo issue"),

// Các field sau chuyển thành optional (chỉ required khi dryRun = false):
summary: z.string().optional(),
description: z.string().optional(),
priority: z.enum([...]).optional(),
labels: z.array(z.string()).optional(),
spda: z.string().optional(),
congDoan: z.string().optional(),
dueDate: z.string().optional(),
```

**Handler logic — thêm early return cho dryRun:**

```typescript
withErrorHandler("create_issue", async (payload) => {
  // Case 1: dryRun — trả metadata
  if (payload.dryRun) {
    // Di chuyển toàn bộ logic từ get_create_meta handler vào đây
    const lines: string[] = [`📋 Create Meta — ${payload.projectKey}`, ""];
    
    // 1. Custom fields (SPDA, Công đoạn, issuetype, priority)
    // ... (giữ nguyên logic cũ của get_create_meta)
    
    // 2. Assignable users
    // ... (giữ nguyên)
    
    // 3. Epics đang mở
    // ... (giữ nguyên)
    
    return { content: [{ type: "text", text: lines.join("\n") + getChainHint("create_issue") }] };
  }

  // Case 2: Tạo issue — validate required fields
  if (!payload.summary || !payload.description || !payload.priority || 
      !payload.labels || !payload.spda || !payload.congDoan || !payload.dueDate) {
    return {
      content: [{
        type: "text",
        text: "❌ Thiếu field bắt buộc. Khi tạo issue cần: summary, description, priority, labels, spda, congDoan, dueDate.\n" +
              "💡 Dùng dryRun=true để xem danh sách giá trị hợp lệ trước.",
      }],
    };
  }

  // ... giữ nguyên logic tạo issue hiện tại
})
```

## Todo

- [x] Xóa tool `get_create_meta`
- [x] Thêm param `dryRun` vào `create_issue` schema
- [x] Chuyển required fields → optional (validate manual trong handler)
- [x] Di chuyển logic get_create_meta vào dryRun branch
- [x] Build pass

## Success Criteria

- `get_create_meta` đã xóa
- `create_issue({ projectKey, dryRun: true })` trả metadata giống get_create_meta cũ
- `create_issue({ ... đầy đủ fields })` tạo issue bình thường
- Thiếu required fields khi không dryRun → trả lỗi rõ ràng
