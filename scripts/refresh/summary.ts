import type { TransitResult } from "./transit";

/** Relative change worth a human look before merging. */
const REVIEW_THRESHOLD = 0.5;

const show = (value: number | undefined, unit: string) => (value === undefined ? "—" : `${value} ${unit}`);

function changed(before: number | undefined, after: number | undefined): boolean {
  if (after === undefined) return false;
  return before === undefined || before !== after;
}

function bigChange(before: number | undefined, after: number | undefined): boolean {
  return before !== undefined && after !== undefined && Math.abs(after - before) / before > REVIEW_THRESHOLD;
}

/** Markdown summary for the workflow run and the pull request. */
export function transitSummary(results: TransitResult[], context: { serviceDate: string; source: string }): {
  markdown: string;
  needsReview: boolean;
} {
  const rows = results.filter(
    (r) =>
      r.error ||
      changed(r.commuteMinutes.before, r.commuteMinutes.after) ||
      changed(r.walkMiles.before, r.walkMiles.after),
  );
  const flagged = results.filter(
    (r) => bigChange(r.commuteMinutes.before, r.commuteMinutes.after) || bigChange(r.walkMiles.before, r.walkMiles.after),
  );
  const failed = results.filter((r) => r.error);

  const lines = [
    "## Transit refresh",
    "",
    `Commute: median door-to-door time arriving by 8:30, 9:00 and 9:30 AM on ${context.serviceDate}. Source: ${context.source}.`,
    "",
    `${results.length - failed.length} of ${results.length} apartments routed, ${rows.length - failed.length} changed, ${failed.length} failed.`,
  ];
  if (flagged.length) {
    lines.push("", `**Needs review:** ${flagged.length} apartment(s) changed by more than ${REVIEW_THRESHOLD * 100}%.`);
  }
  if (rows.length) {
    lines.push("", "| Apartment | Commute | Walk | Note |", "| --- | --- | --- | --- |");
    for (const r of rows) {
      const note = r.error ? `Failed: ${r.error}` : flagged.includes(r) ? "Large change" : "";
      lines.push(
        `| ${r.name} | ${show(r.commuteMinutes.before, "min")} → ${show(r.commuteMinutes.after, "min")} | ` +
          `${show(r.walkMiles.before, "mi")} → ${show(r.walkMiles.after, "mi")} | ${note} |`,
      );
    }
  }
  return { markdown: lines.join("\n") + "\n", needsReview: flagged.length > 0 || failed.length > 0 };
}
