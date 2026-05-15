// ─────────────────────────────────────────────
// buildQuickDriftWarning
//
// Lightweight drift check chạy inline trong
// get_issue_detail — không gọi Claude API,
// chỉ dùng heuristics nhanh để tạo warning.
// Full analysis → dùng check_description_drift
// ─────────────────────────────────────────────

const QUICK_CHANGE_KEYWORDS = [
  "thay đổi", "đổi lại", "sửa lại", "changed", "updated",
  "actually", "instead", "remove", "drop", "cancel",
  "không làm", "bỏ đi", "thay vì", "out of scope",
];

interface IssueForDrift {
  fields: {
    created: string;
    updated: string;
    comment?: {
      comments: Array<{ body: string; created: string; author: { displayName: string } }>;
    };
  };
}

export function buildQuickDriftWarning(issue: IssueForDrift): string {
  const fields = issue.fields;
  const now = new Date();
  const createdDate = new Date(fields.created);
  const updatedDate = new Date(fields.updated);

  const ageInDays = Math.floor(
    (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysSinceUpdate = Math.floor(
    (now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const comments = fields.comment?.comments ?? [];
  const commentsAfterUpdate = comments.filter(
    (c) => new Date(c.created) > updatedDate
  );

  const changeSignalCount = comments.filter((c) =>
    QUICK_CHANGE_KEYWORDS.some((kw) => c.body.toLowerCase().includes(kw))
  ).length;

  // Tính quick drift score
  let score = 0;
  if (ageInDays > 14)                                    score += 20;
  if (daysSinceUpdate > 14 && commentsAfterUpdate.length > 0) score += 25;
  if (commentsAfterUpdate.length > 2)                    score += 20;
  if (changeSignalCount > 0)                             score += 35;

  // Chỉ hiện warning nếu score đủ cao
  if (score < 40) return "";

  const level = score >= 70 ? "🔴 CAO" : "🟡 TRUNG BÌNH";
  const lines = [
    `> ⚠️ **DRIFT WARNING — Mức độ: ${level}**`,
    `> Task này **${ageInDays} ngày tuổi**, description cập nhật **${daysSinceUpdate} ngày trước**.`,
  ];

  if (commentsAfterUpdate.length > 0) {
    lines.push(`> Có **${commentsAfterUpdate.length} comments** sau lần cập nhật description.`);
  }
  if (changeSignalCount > 0) {
    lines.push(`> Phát hiện **${changeSignalCount} comments** có dấu hiệu thay đổi requirement.`);
  }

  lines.push(
    `> 👉 Chạy \`extract_latest_requirements\` trước khi implement để đọc requirement thực tế.`,
    "",
    "---",
    ""
  );

  return lines.join("\n");
}
