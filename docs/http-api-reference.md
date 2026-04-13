# HTTP API Reference

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |
| POST | `/mcp` | Yes | MCP protocol endpoint |

## Authentication

All requests to `/mcp` require Bearer token:

```
Authorization: Bearer <MCP_AUTH_TOKEN>
```

## Headers

Required headers for MCP requests:

```
Content-Type: application/json
Accept: application/json, text/event-stream
Authorization: Bearer <token>
```

## MCP Protocol

The `/mcp` endpoint uses JSON-RPC 2.0 over HTTP with Server-Sent Events (SSE).

### List Tools

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer your-secret" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

### Call Tool

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer your-secret" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "list_issues",
      "arguments": {"projectKey": "PROJ", "statusFilter": "open"}
    },
    "id": 2
  }'
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `HTTP_PORT` | Yes | Port to listen on |
| `MCP_AUTH_TOKEN` | Yes | Bearer token for auth |
| `JIRA_BASE_URL` | Yes | Jira server URL |
| `JIRA_PAT` | Yes | Jira Personal Access Token |

## Start Server

```bash
HTTP_PORT=3000 MCP_AUTH_TOKEN=your-secret npm start
```

## Security

- Bearer auth required for all MCP requests
- Health endpoint is public (for load balancers)
- DNS rebinding protection via Host header validation
- Only localhost/127.0.0.1 allowed by default
