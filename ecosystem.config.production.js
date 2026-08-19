const path = require("node:path");
const root = path.join(__dirname);

/** Production PM2 — uses Next.js standalone server.js (no next build on server). */
module.exports = {
  apps: [
    {
      name: "cpl-tracking",
      script: "server.js",
      cwd: path.join(root, "apps/tracking/.next/standalone/apps/tracking"),
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "384M",
      node_args: "--max-old-space-size=256",
      env: { NODE_ENV: "production", PORT: 3001, HOSTNAME: "0.0.0.0" },
    },
    {
      name: "cpl-platform",
      script: "server.js",
      cwd: path.join(root, "apps/platform/.next/standalone/apps/platform"),
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1200M",
      node_args: "--max-old-space-size=768",
      env: { NODE_ENV: "production", PORT: 3000, HOSTNAME: "0.0.0.0" },
    },
    {
      name: "cpl-email-worker",
      script: "src/workers/email.worker.ts",
      interpreter: "node",
      interpreter_args: "--import tsx",
      cwd: path.join(root, "apps/platform"),
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "256M",
      node_args: "--max-old-space-size=192",
      env: { NODE_ENV: "production" },
    },
  ],
};
