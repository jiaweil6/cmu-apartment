import type { Candidate } from "@/lib/schemas";
import type { DiscoveryReport } from "./candidates";

const mapLink = ({ location }: Candidate) =>
  `[map](https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=18/${location.lat}/${location.lng})`;

/** Pull request body for a discovery run. */
export function discoverySummary(report: DiscoveryReport, pending: number): string {
  const lines = [
    "## Weekly apartment finds",
    "",
    `Checked ${report.buildings} apartment buildings near campus in Allegheny County's property records: ` +
      `${report.listed} already listed, ${report.existing} already in review, ${report.rejected} previously rejected, ` +
      `${report.excluded.length} excluded, **${report.added.length} new**` +
      (report.deferred ? ` (${report.deferred} more will be suggested in later weeks).` : "."),
  ];

  if (report.added.length) {
    lines.push(
      "",
      "| Building | Size | Distance | Commute | Name (OpenStreetMap) | Website | Note |",
      "| --- | --- | --- | --- | --- | --- | --- |",
    );
    for (const c of report.added) {
      const note = c.possibleDuplicateOf ? `Possibly listed as \`${c.possibleDuplicateOf}\`` : "";
      lines.push(
        `| ${c.address} (${c.neighborhood ?? "?"}) ${mapLink(c)} | ${c.size} | ${c.distanceMiles} mi | ` +
          `${c.commuteMinutes === null ? "—" : `${c.commuteMinutes} min`} | ${c.osm?.name ?? "—"} | ` +
          `${c.listing.website ? `[site](${c.listing.website})` : "—"} | ${note} |`,
      );
    }
  }

  lines.push(
    "",
    "### How to review",
    "",
    `There are ${pending} candidate(s) waiting in \`data/candidates.json\`. Edit them in this PR, then merge:`,
    "",
    "- **Approve:** set `\"decision\": \"approve\"` and fill in `listing`: `name`, `website`, `openToUndergrad` and the three",
    "  `amenities` are required; `phone`, `imageUrl`, `shortName` and `yearBuilt` are optional.",
    "- **Reject:** set `\"decision\": \"reject\"` and add a `rejectReason` (not student housing, condos, closed, ...). It won't be suggested again.",
    "- **Possible duplicate:** if it's an existing listing, add its parcel IDs to that listing in `data/apartments.json` and reject this one.",
    "- Leave a candidate `pending` to decide later.",
    "",
    "After merging, the promote workflow moves approved buildings into `data/apartments.json`; the next price and transit refreshes fill in their data.",
  );

  if (report.excluded.length) {
    lines.push("", "<details><summary>Excluded this run</summary>", "");
    for (const { address, reason } of report.excluded) lines.push(`- ${address}: ${reason}`);
    lines.push("", "</details>");
  }
  return lines.join("\n") + "\n";
}
