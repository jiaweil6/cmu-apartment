/**
 * Developer tool: surveys each listing's website to decide how its prices can
 * be read. Run in GitHub Actions (the sandbox can't reach these sites):
 *
 *   npx playwright install --with-deps chromium && npm run inspect-sites
 *
 * Writes scripts/refresh/__fixtures__/sites/<id>/ (robots.txt, terms excerpts,
 * rent-like JSON responses, page snippets) and a summary in report.md there.
 * Visits each site's home page and at most three pricing pages, once.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { readListings } from "../lib/data-files";

const OUT = path.join(process.cwd(), "scripts/refresh/__fixtures__/sites");
const USER_AGENT_SUFFIX = "cmu-apartment-rankings (+https://github.com/jiaweil6/cmu-apartment)";
const NEVER_SCRAPE = /(^|\.)(apartments\.com|zillow\.com|craigslist\.org)$/;

const PLATFORMS: [string, RegExp][] = [
  ["RentCafe/Yardi", /rentcafe\.com|securecafe\.com|yardi/i],
  ["Entrata", /entrata\.com|prospectportal|entrata/i],
  ["SightMap/Engrain", /sightmap\.com|engrain/i],
  ["RealPage", /realpage\.com|onesite|g5marketingcloud|g5search/i],
  ["AppFolio", /appfolio/i],
  ["Knock", /knockrentals|knck\.io/i],
  ["RentManager", /rentmanager/i],
  ["Funnel", /funnelleasing|nestio/i],
  ["Buildium", /buildium/i],
  ["Zillow Rental Manager", /zillow\.com\/rental-manager|zillowstatic/i],
];

const RENT_JSON = /"(min_?rent|max_?rent|minimumrent|maximumrent|rent|price|marketrent|baseprice|startingprice|amount)"\s*:/i;
const PRICING_LINK = /floor\s*plans?|floorplans|pricing|availability|apartments|units|rates/i;
const TERMS_LINK = /terms|legal/i;
const SCRAPE_WORDS = /(scrap|crawl|spider|robot|automated|data mining|harvest|extract)/i;

interface SiteReport {
  id: string;
  website: string;
  skipped?: string;
  robots: { found: boolean; disallowsAll: boolean; disallowed: string[] };
  platforms: string[];
  pricingPages: string[];
  rentJson: { url: string; bytes: number; file: string; robots: string }[];
  priceSnippets: string[];
  terms: { url: string | null; scrapingSentences: string[] };
  error?: string;
}

/** Disallow rules for all user agents ("*"). */
function parseRobots(text: string): string[] {
  const rules: string[] = [];
  let applies = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (/^user-agent$/i.test(key)) applies = value === "*";
    else if (applies && /^disallow$/i.test(key) && value) rules.push(value);
  }
  return rules;
}

const robotsCache = new Map<string, string[] | null>();

/** Whether robots.txt on the URL's host lets us fetch it ("allowed", "disallowed", or "no robots.txt"). */
async function robotsVerdict(url: string): Promise<string> {
  const { origin } = new URL(url);
  if (!robotsCache.has(origin)) {
    const response = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": USER_AGENT_SUFFIX } }).catch(() => null);
    robotsCache.set(origin, response?.ok ? parseRobots(await response.text()) : null);
  }
  const rules = robotsCache.get(origin);
  if (!rules) return "no robots.txt";
  return allowed(url, rules) ? "allowed" : "disallowed";
}

const allowed = (url: string, disallowed: string[]) => {
  const { pathname } = new URL(url);
  return !disallowed.some((rule) => pathname.startsWith(rule.replace(/\*.*$/, "")));
};

/** Visible text lines mentioning a dollar amount and a room type. */
async function priceSnippets(page: Page): Promise<string[]> {
  const text = await page.evaluate(() => document.body?.innerText ?? "");
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => /\$\s?\d[\d,]{2,}/.test(line) && line.length < 200)
    .slice(0, 40);
}

/** Loads a page and gives scripts a few seconds; chat widgets keep "networkidle" from ever firing. */
async function visit(page: Page, url: string): Promise<string | null> {
  let warning: string | null = null;
  try {
    await page.goto(url, { waitUntil: "load", timeout: 45_000 });
  } catch (error) {
    warning = (error as Error).message.split("\n")[0];
  }
  await page.waitForTimeout(6_000);
  return warning;
}

/** Page HTML without scripts, styles and SVG, for writing HTML adapters. */
async function cleanHtml(page: Page): Promise<string> {
  const html = await page.content();
  return html
    .replace(/<(script|style|svg|noscript)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/\s+/g, " ")
    .slice(0, 300_000);
}

async function inspect(page: Page, id: string, website: string): Promise<SiteReport> {
  const dir = path.join(OUT, id);
  mkdirSync(dir, { recursive: true });
  const report: SiteReport = {
    id,
    website,
    robots: { found: false, disallowsAll: false, disallowed: [] },
    platforms: [],
    pricingPages: [],
    rentJson: [],
    priceSnippets: [],
    terms: { url: null, scrapingSentences: [] },
  };

  const origin = new URL(website).origin;
  const robots = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": USER_AGENT_SUFFIX } }).catch(() => null);
  if (robots?.ok) {
    const text = await robots.text();
    writeFileSync(path.join(dir, "robots.txt"), text);
    report.robots = { found: true, disallowed: parseRobots(text), disallowsAll: parseRobots(text).includes("/") };
  }
  if (report.robots.disallowsAll) {
    report.skipped = "robots.txt disallows all crawling";
    return report;
  }

  let jsonCount = 0;
  page.on("response", async (response) => {
    try {
      const type = response.headers()["content-type"] ?? "";
      if (!type.includes("json") || jsonCount >= 10) return;
      const body = await response.text();
      if (!RENT_JSON.test(body)) return;
      const file = `rent-${++jsonCount}.json`;
      // Whole responses (up to 1 MB) so they parse as test fixtures.
      if (body.length > 1_000_000) return;
      writeFileSync(path.join(dir, file), body);
      report.rentJson.push({ url: response.url(), bytes: body.length, file, robots: await robotsVerdict(response.url()) });
    } catch {
      // Responses that can't be read (redirects, aborted) are skipped.
    }
  });

  const homeWarning = await visit(page, website);
  if (homeWarning) report.error = `home page: ${homeWarning} (kept what loaded)`;
  const homeHtml = await page.content();
  writeFileSync(path.join(dir, "home.html"), await cleanHtml(page));
  const scriptSrcs = await page.$$eval("script[src], iframe[src]", (els) => els.map((el) => el.getAttribute("src") ?? ""));
  const haystack = homeHtml + "\n" + scriptSrcs.join("\n");
  report.platforms = PLATFORMS.filter(([, pattern]) => pattern.test(haystack)).map(([name]) => name);
  report.priceSnippets.push(...(await priceSnippets(page)));

  const links = await page.$$eval("a[href]", (as) =>
    as.map((a) => ({ href: (a as HTMLAnchorElement).href, text: (a.textContent ?? "").trim() })),
  );
  const sameSite = links.filter((l) => l.href.startsWith(origin));
  const pricing = [...new Set(sameSite.filter((l) => PRICING_LINK.test(l.text) || PRICING_LINK.test(l.href)).map((l) => l.href.split("#")[0]))]
    .filter((href) => allowed(href, report.robots.disallowed))
    .slice(0, 3);

  for (const [index, href] of pricing.entries()) {
    try {
      const warning = await visit(page, href);
      report.pricingPages.push(warning ? `${href} (${warning})` : href);
      const html = await page.content();
      writeFileSync(path.join(dir, `page-${index + 1}.html`), await cleanHtml(page));
      // Keep JSON-LD and embedded app state, which often carry prices; drop the rest of the markup.
      const embedded = [...html.matchAll(/<script[^>]*(?:ld\+json|__NEXT_DATA__|application\/json)[^>]*>([\s\S]*?)<\/script>/gi)]
        .map((m) => m[1])
        .filter((json) => RENT_JSON.test(json));
      if (embedded.length) writeFileSync(path.join(dir, `page-${index + 1}-embedded.json.txt`), embedded.join("\n\n").slice(0, 200_000));
      report.priceSnippets.push(...(await priceSnippets(page)));
    } catch (error) {
      report.pricingPages.push(`${href} (failed: ${(error as Error).message.split("\n")[0]})`);
    }
  }

  const terms = links.find((l) => TERMS_LINK.test(l.text) || /terms/i.test(l.href));
  if (terms) {
    report.terms.url = terms.href;
    try {
      await page.goto(terms.href, { waitUntil: "domcontentloaded", timeout: 60_000 });
      const text = await page.evaluate(() => document.body?.innerText ?? "");
      report.terms.scrapingSentences = text
        .split(/(?<=[.!?])\s+/)
        .filter((sentence) => SCRAPE_WORDS.test(sentence))
        .map((sentence) => sentence.trim().slice(0, 400))
        .slice(0, 10);
    } catch (error) {
      report.terms.scrapingSentences = [`(couldn't load terms: ${(error as Error).message.split("\n")[0]})`];
    }
  }

  report.priceSnippets = [...new Set(report.priceSnippets)].slice(0, 40);
  return report;
}

function markdown(reports: SiteReport[]): string {
  const lines = ["# Building website inventory", "", `Generated ${new Date().toISOString()}.`, ""];
  for (const r of reports) {
    lines.push(`## ${r.id}`, "", `- Website: ${r.website}`);
    if (r.skipped) lines.push(`- **Skipped:** ${r.skipped}`);
    if (r.error) lines.push(`- **Error:** ${r.error}`);
    lines.push(
      `- robots.txt: ${r.robots.found ? (r.robots.disallowed.length ? `disallows ${r.robots.disallowed.join(", ")}` : "allows all") : "none"}`,
      `- Platforms: ${r.platforms.join(", ") || "none detected"}`,
      `- Pricing pages: ${r.pricingPages.join(", ") || "none found"}`,
      `- Rent-like JSON: ${r.rentJson.map((j) => `${j.file} ← ${j.url} (${j.bytes} B, robots: ${j.robots})`).join("; ") || "none"}`,
      `- Terms: ${r.terms.url ?? "not found"}`,
    );
    for (const sentence of r.terms.scrapingSentences) lines.push(`  - > ${sentence.replace(/\s+/g, " ")}`);
    if (r.priceSnippets.length) {
      lines.push("- Price text:");
      for (const snippet of r.priceSnippets.slice(0, 15)) lines.push(`  - ${snippet.replace(/\|/g, "/")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  const { apartments } = readListings();
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  // The browser's own user agent (it says HeadlessChrome) plus who we are: no disguise.
  const probe = await browser.newPage();
  const userAgent = `${await probe.evaluate(() => navigator.userAgent)} ${USER_AGENT_SUFFIX}`;
  await probe.close();
  const reports: SiteReport[] = [];

  for (const { id, website } of apartments) {
    const host = new URL(website).hostname;
    if (NEVER_SCRAPE.test(host)) {
      reports.push({
        id,
        website,
        skipped: `${host} forbids scraping`,
        robots: { found: false, disallowsAll: false, disallowed: [] },
        platforms: [],
        pricingPages: [],
        rentJson: [],
        priceSnippets: [],
        terms: { url: null, scrapingSentences: [] },
      });
      continue;
    }
    const context = await browser.newContext({ userAgent });
    const page = await context.newPage();
    try {
      reports.push(await inspect(page, id, website));
    } catch (error) {
      reports.push({
        id,
        website,
        error: (error as Error).message.split("\n")[0],
        robots: { found: false, disallowsAll: false, disallowed: [] },
        platforms: [],
        pricingPages: [],
        rentJson: [],
        priceSnippets: [],
        terms: { url: null, scrapingSentences: [] },
      });
    }
    await context.close();
    console.log(`inspected ${id}`);
  }

  await browser.close();
  writeFileSync(path.join(OUT, "report.json"), JSON.stringify(reports, null, 2) + "\n");
  writeFileSync(path.join(OUT, "report.md"), markdown(reports));
  process.stdout.write(markdown(reports));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
