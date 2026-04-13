# Connection Guide

## Transport Options

| Transport | Use Case | Env Vars |
|-----------|----------|----------|
| Stdio (default) | Claude Desktop, Cursor, Windsurf | None |
| HTTP | Remote agents, LangChain, cloud | `HTTP_PORT`, `MCP_AUTH_TOKEN` |

## Quick Start

### Stdio (Claude Desktop, Cursor, Windsurf)

```bash
npm run build
npm start
```

### HTTP (LangChain, OpenAI Agents, remote)

```bash
npm run build
HTTP_PORT=3000 MCP_AUTH_TOKEN=your-secret npm start
```

## Client Guides

- [Claude Desktop](./claude-desktop-setup.md)
- [Cursor](./cursor-setup.md)
- [Windsurf](./windsurf-setup.md)
- [LangChain](./langchain-setup.md)
- [HTTP API Reference](./http-api-reference.md)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JIRA_BASE_URL` | Yes | - | Jira server URL |
| `JIRA_PAT` | Yes | - | Jira Personal Access Token |
| `JIRA_DEFAULT_PROJECT` | No | - | Default project key |
| `HTTP_PORT` | No | - | Enable HTTP transport |
| `MCP_AUTH_TOKEN` | If HTTP | - | Bearer token for HTTP auth |
