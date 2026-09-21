import { Router } from "express";

/**
 * Mock API routes for testing purposes.
 */
const TRUST: Record<string, unknown> = {
  USR001: {
    userId: "USR001",
    trustId: "FID001",
    status: "ACTIVE",
    balance: 12_000_000,
    currency: "COP",
    openedAt: "2026-08-15",
  },
  USR002: {
    userId: "USR002",
    trustId: "FID002",
    status: "ACTIVE",
    balance: 8_500_000,
    currency: "COP",
    openedAt: "2027-01-10",
  },
};

export const mockRoutes = Router();

mockRoutes.get("/trust/:userId", (req, res) => {
  const { userId } = req.params;
  const trust = TRUST[userId];

  console.log(`[mock] GET /mock/trusts/${userId} -> ${trust ? "200" : "404"}`);

  if (!trust) {
    res
      .status(404)
      .json({ error: `Sin fideicomiso para el usuario ${userId}` });
    return;
  }
  res.json(trust);
});
