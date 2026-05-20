import "dotenv/config";

const required = (key: string, fallback?: string) => {
  const v = process.env[key] ?? fallback;
  if (!v) throw new Error(`Env ${key} wajib di-set`);
  return v;
};

export const config = {
  env: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  appUrl: required("APP_URL", "http://localhost:5173"),
  apiUrl: required("API_URL", "http://localhost:4000"),
  jwtSecret: required("JWT_SECRET"),
  cookieName: process.env.SESSION_COOKIE_NAME ?? "tm_session",
  google: {
    clientId: required("GOOGLE_CLIENT_ID"),
    clientSecret: required("GOOGLE_CLIENT_SECRET"),
    redirectUri: required("GOOGLE_REDIRECT_URI"),
    scopes: (
      process.env.GOOGLE_SCOPES ??
      "openid email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.events"
    ).split(/\s+/),
  },
};
