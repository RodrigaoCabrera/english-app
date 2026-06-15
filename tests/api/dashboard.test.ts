import { describe, it, expect, vi, beforeEach } from "vitest";

const { authMock, serviceMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  serviceMock: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("@/services/dashboard", () => ({ getDashboardData: serviceMock }));

import { GET } from "@/app/api/dashboard/route";

describe("GET /api/dashboard", () => {
  beforeEach(() => {
    authMock.mockReset();
    serviceMock.mockReset();
  });

  it("returns 401 when signed out", async () => {
    authMock.mockResolvedValue({ userId: null });

    const res = await GET();

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(serviceMock).not.toHaveBeenCalled();
  });

  it("returns the dashboard data for the signed-in user", async () => {
    authMock.mockResolvedValue({ userId: "u1" });
    const fakeData = {
      stats: { readingsCount: 3, savedWordsCount: 10, avgAccuracyScore: 80 },
      pronunciationTrend: [],
      recentReadings: [],
    };
    serviceMock.mockResolvedValue(fakeData);

    const res = await GET();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toEqual(fakeData);
    expect(serviceMock).toHaveBeenCalledWith("u1");
  });
});
