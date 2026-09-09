import { PrismaClient } from "@prisma/client";

// Shared file. An identical copy lives in bakery-admin/lib/db.ts.
// Next.js hot-reloads modules in dev, so cache the client on globalThis to
// avoid opening a new database connection on every reload.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
