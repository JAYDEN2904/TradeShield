import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { RequestHandler } from "express";

export function createSessionMiddleware(): RequestHandler {
  const sessionSecret = process.env["SESSION_SECRET"];
  if (!sessionSecret) {
    throw new Error(
      "SESSION_SECRET environment variable is required but was not provided.",
    );
  }

  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL environment variable is required but was not provided.",
    );
  }

  const PgSession = connectPgSimple(session);
  return session({
    store: new PgSession({
      conString: databaseUrl,
      createTableIfMissing: true,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  });
}
