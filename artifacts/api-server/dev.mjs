import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { context as esbuildContext } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(artifactDir, "dist");

/** @type {import("node:child_process").ChildProcess | null} */
let serverProcess = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let restartTimer = null;
let isInitialBuild = true;

function startServerProcess() {
  serverProcess = spawn(
    "node",
    ["--enable-source-maps", path.join(distDir, "index.mjs")],
    { stdio: "inherit", env: process.env },
  );

  serverProcess.on("exit", (code, signal) => {
    if (signal !== "SIGTERM" && code !== 0 && code !== null) {
      process.exit(code);
    }
  });
}

function scheduleRestart() {
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    void restartServer();
  }, 400);
}

async function restartServer() {
  console.log("[dev] Restarting API server after rebuild…");

  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
    // Give the old process a moment to release port 8080.
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  startServerProcess();
}

function getBuildOptions() {
  return {
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
      "connect-pg-simple",
      "express-session",
    ],
    sourcemap: "linked",
    plugins: [
      esbuildPluginPino({ transports: ["pino-pretty"] }),
      {
        name: "restart-server",
        setup(build) {
          build.onEnd((result) => {
            if (result.errors.length === 0) {
              if (isInitialBuild) {
                isInitialBuild = false;
                startServerProcess();
              } else {
                scheduleRestart();
              }
            }
          });
        },
      },
    ],
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  };
}

async function main() {
  await rm(distDir, { recursive: true, force: true });

  const ctx = await esbuildContext(getBuildOptions());
  await ctx.rebuild();
  await ctx.watch();
  console.log("Watching API server source…");

  const shutdown = () => {
    if (serverProcess) serverProcess.kill("SIGTERM");
    void ctx.dispose().finally(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
