/**
 * HTTP client for reading building websites politely: identifies itself,
 * honors robots.txt, waits between requests to the same host, and retries
 * transient failures.
 */
import { isAllowed, parseRobots, type RobotsRules } from "./robots";

export const USER_AGENT = "cmu-apartment-rankings/1.0 (+https://github.com/jiaweil6/cmu-apartment)";

export class RobotsDisallowedError extends Error {
  constructor(url: string) {
    super(`robots.txt disallows ${url}`);
  }
}

export interface Http {
  text(url: string, init?: { accept?: string }): Promise<string>;
  json<T = unknown>(url: string): Promise<T>;
}

export function createHttp(options: { minIntervalMs?: number; retries?: number } = {}): Http {
  const { minIntervalMs = 1000, retries = 2 } = options;
  const robots = new Map<string, Promise<RobotsRules>>();
  const lastRequest = new Map<string, number>();

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  async function throttle(host: string) {
    const wait = (lastRequest.get(host) ?? 0) + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest.set(host, Date.now());
  }

  function rulesFor(origin: string): Promise<RobotsRules> {
    if (!robots.has(origin)) {
      robots.set(
        origin,
        fetch(`${origin}/robots.txt`, { headers: { "User-Agent": USER_AGENT } })
          .then(async (response) => (response.ok ? parseRobots(await response.text()) : { allow: [], disallow: [] }))
          .catch(() => ({ allow: [], disallow: [] })),
      );
    }
    return robots.get(origin)!;
  }

  async function get(url: string, accept: string): Promise<Response> {
    const { origin, host } = new URL(url);
    if (!isAllowed(await rulesFor(origin), url)) throw new RobotsDisallowedError(url);
    for (let attempt = 0; ; attempt++) {
      await throttle(host);
      try {
        const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: accept } });
        if (response.ok) return response;
        if (response.status < 500 || attempt >= retries) throw new Error(`${url} responded ${response.status}`);
      } catch (error) {
        if (attempt >= retries || (error instanceof Error && / responded 4\d\d$/.test(error.message))) throw error;
      }
      await sleep(2000 * (attempt + 1));
    }
  }

  return {
    async text(url, init) {
      return (await get(url, init?.accept ?? "text/html,application/xhtml+xml")).text();
    },
    async json<T>(url: string) {
      return (await (await get(url, "application/json")).json()) as T;
    },
  };
}
