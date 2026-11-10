import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryOverpass } from "./osm";

const servers = ["https://main.example/api/interpreter", "https://mirror.example/api/interpreter"];
const ok = () => Response.json({ elements: [] });
const status = (code: number) => new Response("busy", { status: code });

describe("queryOverpass", () => {
  let sleep: ReturnType<typeof vi.fn<(ms: number) => Promise<void>>>;

  beforeEach(() => {
    sleep = vi.fn(async () => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const hosts = (fetchMock: ReturnType<typeof vi.fn>) =>
    fetchMock.mock.calls.map(([url]) => new URL(url as string).hostname);

  it("retries a busy server with doubling waits", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(status(502)).mockResolvedValueOnce(status(429)).mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", fetchMock);
    expect(await queryOverpass("q", { servers, sleep, baseDelayMs: 1000 })).toEqual({ elements: [] });
    expect(hosts(fetchMock)).toEqual(["main.example", "main.example", "main.example"]);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000]);
  });

  it("falls back to a mirror when the main server stays busy", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(status(502))
      .mockResolvedValueOnce(status(503))
      .mockResolvedValueOnce(status(504))
      .mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", fetchMock);
    expect(await queryOverpass("q", { servers, sleep })).toEqual({ elements: [] });
    expect(hosts(fetchMock)).toEqual(["main.example", "main.example", "main.example", "mirror.example"]);
  });

  it("treats network errors and timeouts like a busy server", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("The operation was aborted due to timeout")).mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", fetchMock);
    expect(await queryOverpass("q", { servers, sleep, attemptsPerServer: 1 })).toEqual({ elements: [] });
    expect(hosts(fetchMock)).toEqual(["main.example", "mirror.example"]);
  });

  it("fails at once when the query itself is rejected", async () => {
    const fetchMock = vi.fn().mockResolvedValue(status(400));
    vi.stubGlobal("fetch", fetchMock);
    await expect(queryOverpass("q", { servers, sleep })).rejects.toThrow("Overpass (main.example) responded 400");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("names every server when none answers", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => status(502)));
    await expect(queryOverpass("q", { servers, sleep, attemptsPerServer: 2 })).rejects.toThrow(
      "No Overpass server answered: main.example responded 502; mirror.example responded 502",
    );
  });

  it("sends the query with a User-Agent and a time limit", async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal("fetch", fetchMock);
    await queryOverpass("[out:json];node(1);out;", { servers, sleep });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URLSearchParams(init.body as URLSearchParams).get("data")).toBe("[out:json];node(1);out;");
    expect((init.headers as Record<string, string>)["User-Agent"]).toMatch(/^cmu-apartment-rankings/);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
