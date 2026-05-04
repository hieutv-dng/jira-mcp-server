# jira-mcp-server

MCP (Model Context Protocol) server tích hợp Jira cho Claude AI. Hỗ trợ Claude Desktop, Cursor, Windsurf, và LangChain tương tác trực tiếp với **Jira Server/Data Center** (không Cloud).

| Thông tin | Giá trị |
|-----------|--------|
| **Phiên bản** | v1.1.0 |
| **Trạng thái** | Production-ready |
| **Xác thực** | Personal Access Token (PAT) |
| **Transports** | Stdio (Claude Desktop), HTTP (LangChain, remote) |

## Tính năng

- **7 Tools:** get_current_user, list_issues, get_issue_detail, log_work, list_worklogs, update_issue, create_issue
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

### Share cho Team (không cần .env file)

Mỗi thành viên tự config trực tiếp trong MCP client của mình:

**Claude Desktop** (`~/.claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "jira-mcp-server": {
      "command": "node",
      "args": ["/path/to/jira-mcp-server/dist/index.js"],
      "env": {
        "JIRA_BASE_URL": "https://jira.company.com",
        "JIRA_PAT": "your-personal-pat-token"
      }
    }
  }
}
```

**Cursor/Windsurf** (`.cursor/mcp.json` hoặc `.windsurf/mcp.json`):
```json
{
  "mcpServers": {
    "jira-mcp-server": {
      "command": "node",
      "args": ["/path/to/jira-mcp-server/dist/index.js"],
      "env": {
        "JIRA_BASE_URL": "https://jira.company.com",
        "JIRA_PAT": "your-personal-pat-token"
      }
    }
  }
}
```

> **Lưu ý:** File `.env.local` chỉ cần khi dev local (`npm run dev`). Production dùng `env` block trong MCP config.

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
| **get_current_user** | Lấy thông tin user hiện tại (từ PAT) | Verify PAT, biết username cho JQL |
| **list_issues** | Filter issues (assignee, status, custom JQL) | Xem danh sách work items |
| **get_issue_detail** | Chi tiết issue + drift detection | Hiểu issue trước khi làm việc |
| **log_work** | Ghi nhận giờ làm (yêu cầu startedAt) | Timesheet, tracking |
| **list_worklogs** | Tổng giờ đã log của 1 user, group theo issue | Báo cáo timesheet, xem hiệu suất |
| **update_issue** | Chuyển status, comment, resolution | Cập nhật trạng thái |
| **create_issue** | Tạo issue (Task, Bug, Story) | Tạo work item mới |

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

# Tổng giờ đã log tháng này
list_worklogs({})

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
│   └── formatter.ts      # AI-friendly output
├── transports/
│   ├── stdio-transport.ts
│   └── http-transport.ts # Express + Bearer auth
└── shared/utils.ts       # Error handling, chaining
```

---

## Multi-Tenant Deployment

Cho phép nhiều users dùng chung một MCP server, mỗi user có credentials Jira riêng.

### Architecture

```
Client (headers) → Nginx (:443 SSL) → Node.js (:3000) → Jira API
```

### Client Config

Thêm `X-Jira-*` headers vào MCP client config:

```json
{
  "mcpServers": {
    "jira": {
      "type": "http",
      "url": "https://mcp.company.com/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_AUTH_TOKEN>",
        "X-Jira-Base-Url": "https://jira.company.com",
        "X-Jira-Pat": "<your-personal-token>"
      }
    }
  }
}
```

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | Bearer token (`MCP_AUTH_TOKEN` trên server) |
| `X-Jira-Base-Url` | No* | Jira server URL |
| `X-Jira-Pat` | No* | Personal Access Token |

*Fallback to server env vars nếu không truyền headers.

### Server Setup

1. **Chạy MCP server:**
```bash
HTTP_PORT=3000 MCP_AUTH_TOKEN=<secret> npm start
```

2. **Cấu hình Nginx:** Copy `deploy/nginx.conf.example` và sửa domain.

3. **SSL:** `certbot --nginx -d mcp.company.com`

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
