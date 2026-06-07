import type { GridCell, InsightWithLinks } from "@/types/grid"

type CsvMeeting = { id: string; title: string }
type CsvColumn = { id: string; question: string }

function reviewStateLabel(state: string): string {
  switch (state) {
    case "accepted": return "Accepted"
    case "rejected": return "Rejected"
    case "edited": return "Edited"
    default: return "Pending"
  }
}

// Strip newlines first (prevents injection via embedded newline), then prefix
// formula-injection chars (OWASP CSV defense), then escape internal quotes.
function sanitize(value: string): string {
  const cleaned = value.replace(/[\r\n]+/g, " ")
  return cleaned.replace(/^([=+\-@\t])/, "'$1").replace(/"/g, '""')
}

export function generateGridCsv(
  columns: CsvColumn[],
  meetings: CsvMeeting[],
  cells: GridCell[],
  insightsByCell: Map<string, InsightWithLinks[]>
): string {
  const rows: string[][] = [
    ["Meeting", "Question", "Insight text", "Review state", "Supporting quotes", "Confidence"],
  ]

  for (const meeting of meetings) {
    for (const column of columns) {
      const cell = cells.find(
        (c) => c.meetingId === meeting.id && c.columnId === column.id
      )
      if (!cell || cell.status === "no_evidence") {
        rows.push([meeting.title, column.question, "(no evidence)", "—", "0", "—"])
        continue
      }
      const insights = insightsByCell.get(cell.id) ?? []
      if (insights.length === 0) {
        rows.push([meeting.title, column.question, "(pending)", "—", "0", "—"])
        continue
      }
      for (const insight of insights) {
        const displayLabel = insight.editedLabel ?? insight.label
        rows.push([
          meeting.title,
          column.question,
          displayLabel,
          reviewStateLabel(insight.gridReviewState),
          String(insight.quotes.length),
          cell.confidence != null ? cell.confidence : "—",
        ])
      }
    }
  }

  return rows.map((row) => row.map((cell) => `"${sanitize(cell)}"`).join(",")).join("\n")
}
