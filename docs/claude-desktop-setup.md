# Claude Desktop Setup

## Config Location

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

## Configuration

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

## Verify

1. Restart Claude Desktop
2. Tools icon should show Jira tools (list_issues, get_issue_detail, etc.)
3. Try: "List my open Jira issues"
