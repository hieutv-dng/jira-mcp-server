# Multi-Tenant HTTP Headers Authentication

**Date**: 2026-04-13 21:43
**Severity**: Medium
**Component**: Transport layer, authentication, JiraClient factory
**Status**: Resolved

## What Happened

Implemented per-request credential isolation for multi-tenant support. HTTP requests now extract `X-Jira-Base-Url` and `X-Jira-Pat` headers, creating isolated JiraClient instances per request. This enables a single HTTP endpoint to serve multiple Jira instances without credential leakage.

## The Brutal Truth

This was clean until we hit the lazy singleton trap. HTTP-only mode crashed on first request because the singleton pattern depended on stdio initialization order. The frustrating part: the code looked correct until runtime. Env var fallback saved us—when headers were missing, the singleton would initialize against env vars and crash if running in pure HTTP mode with no stdio bootstrap. It's the kind of bug that only surfaces in specific deployment scenarios, not during local development.

## Technical Details

**Factory function** (src/jira/client.ts):
```typescript
export function createJiraClient(config: JiraClientConfig): JiraClient {
  return new JiraClient(config.baseUrl, config.pat);
}
```

**Per-request isolation** (http-transport.ts):
```typescript
const jiraClient = createJiraClient({
  baseUrl: headers['x-jira-base-url'] || process.env.JIRA_BASE_URL,
  pat: headers['x-jira-pat'] || process.env.JIRA_PAT,
});
```

**Lazy singleton fix** (client.ts):
- Used Proxy pattern to wrap singleton initialization
- Singleton now only initializes if headers missing AND env vars present
- Prevents crash when running pure HTTP without stdio path initialization

**Backward compatibility**:
- Stdio mode unchanged: uses env vars, maintains singleton pattern
- Mixed mode works: falls back to env vars if headers absent
- No breaking changes to tool interface

## What We Tried

1. **Initial singleton reuse**: Each request used global singleton client
   - Why it failed: Multiple tenants would share credentials, major security issue
   - Fixed by: Creating factory + per-request instantiation

2. **No fallback to env vars**: Headers required, failed when missing
   - Why it failed: Broke backward compatibility with env-var-only deployments
   - Fixed by: Adding header/env var fallback chain

3. **Direct singleton initialization**: Crashed in HTTP-only mode
   - Why it failed: Singleton required stdio path to bootstrap properly
   - Fixed by: Proxy pattern with lazy initialization guard

## Root Cause Analysis

**Why singleton blocked HTTP-only mode:**
- Singleton initialization assumed both stdio and HTTP transports might run
- In HTTP-only deployment, singleton would try to initialize with undefined env vars
- Mental model: "Singleton protects us" — didn't account for initialization order dependency

**Why credential isolation was needed:**
- Original design: single JiraClient for all requests
- Multi-tenant requirement: each request needs its own Jira instance
- Previous approach would've leaked credentials between tenants

## Lessons Learned

1. **Factory pattern > singleton for multi-tenant**: Stateless factory functions beat singletons when serving multiple clients. Create per-request, destroy on cleanup.

2. **Lazy initialization with guards**: Singleton in multi-transport context requires careful guards. Proxy pattern prevents accidents better than manual checks.

3. **Fallback chains need testing**: Header → Env var fallback adds complexity. Test all three modes: headers-only, env-only, mixed.

4. **HTTP-only deployments expose initialization order bugs**: Stdio bootstrap masked issues that only surface without it. Test pure HTTP startup path separately.

## Next Steps

1. Add HTTP-only smoke test (pure HTTP startup without stdio)
   - Timeline: Next sprint
   - Success: Server starts, accepts authenticated request, isolates credentials

2. Add concurrent multi-tenant stress test (10 simultaneous different tenants)
   - Timeline: Before production deployment
   - Success: No credential leakage, isolated client instances verified

3. Document multi-tenant deployment in CLAUDE.md
   - Include header examples and fallback behavior
   - Owner: documentation
   - Timeline: Next docs sync

**Unresolved questions:**
- Should we warn when mixing header + env var authentication? (Privacy concern: headers visible in logs)
- Do we need request-scoped logging to tie errors to specific tenant?
