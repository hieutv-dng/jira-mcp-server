# Phase 03 — Build & Verify

## Steps

1. **Build TypeScript**
   ```bash
   cd mcp_jira_tools && npm run build
   ```
   → Không được có lỗi compile

2. **Kiểm tra grep references cũ**
   ```bash
   grep -r "list_my_open_issues" src/
   ```
   → Phải trả về empty (không còn reference nào)

3. **Kiểm tra tool mới có đúng tên**
   ```bash
   grep -r "list_issues" src/
   ```

4. **Restart MCP server** (nếu đang chạy) để load tool mới

## Success Criteria

- [ ] `npm run build` pass, không có TypeScript error
- [ ] Không còn string `list_my_open_issues` trong `src/`
- [ ] Tool `list_issues` có đủ 6 params: `projectKey`, `assigneeFilter`, `roleFilter`, `statusFilter`, `customJql`, `maxResults`
- [ ] `customJql` khi dùng không bị inject thêm `assignee = currentUser()`
