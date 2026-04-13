# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP Server providing Jira integration for Claude AI. Targets Jira Server/Data Center (not Cloud) with PAT authentication. 5 tools: list_issues, get_issue_detail, log_work, update_issue, create_issue.

## Build & Run Commands

```bash
npm run build      # TypeScript → dist/
npm run dev        # Watch mode (tsx)
npm start          # Run server (stdio transport)
npm run inspect    # MCP Inspector for testing tools
```

## Architecture

**Entry:** `src/index.ts` → McpServer + StdioServerTransport

**Core modules:**
- `src/jira/tools.ts` — Tool registration, Zod schemas, request handlers
- `src/jira/client.ts` — JiraClient class wrapping Axios for REST API
- `src/jira/formatter.ts` — Markdown output formatting for AI consumption
- `src/shared/utils.ts` — Error handling wrapper, tool chaining hints

**Data flow:** Claude → MCP stdio → tools.ts handler → JiraClient API call → formatter → Markdown response

## Key Patterns

- **Error handling:** All tool handlers wrapped with `withErrorHandler()` from utils.ts
- **Input validation:** Zod schemas for every tool input
- **Tool chaining:** `TOOL_CHAINING` map in utils.ts suggests next action
- **Write safety:** log_work, update_issue, create_issue require user confirmation via MCP annotations

## Environment

Requires `.env.local` with:
```
JIRA_BASE_URL=https://jira.company.com
JIRA_PAT=<your-token>
JIRA_DEFAULT_PROJECT=XYZ  # Optional
```

## Adding New Tools

1. Add API method in `src/jira/client.ts`
2. Create Zod schema in `src/jira/tools.ts`
3. Register handler in `registerJiraTools()` function
4. Add formatter in `src/jira/formatter.ts` if needed
5. Update `TOOL_CHAINING` in `src/shared/utils.ts`
6. Test with `npm run inspect`

## TypeScript Config

ES2022 target, NodeNext modules, strict mode. Output to `dist/`. All imports require `.js` extension for ESM compatibility.
