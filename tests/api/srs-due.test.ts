import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { authMock, getDueWordsMock, getDueCountMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getDueWordsMock: vi.fn(),
  getDueCountMock: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("@/services/srs", () => ({
  getDueWords: getDueWordsMock,
  getDueCount: getDueCountMock,
}));

import { GET } from "@/app/api/srs/due/route";

function req(url: string): NextRequest {
  return { url } as unknown as NextRequest;
}

describe("GET /api/srs/due", () => {
  beforeEach(() => {
    authMock.mockReset();
    getDueWordsMock.mockReset();
    getDueCountMock.mockReset();
  });

  it("returns 401 when signed out", async () => {
    authMock.mockResolvedValue({ userId: null });
    const res = await GET(req("http://localhost/api/srs/due"));
    expect(res.status).toBe(401);
    expect(getDueWordsMock).not.toHaveBeenCalled();
  });

  it("returns 400 on an out-of-range limit", async () => {
    authMock.mockResolvedValue({ userId: "u1" });
    const res = await GET(req("http://localhost/api/srs/due?limit=9999"));
    expect(res.status).toBe(400);
  });

  it("returns the due count and words", async () => {
    authMock.mockResolvedValue({ userId: "u1" });
    const words = [{ word: "house", level: "B1", dueDate: new Date(), definition: "a building", translation: "casa", imageHash: null }];
    getDueWordsMock.mockResolvedValue(words);
    getDueCountMock.mockResolvedValue(1);

    const res = await GET(req("http://localhost/api/srs/due?limit=20"));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.dueCount).toBe(1);
    expect(json.data.words).toHaveLength(1);
    // The route shares one `now` snapshot between getDueWords and getDueCount.
    expect(getDueWordsMock).toHaveBeenCalledWith("u1", 20, expect.any(Date));
    const sharedNow = getDueWordsMock.mock.calls[0][2];
    expect(getDueCountMock).toHaveBeenCalledWith("u1", sharedNow);
  });
});
