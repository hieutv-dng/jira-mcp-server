# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
