import { Router } from "express";
import { Role } from "@prisma/client";
import { createOAuthClient } from "../lib/google";
import { config } from "../lib/config";
import { prisma } from "../lib/prisma";
import { signSession } from "../lib/jwt";
import { requireAuth } from "../middleware/auth";

export const authRouter = Router();

/**
 * GET /api/auth/google
 * Redirect user ke halaman consent Google.
 */
authRouter.get("/google", (_req, res) => {
  const client = createOAuthClient();
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // pastikan kita selalu dapat refresh_token
    scope: config.google.scopes,
    include_granted_scopes: true,
  });
  res.redirect(url);
});

/**
 * GET /api/auth/google/callback
 * Tukar code dengan token, upsert user, set cookie sesi, redirect ke frontend.
 */
authRouter.get("/google/callback", async (req, res, next) => {
  try {
    const code = req.query.code as string | undefined;
    if (!code) return res.status(400).send("Missing code");

    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Ambil profil user
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: config.google.clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      return res.status(400).send("Profil Google tidak lengkap");
    }

    const isFirstUser = (await prisma.user.count()) === 0;

    const user = await prisma.user.upsert({
      where: { email: payload.email },
      update: {
        googleId: payload.sub,
        name: payload.name ?? payload.email,
        avatarUrl: payload.picture ?? null,
        googleAccessToken: tokens.access_token ?? null,
        googleRefreshToken: tokens.refresh_token ?? undefined,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        googleScopes: tokens.scope ?? null,
      },
      create: {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name ?? payload.email,
        avatarUrl: payload.picture ?? null,
        role: isFirstUser ? Role.ADMIN_PROJECT : Role.NETWORK_ENGINEER,
        googleAccessToken: tokens.access_token ?? null,
        googleRefreshToken: tokens.refresh_token ?? null,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        googleScopes: tokens.scope ?? null,
      },
    });

    const jwtToken = signSession({ uid: user.id, email: user.email, role: user.role });
    res.cookie(config.cookieName, jwtToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.env === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(config.appUrl);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 */
authRouter.post("/logout", (_req, res) => {
  res.clearCookie(config.cookieName);
  res.json({ ok: true });
});

/**
 * GET /api/auth/me
 */
authRouter.get("/me", requireAuth, (req, res) => {
  const u = req.user!;
  res.json({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    avatarUrl: u.avatarUrl,
    hasGoogleConnection: Boolean(u.googleRefreshToken),
  });
});
