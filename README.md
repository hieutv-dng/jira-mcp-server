# jira-mcp-server

MCP (Model Context Protocol) server tích hợp Jira cho Claude AI. Hỗ trợ Claude Desktop, Claude Code và Claude.ai tương tác trực tiếp với Jira Server/Data Center.

**Phiên bản:** v1.0.0
**Trạng thái:** Production-ready
**Mục tiêu:** Jira Server/Data Center (không hỗ trợ Jira Cloud)
**Xác thực:** Personal Access Token (PAT) Bearer authentication

## Tính năng

- **6 Tools:** Xem danh sách issues, xem chi tiết, log work, cập nhật issues (transition + comment), tạo issues, quản lý PAT
- **Mô tả tiếng Việt:** Tối ưu cho team dev Việt Nam
- **Drift Detection:** Cảnh báo khi description có thể đã lỗi thời so với comments
- **Tool Chaining:** Gợi ý hành động tiếp theo sau mỗi tool
- **Safety-First:** Write operations (log work, update, create) yêu cầu xác nhận từ user
- **Markdown Output:** Format AI-friendly với priority emojis, quality analysis

## Bắt đầu nhanh

### Yêu cầu

- Node.js 18+ (ES2022 support)
- Jira Server/Data Center v7+ (không phải Cloud)
- Personal Access Token (PAT) từ Jira

### 1. Tạo Jira PAT

Trong Jira Server/Data Center:
1. Vào Settings → Personal Access Tokens
2. Nhấn "Create token"
3. Đặt tên: `claude-mcp-tools`
4. Copy token (sẽ dùng ở bước sau)

### 2. Clone & Cài đặt

```bash
git clone <repo-url>
cd jira-mcp-server
npm install
```

### 3. Cấu hình môi trường

Tạo file `.env.local`:

```bash
JIRA_BASE_URL=https://jira.company.com
JIRA_PAT=<your-pat-token>
JIRA_DEFAULT_PROJECT=XYZ  # Tùy chọn
```

Hoặc copy từ `.env.example`:

```bash
cp .env.example .env.local
# Sửa .env.local với giá trị của bạn
```

### 4. Build & Chạy

```bash
npm run build       # Compile TypeScript
npm start          # Chạy server (stdio transport)
```

Server sẽ lắng nghe trên stdin/stdout (MCP protocol).

### 5. Kết nối Claude Desktop

Sửa config Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["/path/to/jira-mcp-server/dist/index.js"],
      "env": {
        "JIRA_BASE_URL": "https://jira.company.com",
        "JIRA_PAT": "your-pat-token"
      }
    }
  }
}
```

Khởi động lại Claude Desktop. Tools sẵn sàng sử dụng.

### 6. Test trong Claude

Trong Claude Desktop, thử:

```
Show me open issues
```

Claude sẽ gọi `list_issues` tool. Bạn sẽ thấy danh sách issues được format.

## Tham chiếu Tools

### 1. list_issues

**Mô tả:** Lấy danh sách Jira issues theo filter linh hoạt. Mặc định: issues được assign cho tôi, đang mở.

**Input:**
- `projectKey` (tùy chọn, string): Filter theo project key cụ thể. Default: tất cả projects
- `assigneeFilter` (tùy chọn, string): User để filter. Default: `currentUser()` (tôi). Khác: `unassigned`, `any`, username cụ thể
- `roleFilter` (tùy chọn, string): Role của user. Default: `assignee`. Khác: `reporter`, `watcher`
- `statusFilter` (tùy chọn, string): Nhóm trạng thái. Default: `open`. Khác: `active`, `done`, `all`
- `customJql` (tùy chọn, string): JQL tùy chỉnh — full override. VD: `project = PROJ_XXX AND sprint in openSprints()`
- `maxResults` (tùy chọn, number): Số lượng tối đa. Default: 20, Max: 50

**Output:** Markdown table với priority, key, summary, status

**Ví dụ:**

```
User: "Show me open issues"
Claude gọi: list_issues({ assigneeFilter: "currentUser()", statusFilter: "open", maxResults: 20 })

Response:
| Priority | Key | Summary | Status |
|---|---|---|---|
| 🔴 High | XYZ-123 | Fix login bug | In Progress |
| 🟡 Medium | XYZ-124 | Add dark mode | To Do |
```

**Gợi ý tiếp theo:** `get_issue_detail`

---

### 2. get_issue_detail

**Mô tả:** Xem chi tiết issue (description, comments, fields)

**Input:**
- `key` (bắt buộc, string): Issue key (ví dụ: "XYZ-123")

**Output:** Markdown chi tiết với description, quality analysis, recent comments, drift warning (nếu có)

**Drift Detection:**
- Issue > 30 ngày + nhiều comments → "⚠️ DRIFT DETECTED"
- Cảnh báo nếu description có thể đã lỗi thời
- Tính điểm heuristic (không 100% chính xác)

**Ví dụ:**

```
User: "Show details of XYZ-123"
Claude gọi: get_issue_detail({ key: "XYZ-123" })

Response:
## XYZ-123: Fix login bug
**Status:** In Progress | **Priority:** 🔴 High | **Points:** 5

### Description
User cannot login with SSO...

### Quality Analysis
✅ Description has Given-When-Then sections
⚠️ 15 comments since last update (possible drift)

### Recent Comments
- User1 (27/03): Tested on Chrome, works fine
- User2 (25/03): Need LDAP support

### Next Steps
- Log work (record hours)
- Add comment or transition to Code Review
```

**Gợi ý tiếp theo:** `log_work` hoặc `update_issue`

---

### 3. log_work

**Mô tả:** Ghi nhận giờ làm việc (logwork tại thời điểm hiện tại)

**Input:**
- `issueKey` (bắt buộc, string): Issue key (ví dụ: "PROJ-123")
- `timeSpent` (bắt buộc, string): Thời gian theo format Jira: '2h', '30m', '1h 30m', '1d'. 1d = 8h.
- `comment` (bắt buộc, string): Mô tả ngắn gọn đã làm gì

**Safety:** Yêu cầu xác nhận từ user trước khi thực thi

**Output:** Thông báo xác nhận với worklog ID

**Ví dụ:**

```
User: "Log 4 tiếng cho XYZ-123, đã fix bug login"
Claude gọi: log_work({ issueKey: "XYZ-123", timeSpent: "4h", comment: "Fix bug login" })

[MCP yêu cầu xác nhận]
User xác nhận

Response: "✅ Đã logwork thành công!
📌 Issue: XYZ-123
⏱️  Thời gian: 4h
📝 Ghi chú: Fix bug login
🆔 Worklog ID: 123456"
```

**Gợi ý tiếp theo:** `log_work` hoặc `update_issue`

---

### 4. update_issue

**Mô tả:** Cập nhật Jira issue: chuyển trạng thái, thêm comment, hoặc xem transitions khả dụng.

**Input:**
- `issueKey` (bắt buộc, string): Issue key (ví dụ: "PROJ_XXX-123")
- `dryRun` (tùy chọn, boolean): true = chỉ xem transitions khả dụng, không thay đổi gì. Default: false
- `transitionName` (tùy chọn, string): Tên trạng thái muốn chuyển (ví dụ: "In Progress", "Done"). Bỏ trống nếu chỉ muốn comment
- `resolution` (tùy chọn, string): Resolution khi đóng task (ví dụ: "Done", "Fixed"). Chỉ cần khi chuyển sang Done/Resolved
- `comment` (tùy chọn, string): Ghi chú kèm theo. Có thể dùng độc lập hoặc kèm transition

**Safety:** Yêu cầu xác nhận từ user trước khi thực thi

**Output:**
- dryRun mode: Danh sách transitions khả dụng
- Comment-only: Xác nhận với comment preview
- Transition mode: Xác nhận thay đổi status với optional resolution

**Các trường hợp sử dụng:**

1. **Xem transitions khả dụng (không thay đổi):**
```
User: "What statuses can I move XYZ-123 to?"
Claude gọi: update_issue({ issueKey: "XYZ-123", dryRun: true })

Response:
Các transition khả dụng cho XYZ-123:
  • Code Review (id: 31)
  • Done (id: 21)
  • Back to To Do (id: 11)
```

2. **Chỉ thêm comment:**
```
User: "Add a comment to XYZ-123: Fixed in commit abc1234"
Claude gọi: update_issue({ issueKey: "XYZ-123", comment: "Fixed in commit abc1234" })

[MCP yêu cầu xác nhận]
User xác nhận

Response: "✅ Đã thêm comment vào XYZ-123:\n\n> Fixed in commit abc1234"
```

3. **Transition với comment và resolution:**
```
User: "Move XYZ-123 to Done"
Claude gọi: update_issue({ 
  issueKey: "XYZ-123", 
  transitionName: "Done", 
  resolution: "Fixed",
  comment: "Implementation complete, ready for testing"
})

[MCP yêu cầu xác nhận]
User xác nhận

Response: "✅ Đã cập nhật thành công!\n📌 Issue: XYZ-123\n🔄 Trạng thái mới: Done\n✔️ Resolution: Fixed"
```

**Gợi ý tiếp theo:** `log_work` hoặc `create_issue`

---

### 5. create_issue

**Mô tả:** Tạo một Jira issue mới (Task, Sub-task, Bug, Story). Dùng dryRun=true để xem metadata (custom fields, users, epics) — không tạo issue.

**Input:**
- `projectKey` (bắt buộc, string): Project key (ví dụ: "PROJ_XXX")
- `dryRun` (tùy chọn, boolean): true = xem metadata, không tạo issue. Default: false
- `issueType` (tùy chọn, string): Loại issue. Default: "Task". Khác: "Sub-task", "Bug", "Story"
- `summary` (tùy chọn, string): Tiêu đề ngắn gọn (bắt buộc khi tạo)
- `description` (tùy chọn, string): Mô tả chi tiết (bắt buộc khi tạo)
- `parentKey` (tùy chọn, string): Key của issue cha (bắt buộc nếu Sub-task)
- `priority` (tùy chọn, string): Mức độ ưu tiên (bắt buộc khi tạo). Values: "Highest", "High", "Medium", "Low", "Lowest"
- `labels` (tùy chọn, array of strings): Danh sách labels
- `spda` (tùy chọn, string): Mã SPDA (customfield_10100)
- `congDoan` (tùy chọn, string): Công đoạn (customfield_10101)
- `dueDate` (tùy chọn, string): Ngày hết hạn (YYYY-MM-DD format)
- `assignee` (tùy chọn, string): Username của người được assign
- `epicKey` (tùy chọn, string): Key của Epic muốn liên kết

**Safety:** Yêu cầu xác nhận từ user trước khi thực thi

**Output:**
- dryRun mode: Metadata bao gồm custom fields, assignable users, available epics
- Create mode: Issue key mới + direct link

**Các trường hợp sử dụng:**

1. **Xem metadata trước khi tạo (dryRun):**
```
User: "Show me the metadata for PROJ_XXX project"
Claude gọi: create_issue({ projectKey: "PROJ_XXX", dryRun: true, issueType: "Task" })

Response:
📋 Create Meta — PROJ_XXX / Task
### SPDA (customfield_10100)
Required: ✅
Options:
  • id: 10 → "PROJECT XXXXX"
  • id: 20 → "PROJECT YYYYY"

### Assignable Users
Tổng: 5 thành viên
  • name: "nghiath" → Nghĩa Thái (nghia@company.com)
  ...

### Epics đang mở
  • PROJ_XXX-100 → "Platform Architecture" [In Progress]
```

2. **Tạo issue mới:**
```
User: "Create a task in PROJ_XXX project: Implement OAuth integration, description: Add OAuth2 support for SSO, priority: High"
Claude gọi: create_issue({
  projectKey: "PROJ_XXX",
  issueType: "Task",
  summary: "Implement OAuth integration",
  description: "Add OAuth2 support for SSO",
  priority: "High",
  labels: ["backend", "feature"],
  spda: "Project SPDA",
  congDoan: "Development",
  dueDate: "2026-04-15",
  assignee: "nghiath"
})

[MCP yêu cầu xác nhận]
User xác nhận

Response: "✅ Đã tạo issue thành công!\n🔑 Key: PROJ_XXX-456\n🔗 Link: https://jira.company.com/browse/PROJ_XXX-456"
```

**Gợi ý tiếp theo:** `log_work` hoặc `update_issue`

---

### 6. manage_jira_pat

**Mô tả:** Quản lý Personal Access Token (PAT) của Jira.

**Input:**
- `action` (bắt buộc, string): Hành động. Values: "view" (xem PAT hiện tại), "update" (cập nhật PAT mới)
- `newPat` (tùy chọn, string): PAT mới (bắt buộc khi action = "update")

**Safety:** Yêu cầu xác nhận từ user trước khi cập nhật

**Output:**
- view mode: Thông tin PAT hiện tại (masked), file path, Jira URL
- update mode: Xác nhận với so sánh old/new PAT

**Các trường hợp sử dụng:**

1. **Xem PAT hiện tại:**
```
User: "Show me my current Jira PAT"
Claude gọi: manage_jira_pat({ action: "view" })

Response:
🔑 **Jira PAT — Thông tin hiện tại**

📁 File .env: `.env.local`
📄 File tồn tại: ✅ Có
🔐 PAT hiện tại: `{masked token}`
🌐 Jira URL: `https://jira.company.com`
```

2. **Cập nhật PAT:**
```
User: "My PAT expired, update it"
Claude gọi: manage_jira_pat({ 
  action: "update", 
  newPat: "your-new-token-here" 
})

[MCP yêu cầu xác nhận]
User xác nhận

Response: "✅ Đã cập nhật PAT thành công!
📁 File: `.env.local`
🔐 PAT cũ: `{masked old}`
🔐 PAT mới: `{masked new}`

🔄 JiraClient đã được reload — các API call tiếp theo sẽ dùng PAT mới."
```

---

## Development

### Scripts

```bash
npm run build      # Compile TypeScript → dist/
npm run dev        # Watch mode (tsx watch src/index.ts)
npm start          # Chạy compiled server (node dist/index.js)
npm run inspect    # Chạy MCP Inspector (debug tool schemas)
```

### Cấu trúc Project

```
src/
├── index.ts                     # Entry point (MCP server + transport)
├── jira/
│   ├── client.ts               # JiraClient class (REST API wrapper)
│   ├── tools.ts                # Tool registration + handlers
│   └── formatter.ts            # Output formatting cho AI
└── shared/
    ├── index.ts                # Re-exports
    └── utils.ts                # Error handling + tool chaining
```

### Test với MCP Inspector

```bash
npm run inspect
# Mở: http://localhost:8000/
# Test tool schemas + responses interactively
```

---

## Tài liệu chi tiết

- **`docs/project-overview-pdr.md`** — Mục đích project, requirements, roadmap
- **`docs/codebase-summary.md`** — Phân tích từng file, data flow, patterns
- **`docs/code-standards.md`** — Naming, conventions, error handling
- **`docs/system-architecture.md`** — Kiến trúc component, flows, deployment variants
