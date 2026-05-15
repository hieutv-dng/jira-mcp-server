# Brainstorm — Phân rã Q2/2026 jira-mcp-server thành Jira tasks

**Ngày:** 2026-05-08
**Source report:** `plans/reports/git-activity-260508-0251-q2-2026-jira-mcp-audit.md`
**Project:** SPTN
**Reporter:** `hieutv.dng <vuhieu91@gmail.com>`

## 1. Vấn đề

Phân rã 18 commits / 9,889 insertions trong cửa sổ 01/04 → 03/05/2026 thành **1 parent task + ≤8 subtasks**, đảm bảo:
- Mọi đầu việc trong report đều có subtask đại diện
- Không trùng/liên quan với worklog tháng 03/2026

## 2. Dedup verification (worklog 03/2026)

JQL chạy: `mcp__jira-mcp-server__list_worklogs` với `dateFrom=2026-03-01`, `dateTo=2026-03-31`, `projectKey=SPTN`, user `hieutv.dng`.

| Issue | Summary | Hours |
|---|---|---|
| SPTN-152 | Workshop Vibe Coding buổi 3 | 4h |
| SPTN-151 | Workshop Vibe Coding buổi 2 | 4h |
| SPTN-150 | Workshop Vibe Coding buổi 1 | 4h |
| SPTN-149 | Tài liệu hướng dẫn & demo | 8h |
| SPTN-148 | Slide trình bày Workshop | 10h |
| SPTN-147 | Nghiên cứu Vibe Coding/Claude Code/Codex/Claude Kit | 10h |
| **Total** | | **40h** |

**Kết luận:** Toàn bộ worklog 03/2026 là Workshop Vibe Coding — zero overlap với jira-mcp-server build work. ✅ Safe to create.

**Tham khảo (không trùng nhưng cùng từ khoá MCP):**
- SPTN-125, SPTN-139 — research MCP general (đã Done, scope khác)
- SPTN-142 — playwright + genAI (khác hẳn)
- SPTN-180 — MCP UI khác (khác repo)

## 3. Cấu trúc đề xuất (1 parent + 8 subtasks)

### Parent — Task

**Summary:** `[jira-mcp-server] Phát triển MCP Jira server v1.1.0 cho Claude AI integration`

**Description (template):**
```
Repo: jira-mcp-server (https://github.com/hieutv-dng/jira-mcp-server)
Scope: 01/04/2026 → 03/05/2026
Output: 7 tools MCP server, 2 transport modes (stdio + HTTP), multi-tenant ready, v1.1.0 release

Reference: plans/reports/git-activity-260508-0251-q2-2026-jira-mcp-audit.md
Total: 18 commits, +9889/-2785 LOC, 2037 LOC source cuối kỳ

Subtasks below trace 1-1 với commit clusters trong report.
```

**Estimate:** 40h (5 ngày công)

### 8 Subtasks (Sub-task type)

| # | Summary | Commits | LOC diff | Estimate | Ngày |
|---|---|---|---|---|---|
| 1 | Bootstrap codebase MCP Jira (6 tools, JiraClient, formatter, plans/docs scaffold) | `5df5a4b` | +7,560 | **16h** | 13/04 |
| 2 | Multi-transport: HTTP transport + Bearer auth + connection guides (Claude Desktop/Cursor/Windsurf/LangChain) | `6b6bc03`, `611c987` | +941/-447 | **6h** | 13/04 |
| 3 | Multi-tenant HTTP headers (factory `createJiraClient`, lazy singleton, nginx example) + xoá `manage_jira_pat` tool | `c2d55eb`, `a71693e`, `ddadc38` | +497/-360 | **5h** | 13/04 |
| 4 | Tool polish: simplify `log_work` + thêm `startedAt` param + rename package `jira-mcp-server` | `3725cf9`, `e29bacd`, `a138be3` | +69/-502 | **2h** | 13/04 |
| 5 | Issue search field expansion: `duedate`, `reporter`, `resolution` (bug-fix missing fields) | `4b95638` | +14/-2 | **1h** | 16/04 |
| 6 | Thêm tool `get_current_user` + cập nhật `TOOL_CHAINING` map + formatter 3 fields | `69586f4`, `98ca7e6` | +102/-19 | **3h** | 21/04 |
| 7 | Documentation overhaul: CLAUDE.md, README VN translation, journals (multi-transport, multi-tenant), plan templates | `cdf2e1a`,`6249065`,`3d079cd`,`fd9cbb5`,`46d440e` | +662/-1775 | **5h** | 13–14/04 |
| 8 | Release v1.1.0: CHANGELOG, bump `package.json`, sync `mcp-config.json` + docs | `945d505` | +44/-9 | **2h** | 21/04 |

**Tổng estimate subtasks:** 40h ≈ parent task estimate.

## 4. Mapping subtask ↔ commit (audit trail)

```
Subtask #1 ← 5df5a4b "feat: MCP Jira Server for Claude integration"
Subtask #2 ← 6b6bc03 "feat(transport): HTTP + Bearer auth"
            611c987 "docs: condense README + multi-transport journal"
Subtask #3 ← c2d55eb "feat(transport): multi-tenant HTTP headers"
            a71693e "refactor(tools): remove manage_jira_pat"
            ddadc38 "docs: multi-tenant HTTP headers journal"
Subtask #4 ← 3725cf9 "refactor: simplify log_work"
            e29bacd "refactor(tools): add startedAt to log_work"
            a138be3 "refactor: rename package to jira-mcp-server"
Subtask #5 ← 4b95638 "fix(tools): missing fields in search/formatter"
Subtask #6 ← 69586f4 "feat(jira): add get_current_user"
            98ca7e6 "docs: update tool count + architecture"
Subtask #7 ← cdf2e1a "docs: sync codebase-summary LOC"
            6249065 "docs: add CLAUDE.md"
            3d079cd "docs: README + plan templates"
            fd9cbb5 "docs: translate README to Vietnamese"
            46d440e "docs(readme): fix HTTP transport type"
Subtask #8 ← 945d505 "chore(release): v1.1.0"
```

✅ 18/18 commits đã được map.

## 5. Acceptance criteria mỗi subtask

- **#1 Bootstrap:** repo init, 6 tools đăng ký (`list_issues`, `get_issue_detail`, `log_work`, `update_issue`, `create_issue`, `manage_jira_pat`), `npm run build` pass, `npm run inspect` chạy được.
- **#2 Multi-transport:** `HTTP_PORT` env switch hoạt động, Bearer auth reject 401 khi sai token, `/health` trả 200, 4 connection guides có nội dung.
- **#3 Multi-tenant + remove PAT:** request có `X-Jira-Base-Url` + `X-Jira-Pat` → isolation per request, PAT manager tool bị xoá khỏi tool list (5 tools), nginx example tồn tại.
- **#4 Polish:** `log_work` accept `startedAt` ISO, package.json `name = jira-mcp-server`, error message log_work cải thiện.
- **#5 Field expansion:** `list_issues` output có `duedate`, `reporter`, `resolution`; verify trên 1 ticket có 3 field.
- **#6 get_current_user:** tool trả `username/displayName/email/timezone`; `TOOL_CHAINING` có entry cho tool mới; formatter detail có 3 field thiếu.
- **#7 Docs:** README VN bản dịch hoàn chỉnh; CLAUDE.md tồn tại; 2 journal entries multi-transport + multi-tenant; plan templates 4 file.
- **#8 Release:** `CHANGELOG.md` có section v1.1.0; `package.json` version `1.1.0`; tag/commit chore(release).

## 6. Risk / Dependency

- **#3 phụ thuộc #2** — header auth refactor cần HTTP transport sẵn.
- **#3 phụ thuộc #1** — JiraClient phải tồn tại để refactor thành factory.
- **#6 phụ thuộc #1** — cần JiraClient + tool registration pattern.
- **#7 docs có thể song song** với #1-#6 (đã làm overlap thực tế trong report).
- **#8 release phải cuối** — chốt CHANGELOG sau khi #6 merge.
- **Trùng lặp risk:** đã verify 03/2026 worklog không trùng. Khi tạo Jira tránh dùng từ khoá "Workshop", "Vibe Coding", "Claude Kit" trong summary để filter rõ ràng.

## 7. Next step

1. **Approve cấu trúc này** → tạo Jira parent + 8 subtasks (dùng `mcp__jira-mcp-server__create_issue` với `parentIssueKey` field cho subtasks).
2. **Logwork** sau khi tạo: chạy `log_work` cho từng subtask, dùng cột "Estimate" làm baseline, có thể dùng commit date (`startedAt`) để chính xác.
3. **Verify lần cuối:** sau khi tạo, chạy lại `list_worklogs` 04/2026 + 05/2026 để confirm tổng giờ.

## Câu hỏi mở

- Subtask cần `Epic Link` không? Project SPTN có epic nào cho "Internal Tools / Productivity" để link vào không?
- Có cần thêm `Labels` (VD: `mcp-server`, `claude-integration`, `internal-tooling`) không?
- Worklog backdate có policy giới hạn không (Jira Server thường cho phép `started` < hôm nay)?
- Có muốn tự động tạo luôn bằng `create_issue` ở session tiếp theo, hay bạn copy-paste manual?
