import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

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
