import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDir, "../..");
const { loadEnvConfig } = nextEnv;

loadEnvConfig(workspaceRoot);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true
};

export default nextConfig;
