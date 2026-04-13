# jira-mcp-server

MCP (Model Context Protocol) server tích hợp Jira cho Claude AI. Hỗ trợ Claude Desktop, Cursor, Windsurf, và LangChain tương tác trực tiếp với **Jira Server/Data Center** (không Cloud).

| Thông tin | Giá trị |
|-----------|--------|
| **Phiên bản** | v1.0.0 |
| **Trạng thái** | Production-ready |
| **Xác thực** | Personal Access Token (PAT) |
| **Transports** | Stdio (Claude Desktop), HTTP (LangChain, remote) |

## Tính năng

- **6 Tools:** list_issues, get_issue_detail, log_work, update_issue, create_issue, manage_jira_pat
- **Drift Detection:** Cảnh báo khi description lỗi thời so với comments
- **Tool Chaining:** Gợi ý hành động tiếp theo sau mỗi tool
- **Safety-First:** Write operations yêu cầu xác nhận từ user
- **Markdown Output:** Format AI-friendly với priority emojis, quality analysis

## Bắt đầu nhanh

### Yêu cầu

- Node.js 18+
- Jira Server/Data Center v7+ (không Cloud)
- Personal Access Token (PAT)

### Setup

1. **Clone & install:**
```bash
git clone <repo-url> && cd jira-mcp-server && npm install
```

2. **Cấu hình `.env.local`:**
```bash
JIRA_BASE_URL=https://jira.company.com
JIRA_PAT=<your-pat-token>
JIRA_DEFAULT_PROJECT=XYZ  # Tùy chọn
```

3. **Build & Run:**
```bash
npm run build                                    # Stdio transport
HTTP_PORT=3000 MCP_AUTH_TOKEN=secret npm start   # HTTP transport
```

### Kết nối Clients

- **Claude Desktop:** Xem [claude-desktop-setup.md](docs/claude-desktop-setup.md)
- **Cursor/Windsurf:** Xem [Connection Guide](docs/connection-guide.md)
- **LangChain/Remote:** Xem [http-api-reference.md](docs/http-api-reference.md)

### Test

```bash
npm run inspect    # MCP Inspector at http://localhost:8000
```

Hoặc trong Claude Desktop, thử: `"Show me open issues"`

## Tools Reference

Tất cả write operations (log_work, update_issue, create_issue) yêu cầu xác nhận từ user.

| Tool | Mô tả | Chủ yếu dùng cho |
|------|-------|-----------------|
| **list_issues** | Filter issues (assignee, status, custom JQL) | Xem danh sách work items |
| **get_issue_detail** | Chi tiết issue + drift detection | Hiểu issue trước khi làm việc |
| **log_work** | Ghi nhận giờ làm (yêu cầu startedAt) | Timesheet, tracking |
| **update_issue** | Chuyển status, comment, resolution | Cập nhật trạng thái |
| **create_issue** | Tạo issue (Task, Bug, Story) | Tạo work item mới |
| **manage_jira_pat** | View/update Personal Access Token | Quản lý xác thực |

**Ví dụ nhanh:**

```
# Xem issues của tôi
list_issues({ statusFilter: "open" })

# Chi tiết issue
get_issue_detail({ key: "PROJ-123" })

# Log 2 tiếng hôm qua
log_work({ 
  issueKey: "PROJ-123", 
  timeSpent: "2h", 
  comment: "Fixed UI bug",
  startedAt: "2026-04-12"
})

# Chuyển sang Done
update_issue({ 
  issueKey: "PROJ-123", 
  transitionName: "Done", 
  resolution: "Fixed"
})

# Tạo task mới
create_issue({
  projectKey: "PROJ",
  issueType: "Task",
  summary: "Implement feature",
  description: "Add OAuth support",
  priority: "High"
})
```

Xem chi tiết: [Tool Examples](docs/tool-examples.md) (nếu cần)

## Development

### Scripts

```bash
npm run build      # TypeScript → dist/
npm run dev        # Watch mode
npm start          # Run server (stdio or HTTP)
npm run inspect    # MCP Inspector (http://localhost:8000)
```

### Project Structure

```
src/
├── index.ts              # Entry + transport selection
├── jira/
│   ├── client.ts         # REST API wrapper
│   ├── tools.ts          # Tool registration + handlers
│   ├── formatter.ts      # AI-friendly output
│   └── pat-manager.ts    # Token management
├── transports/
│   ├── stdio-transport.ts
│   └── http-transport.ts # Express + Bearer auth
└── shared/utils.ts       # Error handling, chaining
```

---

## Documentation

### Setup & Connection
- [Connection Guide](docs/connection-guide.md) — Stdio vs HTTP
- [Claude Desktop](docs/claude-desktop-setup.md)
- [Cursor](docs/cursor-setup.md)
- [Windsurf](docs/windsurf-setup.md)
- [LangChain](docs/langchain-setup.md)
- [HTTP API Reference](docs/http-api-reference.md)

### Architecture & Standards
- [Project Overview](docs/project-overview-pdr.md)
- [Codebase Summary](docs/codebase-summary.md)
- [Code Standards](docs/code-standards.md)
- [System Architecture](docs/system-architecture.md)
