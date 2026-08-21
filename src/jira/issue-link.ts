// ─────────────────────────────────────────────
// issue-link.ts
//
// Helper tạo hyperlink tới Jira issue.
// Dùng chung bởi formatter.ts và các tool để
// mọi output có issue key đều click được — user
// mở nhanh issue thay vì phải tự đoán URL.
// ─────────────────────────────────────────────

/**
 * Ghép URL browse tới 1 issue trên Jira Server/DC.
 * Normalize trailing slash của baseUrl để tránh `//browse`
 * (env đôi khi có dấu `/` cuối → link hỏng với vài proxy).
 * VD: browseUrl("https://jira.co/", "PROJ-1") → "https://jira.co/browse/PROJ-1"
 */
export function browseUrl(baseUrl: string, issueKey: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/browse/${issueKey}`;
}

/**
 * Tạo Markdown hyperlink `[KEY](url)` cho 1 issue key.
 * Text hiển thị giữ nguyên key thô → AI vẫn parse được
 * key cho tool-chaining, đồng thời user click mở nhanh.
 */
export function issueLink(baseUrl: string, issueKey: string): string {
  return `[${issueKey}](${browseUrl(baseUrl, issueKey)})`;
}
