# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-05-15

### Added
- `delete_worklog` tool — batch delete work logs with dryRun preview, adjustEstimate=auto for automatic recalculation
- `list_worklogs` tool — aggregate worklog summary or detailed list with worklogId per entry
- `JiraClient.deleteWorklog()` — REST API wrapper for DELETE /rest/api/2/issue/{key}/worklog/{id}
- `JiraClient.getIssueWorklogs()` — Fetch all work logs for an issue
- `WorklogEntry` interface — Type definition for worklog structure
- `formatWorklogDetail()` formatter — Markdown detail output for worklog entries
- Tools directory refactored: `src/jira/tools.ts` → `src/jira/tools/` (5 focused files: index.ts, user-tools.ts, issue-tools.ts, issue-drift-warning.ts, create-issue-tool.ts, worklog-tools.ts)

### Changed
- Tools now registered via barrel export in `src/jira/tools/index.ts` for better maintainability
- `list_worklogs` response format expanded to include worklogId per entry when detail=true
- Refactored `tools.ts` into modular files to reduce cognitive load

## [1.1.0] - 2026-04-21

### Added
- HTTP transport via Express with Bearer auth (alongside existing stdio)
- Multi-tenant HTTP headers authentication
- `get_current_user` tool
- `duedate`, `reporter`, `resolution` fields in issue search results and formatters
- `startedAt` parameter for `log_work` tool

### Changed
- Renamed package from `mcp-jira-tools` to `jira-mcp-server`
- Simplified `log_work` tool and improved error messaging
- README condensed; translated to Vietnamese for internal team

### Removed
- `manage_jira_pat` tool

### Fixed
- HTTP transport type value in README (`streamableHttp` → `http`)
- Missing `duedate`, `reporter`, `resolution` fields in search/formatters

## [1.0.0] - Initial release

- Core MCP Jira server with stdio transport
- Tools: `list_issues`, `get_issue_detail`, `log_work`, `update_issue`, `create_issue`

[1.1.0]: https://github.com/hieutv-dng/jira-mcp-server/releases/tag/v1.1.0
[1.0.0]: https://github.com/hieutv-dng/jira-mcp-server/releases/tag/v1.0.0
