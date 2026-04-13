# jira-mcp-server: Codebase Summary

## Overview

jira-mcp-server là Node.js/TypeScript project (~1856 LOC) cung cấp MCP server cho Jira integration. Cấu trúc gọn gàng với 7 file chính: entry point, Jira client, tool definitions, formatter, PAT manager, utilities.

**Total LOC:** ~1856
**Files:** 7 source files + 2 config files
**Language:** TypeScript (ES2022, strict mode)
**Build:** tsc → dist/
**Transport:** stdio (Claude Desktop) + remote (supergateway + ngrok)

## File Structure

```
src/
├── index.ts (28 LOC)
├── jira/
│   ├── client.ts (727 LOC)
│   ├── tools.ts (659 LOC)
│   ├── formatter.ts (212 LOC)
│   └── pat-manager.ts (149 LOC) [NEW]
└── shared/
    ├── index.ts (1 LOC)
    └── utils.ts (80 LOC)

Config:
├── mcp-config.json — Safety config
├── tsconfig.json — TypeScript config
├── package.json — Dependencies
└── start-ngrok-remote.sh (157 LOC) — Remote deployment
```

## File-by-File Breakdown

### 1. **src/index.ts** (28 LOC)
**Purpose:** Entry point — khởi tạo MCP server, register tools, connect transport.

```typescript
// Pseudocode
const server = new McpServer({
  name: "jira-mcp-server",
  version: "1.0.0"
});

// Register 6 tools (via registerJiraTools)
registerListIssues(server);
registerGetIssueDetail(server);
registerLogWork(server);
registerUpdateIssue(server);
registerCreateIssue(server);
registerManageJiraPat(server);

// Connect stdio transport
const transport = new StdioServerTransport();
server.connect(transport);
```

**Key Points:**
- Imports từ `./jira/tools.ts` (tool registrations)
- Single transport layer: stdio (không có HTTP binding ở đây)
- Minimal error handling (relies on tool handlers)

### 2. **src/jira/client.ts** (727 LOC)
**Purpose:** Jira REST API v2 wrapper — singleton instance gọi API, fuzzy matching, custom field resolution.

**Class:** `JiraClient`

**Core Methods:**

| Method | Purpose | Returns |
|---|---|---|
| `searchIssues(jql, maxResults)` | JQL query (mở issue của user) | `{issues: Issue[]}` |
| `getIssue(key, fields)` | Chi tiết issue (full) | `Issue` object |
| `addWorklog(issueKey, hours, date, comment)` | Log giờ làm việc | Worklog ID |
| `getTransitions(issueKey)` | Danh sách status có thể chuyển | `{transitions: Transition[]}` |
| `transitionIssue(issueKey, transitionId, comment)` | Chuyển status | Void |
| `addComment(issueKey, comment)` | Thêm comment | Comment ID |
| `createIssue(payload)` | Tạo issue mới (với custom fields) | Issue key (VD: XYZ-123) |

**New Methods (Field Resolution & PAT):**

| Method | Purpose | Returns |
|---|---|---|
| `updatePat(newPat)` | Swap PAT token at runtime (no restart) | `{previousMasked, newMasked, action}` |
| `getCreateMeta()` | Parse QuickCreateIssue HTML cho field options | `{fields: {name, id, options[]}}` |
| `getCustomFieldFromIssue(issueKey, fieldName)` | Fallback custom field reading | Field value |
| `getAssignableUsers(projectKey)` | Danh sách users có thể assign | `User[]` |
| `searchEpics(projectKey)` | Tìm epics đang mở trong project | `Issue[]` |
| `resolveCustomFieldOption(fieldName, userInput)` | Fuzzy match user input vs allowed values | `{matched: string, suggestions: string[]}` |
| `resolveAssignee(projectKey, userInput)` | Fuzzy match username | `{matched: User, suggestions: User[]}` |
| `resolveEpicKey(projectKey, userInput)` | Fuzzy match epic name | `{matched: string, suggestions: string[]}` |
| `calcSimilarity(a, b)` | Character-overlap similarity (0-1) | `number` |
| `findBestOption(input, options)` | Multi-tier matching strategy | `{best, topThree}` |

**Implementation Details:**

- **Singleton Pattern:** `export const jiraClient = new JiraClient()`
- **Auth:** Bearer token từ `JIRA_PAT` env var
- **HTTP Client:** axios instance với:
  - Base URL: `JIRA_BASE_URL`
  - Headers: `Authorization: Bearer {token}`
  - Timeout: 15 seconds
  - Error interceptor: extract `response.data.errorMessages` cho clean error
- **Error Handling:** Throws custom errors (name, message, status code)
- **Retry Logic:** Không có built-in retry (rely on caller)

**Key Code Pattern:**

```typescript
private client = axios.create({
  baseURL: this.baseUrl,
  timeout: 15000,
  headers: {
    'Authorization': `Bearer ${this.pat}`,
    'Content-Type': 'application/json'
  }
});

// Error interceptor
this.client.interceptors.response.use(
  res => res,
  err => {
    const msg = err.response?.data?.errorMessages?.[0] || err.message;
    throw new Error(msg);
  }
);
```

### 3. **src/jira/tools.ts** (659 LOC)
**Purpose:** MCP tool registration — định nghĩa 6 tools, schema validation, handlers, fuzzy matching.

**Tools Registered (6 total):**

| Tool | Input Schema | Handler | Safety |
|---|---|---|---|
| `list_issues` | `{project?, assigneeFilter?, roleFilter?, statusFilter?, maxResults?}` | searchIssues + filters | No confirm |
| `get_issue_detail` | `{key}` | getIssue + drift detection | Drift warning |
| `log_work` | `{key, hours, date?, comment?}` | addWorklog | **CONFIRM** |
| `update_issue` | `{key, status?, comment?, dryRun?}` | getTransitions → transitionIssue + addComment | **CONFIRM** |
| `create_issue` | `{projectKey, issueType, summary, description, priority, labels, spda?, congDoan?, dueDate?, assignee?, epicKey?, dryRun?}` | createIssue + metadata + fuzzy resolve | **CONFIRM** |
| `manage_jira_pat` | `{action: 'get'|'update', pat?}` | getCurrentPat() or updatePat() | Mixed (view=no, update=yes) |

**Old Tools (REMOVED/RENAMED):**
- `list_my_open_issues` → `list_issues` (expanded with filters)
- `update_issue_status` + `add_comment` → merged into `update_issue`
- `get_available_transitions` → removed (available via `update_issue` dryRun)

**Key Implementation:**

1. **Schema Validation (Zod):**
   ```typescript
   const ListIssuesInput = z.object({
     project: z.string().optional(),
     maxResults: z.number().default(10)
   });
   ```

2. **Tool Registration Pattern:**
   ```typescript
   server.setRequestHandler(
     Tool,
     async (req: ToolRequest) => {
       const args = req.params.arguments;
       return withErrorHandler(() => {
         // Validate, call JiraClient, format response
       });
     }
   );
   ```

3. **Drift Detection (get_issue_detail):**
   - `buildQuickDriftWarning()` heuristic:
     - Issue tuổi > 30 ngày → +25 points
     - Comments sau cập nhật cuối cùng > 5 → +40 points
     - Description chứa từ khóa (fix, bug, refactor, revert) mà comments sau → +35 points
     - Score > 75 → warn "Có thể lỗi thời"
   - Warning format: `⚠️ DRIFT DETECTED: ...`

4. **Tool Chaining (getChainHint):**
   - Mỗi tool response đi kèm `chainHint` gợi ý hành động tiếp theo
   - Ví dụ: `get_issue_detail` → `logWork` hoặc `updateIssueStatus`

5. **Confirmation Flow (mcp-config.json):**
   - Tools trong `requireConfirmation` array sẽ CLI prompt user trước khi execute
   - mcp-config.json được read bởi MCP SDK

### 4. **src/jira/formatter.ts** (212 LOC)
**Purpose:** Format Jira data thành AI-friendly markdown.

**Functions:**

| Function | Input | Output | Purpose |
|---|---|---|---|
| `formatIssueListForAI()` | `Issue[]` | Markdown table | List view với priority, status, points |
| `formatIssueForAI()` | `Issue` | Markdown text | Detail view với quality checks |
| `priorityEmoji()` | priority string | emoji + text | Convert "High" → "🔴 High" |
| `formatDate()` | Date | vi-VN string | Localized (27/03/2026 10:30) |
| `cleanJiraMarkup()` | Jira wiki text | Markdown | h1→#, *bold*→**bold** |

**Example Output (formatIssueListForAI):**

```markdown
| Priority | Key | Summary | Status | Points |
|---|---|---|---|---|
| 🔴 High | XYZ-123 | Fix login bug | In Progress | 5 |
| 🟡 Medium | XYZ-124 | Add dark mode | To Do | 8 |
```

**Example Output (formatIssueForAI):**

```markdown
## XYZ-123: Fix login bug
**Status:** In Progress | **Priority:** High | **Points:** 5

### Description
User cannot login with SSO...

### Quality Analysis
✅ Description has Given-When-Then sections
⚠️ 15 comments since last update (possible drift)

### Next Steps
- Log work (add hours)
- Add comment or transition to Done
```

**Key Features:**

- **Description Quality Check:** Detects GWT (Given-When-Then) sections
- **Priority Emoji:** 🔴 (Critical), 🔴 (High), 🟡 (Medium), 🟢 (Low)
- **Date Formatting:** Vietnamese locale (vi-VN) — 27/03/2026 10:30
- **Jira Markup → Markdown:** Remove wiki formatting, convert to standard MD

### 5.5 **src/jira/pat-manager.ts** (149 LOC) [NEW]
**Purpose:** PAT lifecycle management — view/update token at runtime without restart.

**Functions:**

| Function | Purpose | Returns |
|---|---|---|
| `getCurrentPat()` | Read JIRA_PAT from .env, return metadata | `{pat, envPath, exists, masked}` |
| `updatePat(newPat)` | Write to .env, update process.env | `{previousMasked, newMasked, action}` |
| `validatePat(pat)` | Basic validation (non-empty, ≥10 chars) | `{valid: boolean, message?: string}` |
| `maskPat(pat)` | Hide credentials (first 4 + "****" + last 4) | `string` |

**Env File Resolution:**
```
1. ENV_FILE_PATH env var (if set)
2. .env in project root
3. .env in CWD
```

### 6. **src/shared/utils.ts** (80 LOC)
**Purpose:** Error handling + tool chaining utility.

**Functions:**

| Function | Purpose |
|---|---|
| `formatToolError(error)` | Convert Error → MCP error response |
| `withErrorHandler(handler)` | Try-catch wrapper for all tool handlers |
| `getChainHint(toolName)` | Return next tool suggestion |

**TOOL_CHAINING Map (UPDATED):**

```typescript
const TOOL_CHAINING = {
  'list_issues': 'get_issue_detail or create_issue',
  'get_issue_detail': 'log_work or update_issue or manage_jira_pat',
  'log_work': 'update_issue',
  'update_issue': 'list_issues',
  'create_issue': 'get_issue_detail',
  'manage_jira_pat': '(no chain)'
};
```

**Error Formatting:**

```typescript
// Input: Error | string | unknown
// Output: { code: "...", message: "..." }

formatToolError(new Error("API timeout"))
→ { code: "INTERNAL_ERROR", message: "API timeout" }
```

### 7. **src/shared/index.ts** (1 LOC)
**Purpose:** Re-exports (usually empty or minimal).

```typescript
export * from './utils.ts';
```

## Configuration Files

### **mcp-config.json** (UPDATED)
Safety configuration:

```json
{
  "tools": {
    "requireConfirmation": [
      "log_work",
      "update_issue",
      "create_issue",
      "manage_jira_pat"
    ]
  }
}
```

MCP SDK reads này để prompt user confirmation trước execute. Note: `update_issue` merged old `update_issue_status` + `add_comment`.

### **tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "strict": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

### **package.json**
```json
{
  "name": "jira-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "inspect": "mcp-inspector ... (mcp inspector command)"
  }
}
```

## Data Flow

```
User Request (Claude Desktop)
    ↓
stdio Transport (MCP protocol)
    ↓
MCP Server (index.ts)
    ↓
Tool Handler (tools.ts)
    ├─ Input Validation (Zod)
    ├─ Confirmation Check (mcp-config.json)
    └─ Handler Execution (withErrorHandler)
    ↓
JiraClient (client.ts)
    ├─ Build API URL + headers
    ├─ axios call (15s timeout)
    └─ Parse response | throw error
    ↓
Jira REST API v2
    ↓
Response → Formatter (formatter.ts)
    ├─ cleanJiraMarkup
    ├─ priorityEmoji
    └─ Quality analysis
    ↓
Output (Markdown text)
    ↓
MCP Protocol Response
    ↓
Claude Desktop / Claude Code
```

## Key Design Patterns

### 1. **Singleton JiraClient**
```typescript
// client.ts
export const jiraClient = new JiraClient(
  process.env.JIRA_BASE_URL,
  process.env.JIRA_PAT
);

// tools.ts
import { jiraClient } from './client.ts';
const issues = await jiraClient.searchIssues(...);
```

**Benefit:** Single axios instance reused, consistent headers, one auth point.

### 2. **Error Wrapper (withErrorHandler)**
```typescript
return withErrorHandler(async () => {
  const args = parse(req.params.arguments);
  const result = await jiraClient.method(...);
  return format(result);
});
```

**Benefit:** Consistent error handling, no try-catch boilerplate.

### 3. **Zod Schema Validation**
```typescript
const schema = z.object({ key: z.string() });
const args = schema.parse(req.params.arguments);
```

**Benefit:** Runtime validation, type-safe at compile time.

### 4. **Tool Chaining (getChainHint)**
```typescript
return {
  content: [{ type: 'text', text: formattedIssue }],
  metadata: {
    chainHint: getChainHint('get_issue_detail') // → "log_work or update_issue_status"
  }
};
```

**Benefit:** Claude knows next logical step, improves multi-turn conversations.

## Dependencies Tree

```
index.ts
├── @modelcontextprotocol/sdk
├── ./jira/tools.ts
│   ├── zod (validation)
│   ├── ./jira/client.ts
│   │   ├── axios (HTTP)
│   │   └── dotenv (env)
│   ├── ./jira/formatter.ts
│   │   └── (no external deps)
│   └── ./shared/utils.ts
│       └── (no external deps)
└── (stdio transport)
```

## Code Metrics

| Metric | Value | Note |
|---|---|---|
| Total LOC | ~1856 | Source only (excl. dist/, node_modules) |
| Entry point | 28 LOC | Minimal, clean |
| Longest file | client.ts (727 LOC) | Major growth: fuzzy matching + field resolution |
| External deps | 4 prod | Minimal, well-chosen |
| Dev deps | 3 | tsx, typescript, @types/node |
| Test coverage | 0% | No unit tests (optional for v1) |

## Common Code Patterns

### Error Handling
```typescript
try {
  const res = await this.client.get(`/rest/api/2/issue/${key}`);
  return res.data;
} catch (err) {
  throw formatToolError(err);
}
```

### Input Validation
```typescript
const schema = z.object({
  key: z.string().min(1),
  hours: z.number().positive().max(24)
});
const args = schema.parse(input);
```

### Response Formatting
```typescript
const markdown = formatIssueForAI(issue);
return {
  content: [{ type: 'text', text: markdown }],
  metadata: { chainHint: 'log_work' }
};
```

## Deployment

### Local (stdio - Claude Desktop)
```bash
npm run build
npm start  # Runs node dist/index.js
# Connect via MCP config in Claude Desktop Settings → Developer
```

### Remote (supergateway + ngrok)
```bash
./start-ngrok-remote.sh  # Automated deployment
# Outputs Claude config snippets for remote connection
```

**start-ngrok-remote.sh handles:**
- Pulls supergateway v3.4.3 Docker image
- Runs jira-mcp-server in container
- Bridges stdio → Streamable HTTP (supergateway)
- Creates ngrok tunnel for remote access
- Health checks, process monitoring, graceful shutdown

## Extension Points

**To Add a New Tool:**
1. Add method to `JiraClient` (client.ts)
2. Create Zod schema in tools.ts
3. Register handler in tools.ts with `server.setRequestHandler()`
4. Add formatter if needed (formatter.ts)
5. Update tool chaining map (utils.ts)
6. Test via MCP Inspector (`npm run inspect`)

**Example:**
```typescript
// client.ts
async getIssueHistory(issueKey: string) {
  const res = await this.client.get(`/rest/api/2/issue/${key}/changelog`);
  return res.data.values;
}

// tools.ts
server.setRequestHandler(Tool, async (req: ToolRequest) => {
  if (req.params.name === 'get_issue_history') {
    const key = req.params.arguments.key as string;
    const history = await jiraClient.getIssueHistory(key);
    return {
      content: [{ type: 'text', text: formatHistory(history) }]
    };
  }
});
```

## Maintenance Notes

- **Jira API Docs:** https://docs.atlassian.com/software/jira/guides/rest-api/latest/ (Server/Data Center API v2)
- **MCP Spec:** https://modelcontextprotocol.io/
- **Update Cycle:** Semi-annual (aligns with Jira releases)
- **Known Limitations:**
  - No Jira Cloud support (OAuth not implemented, PAT only)
  - Drift detection heuristic (not 100% accurate)
  - Custom field support: hardcoded fields (spda, congDoan) + fallback resolution
- **Recent Changes (v1.1):**
  - Added PAT runtime management (manage_jira_pat tool)
  - Enhanced create_issue with fuzzy field matching
  - Merged update_issue_status + add_comment → update_issue
  - Expanded list_issues with filtering (assignee, role, status)
