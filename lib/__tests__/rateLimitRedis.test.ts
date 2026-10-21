import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetUpstashLimiter,
  checkRateLimit,
  DEFAULT_LIMIT,
  DEFAULT_WINDOW_MS,
} from "@/lib/rateLimit";

const mocks = vi.hoisted(() => ({
  slidingWindow: vi.fn((limit: number, duration: string) => ({ limit, duration })),
  createdLimiters: [] as Array<{ limiter: { limit: number; duration: string } }>,
  identifiers: [] as string[],
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    constructor(options: { limiter: { limit: number; duration: string } }) {
      mocks.createdLimiters.push(options);
    }

    static slidingWindow = mocks.slidingWindow;

    async limit(identifier: string) {
      mocks.identifiers.push(identifier);
      const policy = mocks.createdLimiters.at(-1)!.limiter;
      return {
        success: true,
        limit: policy.limit,
        remaining: policy.limit - 1,
        reset: Date.now() + Number.parseInt(policy.duration, 10),
      };
    }
  },
}));

vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor() {}
  },
}));

describe("Redis rate-limit policies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createdLimiters.length = 0;
    mocks.identifiers.length = 0;
    __resetUpstashLimiter();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("configures and caches limiters by requested policy", async () => {
    const custom = await checkRateLimit("client", 3, 12_000);
    await checkRateLimit("client", 3, 12_000);
    const defaultPolicy = await checkRateLimit("client");

    expect(mocks.slidingWindow).toHaveBeenCalledTimes(2);
    expect(mocks.slidingWindow).toHaveBeenNthCalledWith(1, 3, "12000 ms");
    expect(mocks.slidingWindow).toHaveBeenNthCalledWith(
      2,
      DEFAULT_LIMIT,
      `${DEFAULT_WINDOW_MS} ms`
    );
    expect(custom).toMatchObject({ success: true, limit: 3, remaining: 2 });
    expect(defaultPolicy.limit).toBe(DEFAULT_LIMIT);
    expect(mocks.identifiers[0]).toBe("3:12000:client");
    expect(mocks.identifiers[2]).toBe(`${DEFAULT_LIMIT}:${DEFAULT_WINDOW_MS}:client`);
  });
});