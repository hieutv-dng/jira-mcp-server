# 2026-04-13: Multi-Transport MCP Plan

## Context

jira-mcp-server chỉ hỗ trợ stdio → chỉ Claude Desktop/Code hoạt động. Cần mở rộng cho tất cả AI agents.

## Decision

- Thêm HTTP transport (Express + Bearer auth)
- Environment-driven: `HTTP_PORT=3000` → HTTP, else → stdio
- Backward compatible: stdio vẫn là default

## Key Insights

- MCP SDK v1.0.0 hỗ trợ Streamable HTTP (stable)
- SSE deprecated, WebSocket chưa có
- Cursor, Windsurf, LangChain, OpenAI Agents SDK đều dùng HTTP

## Plan

3 phases, ~2.5h:
1. Transport layer refactor + HTTP
2. Documentation (6 client guides)
3. Testing & validation

## Files

- Plan: `plans/260413-1646-multi-transport-mcp/`
- Brainstorm: `plans/reports/brainstorm-260413-1646-multi-transport-mcp.md`
- Research: `plans/reports/researcher-260413-1648-mcp-transport-compatibility.md`
