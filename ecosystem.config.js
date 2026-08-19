const path = require("node:path");
const root = path.join(__dirname);

/** PM2 config tuned for 4GB RAM EC2 (MySQL ~512MB + platform ~900MB + tracking ~280MB). */
module.exports = {
  apps: [
    {
      name: "cpl-tracking",
      script: "node_modules/next/dist/bin/next",
      args: "start --port 3001",
      cwd: path.join(root, "apps/tracking"),
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "320M",
      node_args: "--max-old-space-size=224",
      env: { NODE_ENV: "production", PORT: 3001 },
    },
    {
      name: "cpl-platform",
      script: "node_modules/next/dist/bin/next",
      args: "start --port 3000",
      cwd: path.join(root, "apps/platform"),
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1024M",
      node_args: "--max-old-space-size=640",
      env: { NODE_ENV: "production", PORT: 3000 },
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
