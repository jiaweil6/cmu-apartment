/**
 * Lists manually priced buildings whose prices haven't been checked in 60 days.
 *
 *   npm run manual-prices:check -- [--summary reminder.md]
 *
 * Writes `stale=<count>` to $GITHUB_OUTPUT; the reminder workflow turns the
 * summary into an issue.
 */
import { appendFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import type { Listings, ManualPrices } from "@/lib/schemas";
import { readListings, readManualPrices } from "../lib/data-files";

export const MAX_AGE_DAYS = 60;

export function staleManualPrices(listings: Listings, prices: ManualPrices, today: string) {
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - MAX_AGE_DAYS * 86_400_000).toISOString().slice(0, 10);
  return listings.apartments
    .filter((apt) => apt.pricing.adapter === "manual")
    .map((apt) => ({ apt, verifiedOn: prices[apt.id]?.verifiedOn ?? null }))
    .filter(({ verifiedOn }) => verifiedOn === null || verifiedOn < cutoff);
}

export function reminderMarkdown(stale: ReturnType<typeof staleManualPrices>): string {
  const lines = [
    `These buildings' prices are entered by hand and haven't been checked in over ${MAX_AGE_DAYS} days:`,
    "",
    "| Building | Last checked | Website |",
    "| --- | --- | --- |",
    ...stale.map(({ apt, verifiedOn }) => `| ${apt.name} | ${verifiedOn ?? "never"} | ${apt.website} |`),
    "",
    "To update one, edit its entry in `data/manual-prices.json`: set each room type's `status`",
    "(`available`, `waitlist`, `not-offered` or `unknown`) and `minPrice`, then set `verifiedOn` to today.",
    "This issue closes itself once every manual price is current.",
  ];
  return lines.join("\n") + "\n";
}

if (process.argv[1]?.endsWith("manual-reminder.ts")) {
  const { values: args } = parseArgs({ options: { summary: { type: "string" } } });
  const stale = staleManualPrices(readListings(), readManualPrices(), new Date().toISOString().slice(0, 10));
  const markdown = reminderMarkdown(stale);
  if (args.summary) writeFileSync(args.summary, markdown);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `stale=${stale.length}\n`);
  process.stdout.write(stale.length ? markdown : "All manual prices are current.\n");
}
