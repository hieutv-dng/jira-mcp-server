# Windsurf Setup

## Config Location

`~/.windsurf/mcp.json`

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

Then configure Windsurf:

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

1. Restart Windsurf
2. Check MCP tools available in Cascade AI
3. Try: "List my open issues in PROJ project"
