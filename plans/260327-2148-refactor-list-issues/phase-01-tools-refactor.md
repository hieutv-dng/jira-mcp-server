# Phase 01 — Sửa `src/jira/tools.ts`

## Context

- File: `src/jira/tools.ts` line 18–92
- Tool hiện tại: `list_my_open_issues` (hardcode `assignee = currentUser()`)
- Mục tiêu: rename + thêm `assigneeFilter`, `roleFilter`, fix `customJql`

## Requirements

### Params mới (schema Zod)

```ts
assigneeFilter: z.string()
  .default("currentUser()")
  .describe(
    "User để filter. " +
    "'currentUser()' = tôi (default). " +
    "'unassigned' = chưa assign. " +
    "'any' = bỏ qua filter user. " +
    "Username cụ thể: 'nghiath', 'admin', v.v."
  )

roleFilter: z.enum(["assignee", "reporter", "watcher"])
  .default("assignee")
  .describe(
    "Role của user với issue. " +
    "'assignee' = được assign (default). " +
    "'reporter' = người tạo issue. " +
    "'watcher' = người đang theo dõi."
  )
```

> **Giữ nguyên:** `projectKey`, `statusFilter`, `customJql`, `maxResults`

### Logic build JQL

```ts
// 1. Project clause
const projectFilter = projectKey ? `project = ${projectKey} AND ` : "";

// 2. User/role clause (chỉ khi KHÔNG có customJql)
function buildUserClause(role: string, assigneeFilter: string): string {
  if (assigneeFilter === "any") return "";  // không filter user

  let userValue: string;
  if (assigneeFilter === "currentUser()") {
    userValue = "currentUser()";
  } else if (assigneeFilter === "unassigned") {
    // "unassigned" chỉ áp dụng cho assignee
    return role === "assignee" ? "assignee is EMPTY AND " : "";
  } else {
    userValue = `"${assigneeFilter}"`;
  }

  // watcher dùng syntax khác trong Jira JQL
  const jqlField = role === "watcher" ? "watcher" : role;
  return `${jqlField} = ${userValue} AND `;
}

// 3. Status clause
const statusMap = { open: ..., active: ..., done: ..., all: ... };

// 4. Build final JQL
let jql: string;
if (customJql) {
  // Full override — không inject gì thêm
  jql = `${projectFilter}${customJql} ORDER BY updated DESC`;
} else {
  const userClause = buildUserClause(roleFilter, assigneeFilter);
  jql = `${projectFilter}${userClause}${statusMap[statusFilter]} ORDER BY priority DESC, updated DESC`;
}
```

### Label cho output

```ts
// Hiển thị filter đang dùng
const roleLabel = roleFilter === "assignee" ? "Assignee"
  : roleFilter === "reporter" ? "Reporter" : "Watcher";
const userLabel = assigneeFilter === "currentUser()" ? "Tôi"
  : assigneeFilter === "unassigned" ? "Chưa assign"
  : assigneeFilter === "any" ? "Tất cả"
  : assigneeFilter;
const filterLabel = customJql
  ? `Custom JQL: ${customJql}`
  : `${roleLabel}: ${userLabel} | Status: ${filterLabel[statusFilter]}`;
```

## Implementation Steps

1. Rename tool name: `"list_my_open_issues"` → `"list_issues"`
2. Update description tool (phản ánh params mới)
3. Thêm `assigneeFilter` và `roleFilter` vào schema Zod
4. Extract helper `buildUserClause()` (đặt bên ngoài `registerJiraTools`, trước `buildQuickDriftWarning`)
5. Sửa logic JQL trong handler:
   - `customJql` → full override (bỏ `assignee = currentUser()`)
   - else → dùng `buildUserClause()`
6. Update output label để phản ánh filter đang dùng
7. Update `getChainHint("list_my_open_issues")` → `getChainHint("list_issues")` (3 chỗ trong tool handler)

## Todo

- [ ] Rename tool name
- [ ] Update description
- [ ] Thêm `assigneeFilter` param
- [ ] Thêm `roleFilter` param
- [ ] Extract `buildUserClause()` helper
- [ ] Fix `customJql` logic (bỏ inject `currentUser()`)
- [ ] Sửa else branch dùng `buildUserClause()`
- [ ] Update output label
- [ ] Update 3x `getChainHint("list_my_open_issues")` → `getChainHint("list_issues")`

## Risk

| Risk | Mitigation |
|------|-----------|
| `watcher` JQL syntax Jira cũ khác | Test với JQL manual trước |
| `assignee is EMPTY` không hoạt động với `reporter`/`watcher` | Guard trong `buildUserClause` |
| Rename tool làm break AI prompt cũ | Backward note trong description |
