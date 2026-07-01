import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      currentUser?: User;
    }
  }
}

/**
 * Loads the current user (if any) onto `req.currentUser` based on the
 * session. Does not reject unauthenticated requests — use `requireAuth`
 * or `requireAdmin` on routes that need to enforce it.
 */
export async function attachCurrentUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.session.userId;
  if (!userId) {
    next();
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (user) {
    req.currentUser = user;
  } else {
    // Session points at a user that no longer exists — clear it.
    req.session.userId = undefined;
  }

  next();
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.currentUser) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  next();
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.currentUser) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  if (!req.currentUser.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
