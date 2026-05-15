# LangChain Setup

## Prerequisites

```bash
pip install langchain-mcp-adapters
```

## Start HTTP Server

```bash
HTTP_PORT=3000 MCP_AUTH_TOKEN=your-secret npm start
```

## Python Example

```python
from langchain_mcp_adapters import MCPToolkit

# Connect to MCP server
toolkit = MCPToolkit(
    url="http://localhost:3000/mcp",
    headers={"Authorization": "Bearer your-secret"}
)

# Get tools for LangChain agent
tools = toolkit.get_tools()

# Use with LangChain agent
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4")
agent = create_openai_tools_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools)

# Run
result = agent_executor.invoke({"input": "List my open Jira issues"})
print(result)
```

## Direct Tool Call

```python
from langchain_mcp_adapters import MCPToolkit

toolkit = MCPToolkit(
    url="http://localhost:3000/mcp",
    headers={"Authorization": "Bearer your-secret"}
)

# Call tool directly
result = toolkit.call_tool("list_issues", {
    "projectKey": "PROJ",
    "statusFilter": "open"
})
print(result)
```

## Available Tools

| Tool | Description |
|------|-------------|
| `get_current_user` | Fetch current user info (verify PAT, get username) |
| `list_issues` | List Jira issues with filters |
| `get_issue_detail` | Get full issue details with drift detection |
| `log_work` | Log work time on an issue |
| `list_worklogs` | List worklog entries (timesheet summary or detail with worklogId) |
| `delete_worklog` | Delete worklog entries (batch, dryRun preview required first) |
| `update_issue` | Assign/unassign user, update issue status/comment |
| `create_issue` | Create new issue with custom fields |
