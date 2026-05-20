import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import { config } from "./config";
import { prisma } from "./prisma";
import type { User } from "@prisma/client";

export function createOAuthClient() {
  return new OAuth2Client(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}

/**
 * Build OAuth client untuk seorang user, sekaligus me-refresh token jika
 * sudah expired dan menyimpannya kembali ke DB.
 */
export async function getUserOAuthClient(user: User) {
  if (!user.googleAccessToken) {
    throw new Error(`User ${user.email} belum punya access token Google`);
  }

  const client = createOAuthClient();
  client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken ?? undefined,
    expiry_date: user.googleTokenExpiry?.getTime(),
    scope: user.googleScopes ?? undefined,
  });

  // Auto-persist refreshed tokens
  client.on("tokens", async (tokens) => {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        googleAccessToken: tokens.access_token ?? user.googleAccessToken,
        googleRefreshToken: tokens.refresh_token ?? user.googleRefreshToken,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : user.googleTokenExpiry,
      },
    });
  });

  // Pastikan token segar
  if (!user.googleTokenExpiry || user.googleTokenExpiry.getTime() <= Date.now() + 30_000) {
    try {
      const { credentials } = await client.refreshAccessToken();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          googleAccessToken: credentials.access_token ?? user.googleAccessToken,
          googleRefreshToken: credentials.refresh_token ?? user.googleRefreshToken,
          googleTokenExpiry: credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : user.googleTokenExpiry,
        },
      });
    } catch (err) {
      throw new Error(`Gagal refresh token Google untuk ${user.email}: ${(err as Error).message}`);
    }
  }

  return client;
}

export function gmailFor(client: OAuth2Client) {
  return google.gmail({ version: "v1", auth: client });
}

export function calendarFor(client: OAuth2Client) {
  return google.calendar({ version: "v3", auth: client });
}
