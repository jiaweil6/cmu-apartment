/**
 * Minimal robots.txt support: the Disallow/Allow rules that apply to every
 * crawler ("User-agent: *"). Longest matching rule wins, as in RFC 9309.
 */

export interface RobotsRules {
  allow: string[];
  disallow: string[];
}

export function parseRobots(text: string): RobotsRules {
  const rules: RobotsRules = { allow: [], disallow: [] };
  let applies = false;
  let inGroup = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "user-agent") {
      // Consecutive User-agent lines form one group.
      if (inGroup) applies = false;
      inGroup = false;
      if (value === "*") applies = true;
    } else {
      inGroup = true;
      if (!applies || !value) continue;
      if (key === "disallow") rules.disallow.push(value);
      if (key === "allow") rules.allow.push(value);
    }
  }
  return rules;
}

/** Converts a robots.txt path pattern ("*" wildcard, "$" end anchor) to a RegExp. */
function patternToRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

export function isAllowed(rules: RobotsRules, url: string): boolean {
  const { pathname, search } = new URL(url);
  const target = pathname + search;
  const longest = (patterns: string[]) =>
    Math.max(-1, ...patterns.filter((p) => patternToRegExp(p).test(target)).map((p) => p.length));
  return longest(rules.allow) >= longest(rules.disallow);
}
