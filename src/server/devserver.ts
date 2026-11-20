/** Local stand-in for Vercel: `npm run api:dev` serves /api on port 8787 with an in-memory database. */
import { createServer } from "node:http";
import { handle } from "./http";
import { MemoryKV } from "./kv";

const kv = new MemoryKV();
const env = { SESSION_SECRET: "local-dev-secret-not-for-production", SEED: process.env.SEED ?? "demo", ADMIN_PASSWORD: process.env.ADMIN_PASSWORD };
createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const url = new URL(req.url ?? "/", "http://localhost");
  const out = await handle(kv, env, { method: req.method ?? "GET", path: url.pathname, query: url.searchParams, auth: req.headers.authorization ?? null, body });
  res.writeHead(out.status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(out.body === undefined ? "" : JSON.stringify(out.body));
}).listen(8787, () => console.log("EcoCypher API on http://localhost:8787 (in-memory, demo data)"));
