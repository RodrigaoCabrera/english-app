import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { authMock, gradeWordMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  gradeWordMock: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("@/services/srs", () => ({ gradeWord: gradeWordMock }));

import { POST } from "@/app/api/srs/review/route";

function req(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

describe("POST /api/srs/review", () => {
  beforeEach(() => {
    authMock.mockReset();
    gradeWordMock.mockReset();
  });

  it("returns 401 when signed out", async () => {
    authMock.mockResolvedValue({ userId: null });
    const res = await POST(req({ word: "house", grade: "good" }));
    expect(res.status).toBe(401);
    expect(gradeWordMock).not.toHaveBeenCalled();
  });

  it("returns 400 on an invalid grade", async () => {
    authMock.mockResolvedValue({ userId: "u1" });
    const res = await POST(req({ word: "house", grade: "perfect" }));
    expect(res.status).toBe(400);
    expect(gradeWordMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the word is not in the user's queue", async () => {
    authMock.mockResolvedValue({ userId: "u1" });
    gradeWordMock.mockResolvedValue(false);
    const res = await POST(req({ word: "ghost", grade: "good" }));
    expect(res.status).toBe(404);
  });

  it("grades the word and returns 200", async () => {
    authMock.mockResolvedValue({ userId: "u1" });
    gradeWordMock.mockResolvedValue(true);
    const res = await POST(req({ word: "House", grade: "good" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    // word is normalized to lowercase before hitting the service
    expect(gradeWordMock).toHaveBeenCalledWith("u1", "house", "good");
  });
});
