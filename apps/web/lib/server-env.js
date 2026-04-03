import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import { logInfo, registerProcessHandlers } from "@/lib/logger";

const candidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../.env"),
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(process.cwd(), "../../../.env")
];

export const envPath = candidates.find((candidate) => fs.existsSync(candidate)) || null;
export const workspaceRoot = envPath ? path.dirname(envPath) : path.resolve(process.cwd());

if (envPath) {
  dotenv.config({ path: envPath });
}

registerProcessHandlers();

if (!globalThis.__mytelebotEnvLogged) {
  globalThis.__mytelebotEnvLogged = true;
  logInfo("server_env_loaded", {
    envPath,
    workspaceRoot
  });
}
