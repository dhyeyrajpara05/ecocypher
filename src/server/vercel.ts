/** Entry for the Vercel functions in /api. Bundled into api/_lib/server.mjs by `npm run build:api`. */
import { nodeHandler } from "./http";
import { kvFromEnv, type KV } from "./kv";

declare const process: { env: Record<string, string | undefined> };
let kv: KV | null = null;
export default nodeHandler(() => (kv ??= kvFromEnv(process.env)));
