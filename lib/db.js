// PostgreSQL connection, shaped for serverless (Vercel) as well as local runs.
//
// A single pool is cached on globalThis so hot reloads in development and warm
// lambda invocations in production reuse it instead of opening new connections.

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const globalForPrisma = globalThis;

function connectionString() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add a PostgreSQL connection string to .env " +
      "(locally) or to the project's Environment Variables (on Vercel)."
    );
  }
  return url;
}

function makeClient() {
  const url = connectionString();
  const isLocal = /localhost|127\.0\.0\.1/.test(url);

  const pool = new Pool({
    connectionString: url,
    // Serverless functions are short-lived; a small pool avoids exhausting the
    // database's connection limit when many run at once.
    max: Number(process.env.DB_POOL_MAX || (process.env.VERCEL ? 1 : 5)),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    // Hosted Postgres (Neon, Supabase, Vercel Postgres) requires TLS.
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

const prisma = globalForPrisma.prisma || makeClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

module.exports = { prisma };
