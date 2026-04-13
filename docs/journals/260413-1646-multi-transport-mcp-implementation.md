# Multi-Transport MCP Server: HTTP + Stdio Implementation

**Date**: 2026-04-13 17:28
**Severity**: Medium
**Component**: Transport layer, server initialization
**Status**: Resolved

## What Happened

Implemented HTTP transport for jira-mcp-server alongside the existing stdio transport. The MCP server can now operate in two modes: local (stdio, default) for Claude Desktop/Cursor/Windsurf, or networked (HTTP) for cloud deployments and LangChain integrations.

## The Brutal Truth

This was both straightforward AND deceptively dangerous. The straightforward part: Express + Bearer auth is commodity code. The dangerous part: early implementation had a shared McpServer instance across requests, creating a race condition where concurrent connections would corrupt each other's state. Found it during code review—would've been a silent data corruption bug in production. The frustration is that the MCP SDK examples don't make this statelessness requirement obvious, so it's an easy trap.

## Technical Details

**Transport selection logic** (src/index.ts):
```typescript
if (httpPort) {
  await startHttpTransport(server, parseInt(httpPort, 10));
} else {
  await startStdioTransport(server);
}
```

**Race condition fixed in http-transport.ts**:
- Created `createPerRequestServer()` to spawn a new McpServer instance per HTTP request
- Each request gets isolated tool handler state, avoiding concurrent mutation
- Without this: two simultaneous requests would share request context, tool state, and error handling state

**Memory leak fixed**:
```typescript
res.on("close", () => {
  transport.close();
  server.close();
});
```
- Previously, transports and servers were never cleaned up
- In long-running HTTP servers, this accumulates unclosed sockets and file descriptors
- With hundreds of requests, would eventually hit OS limits (too many open files)

**Auth implementation** (bearerAuth middleware):
- Case-insensitive header check: `req.headers.authorization?.toLowerCase()`
- Token extraction properly handles "Bearer " prefix (with space)
- Public /health endpoint for k8s liveness probes (no auth required)
- Mandatory MCP_AUTH_TOKEN or server fails at startup with clear error message

## What We Tried

1. **Initial approach**: Shared McpServer instance across requests
   - Why it failed: State corruption under concurrent load (found during review, not in testing)
   - Lesson: Stateless architecture requires per-request initialization

2. **Transport cleanup**: Forgot `res.on("close")` handlers initially
   - Why it failed: Descriptors leaked, would OOM in production
   - Lesson: HTTP servers must actively clean up per-request resources

3. **Auth header parsing**: Initial version didn't lowercase authorization header
   - Why it failed: Case-sensitive check fails with "BEARER" or "Bearer" variants
   - Lesson: HTTP headers are case-insensitive by spec; never assume casing

## Root Cause Analysis

**Why the shared McpServer bug happened:**
- MCP SDK examples show stateless HTTP usage, but the pattern isn't emphasized
- Initial thinking: "MCP server is lightweight, reuse it" — wrong for HTTP
- No test coverage for concurrent requests (unit tests use sequential calls)
- Code review caught it; unit tests wouldn't have

**Why resource cleanup was forgotten:**
- Express conventions don't require cleanup (app-level resources), but per-request resources do
- Similar to: database connection pools, temporary file streams, socket timeouts
- Mental model: "Express will handle it" — partially true, but not for custom objects like McpServer

**Why auth header was case-sensitive initially:**
- Habit from reading specific examples that always use "Bearer " (capitalized)
- HTTP RFCs are fuzzy on header value formatting
- Should have caught with: curl header variations in manual testing

## Lessons Learned

1. **Stateless HTTP services require per-request initialization**: Don't reuse connection-specific objects (servers, contexts, sessions) across requests. This isn't a performance optimization; it's correctness. Create, use, destroy.

2. **Resource cleanup is non-negotiable in HTTP**: For every `new`, there must be a corresponding `.close()` or cleanup handler. Stdio transport doesn't require this because the process exits; HTTP servers live indefinitely.

3. **MCP SDK has sharp edges**: The Express integration doesn't warn you about statelessness. Next developer might fall into the same trap. Document it heavily.

4. **Test with concurrency from day one**: Sequential unit tests miss race conditions. Need at least one concurrent stress test (even simple: 50 parallel requests) before shipping HTTP.

5. **Case-insensitive HTTP always**: Headers, auth schemes, content-type parameters — assume nothing about casing. Normalize early: `toLowerCase()` on inputs, compare normalized.

## Next Steps

1. Add concurrent stress test: 50 parallel /mcp requests with load verification
   - Owner: QA/tester agent
   - Timeline: 1 sprint
   - Success: All requests succeed, no state corruption, no leaked descriptors

2. Document stateless architecture in CLAUDE.md
   - Update CLAUDE.md with "HTTP Transport Safety" section
   - Explain per-request server pattern with example
   - Owner: documentation
   - Timeline: Next documentation sync

3. Monitor HTTP mode in staging
   - Watch for file descriptor exhaustion (lsof count)
   - Watch for request latency (per-request initialization overhead minimal but non-zero)
   - Owner: devops/monitoring
   - Timeline: Continuous once deployed

4. Consider connection pooling if per-request overhead becomes measurable
   - Not needed yet; per-request McpServer is lightweight
   - Future optimization if profiling shows >5ms overhead
   - Owner: performance engineering
   - Timeline: Post-launch if needed

**Unresolved questions:**
- Does DNS rebinding protection list need "localhost:port" variants? (Currently just "localhost", "127.0.0.1")
- Should health endpoint return version info for client verification?
