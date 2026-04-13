# Cursor Setup

## Config Location

`~/.cursor/mcp.json`

## Stdio Configuration (Recommended)

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

## HTTP Configuration (Alternative)

First, start the HTTP server:

```bash
HTTP_PORT=3000 MCP_AUTH_TOKEN=your-secret npm start
```

Then configure Cursor:

```json
{
  "mcpServers": {
    "jira": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer your-secret"
      }
    }
  }
}
```

## Verify

1. Restart Cursor
2. Check MCP tools available in Cursor AI
3. Try: "Show my Jira tasks"
