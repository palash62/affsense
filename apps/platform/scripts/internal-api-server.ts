/**
 * Lightweight platform server for 4GB RAM when full Next.js UI cannot build/start.
 * Provides login, internal lead API, and health checks.
 */
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(import.meta.dirname, "../.env") });

import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { submitLead } from "../src/services/lead.service";
import { leadSubmitSchema } from "../src/lib/validations";
import { getInternalServiceToken } from "@cpl/shared";
import { getDashboardPath, ROLE_ROUTES } from "../src/lib/auth.config";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

const PORT = Number(process.env.INTERNAL_API_PORT ?? process.env.PORT ?? 3000);
const HOST = process.env.INTERNAL_API_HOST ?? "0.0.0.0";
const TRACKING_URL = process.env.NEXT_PUBLIC_TRACKING_URL ?? "https://track.leadtb.com";
const SESSION_COOKIE = "cpl-lite-session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

type SessionUser = { id: string; email: string; name: string; role: UserRole };

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) throw new Error("AUTH_SECRET is not configured");
  return secret;
}

function signSession(user: SessionUser): string {
  const payload = Buffer.from(
    JSON.stringify({ ...user, exp: Date.now() + SESSION_TTL_MS }),
  ).toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function parseSession(cookieHeader?: string): SessionUser | null {
  const match = cookieHeader?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;
  const [payload, sig] = decodeURIComponent(match[1]).split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionUser & { exp: number };
  if (!data.exp || data.exp < Date.now()) return null;
  return { id: data.id, email: data.email, name: data.name, role: data.role };
}

function parseBody(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of raw.split("&")) {
    const [k, v] = part.split("=");
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
  }
  return out;
}

async function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString();
}

function htmlPage(title: string, body: string, extra = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; color: #e2e8f0; padding: 1rem; }
    .card { width: 100%; max-width: 28rem; padding: 2rem; background: #1e293b; border-radius: 12px; border: 1px solid #334155; }
    h1 { margin: 0 0 0.25rem; font-size: 1.5rem; }
    .sub { margin: 0 0 1.5rem; color: #94a3b8; font-size: 0.95rem; }
    label { display: block; margin-bottom: 0.35rem; font-size: 0.875rem; color: #cbd5e1; }
    input { width: 100%; padding: 0.65rem 0.75rem; margin-bottom: 1rem; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f1f5f9; }
    button, .btn { display: inline-block; width: 100%; padding: 0.7rem 1rem; border: none; border-radius: 8px; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; text-align: center; text-decoration: none; }
    button:hover, .btn:hover { background: #1d4ed8; }
    .err { background: #450a0a; color: #fecaca; padding: 0.65rem 0.75rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.875rem; }
    .note { margin-top: 1rem; padding: 0.75rem; border-radius: 8px; background: #172554; color: #93c5fd; font-size: 0.8rem; line-height: 1.4; }
    a { color: #38bdf8; }
    ul { margin: 0.75rem 0 0; padding-left: 1.25rem; color: #cbd5e1; }
    .badge { display: inline-block; margin-bottom: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 999px; background: #713f12; color: #fde68a; font-size: 0.75rem; font-weight: 600; }
  </style>${extra}
</head>
<body><div class="card">${body}</div></body></html>`;
}

function loginHtml(error?: string) {
  return htmlPage(
    "Sign in — LeadVix",
    `${error ? `<div class="err">${error}</div>` : ""}
     <h1>Welcome back</h1>
     <p class="sub">Sign in to your LeadVix account</p>
     <form method="POST" action="/login">
       <label for="email">Email</label>
       <input id="email" name="email" type="email" required placeholder="admin@cpl.local"/>
       <label for="password">Password</label>
       <input id="password" name="password" type="password" required placeholder="••••••••"/>
       <button type="submit">Sign in</button>
     </form>
     <div class="note">Lite mode: full admin dashboards need a production build (8GB+ RAM). Lead capture and API are fully operational.</div>`,
  );
}

function dashboardHtml(user: SessionUser) {
  const dash = ROLE_ROUTES[user.role];
  return htmlPage(
    "Dashboard — LeadVix",
    `<span class="badge">Lite mode</span>
     <h1>Hello, ${user.name}</h1>
     <p class="sub">Signed in as ${user.email} (${user.role})</p>
     <p>Your dashboard path: <strong>${dash}</strong> — available after full platform build.</p>
     <ul>
       <li><a href="${TRACKING_URL}/t/demo-link">Demo lead form</a></li>
       <li><a href="/health">API health</a></li>
     </ul>
     <form method="POST" action="/logout" style="margin-top:1.5rem"><button type="submit">Sign out</button></form>`,
  );
}

function sendJson(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function redirect(res: import("node:http").ServerResponse, location: string, cookie?: string) {
  const headers: Record<string, string | string[]> = { Location: location };
  if (cookie) headers["Set-Cookie"] = cookie;
  res.writeHead(302, headers);
  res.end();
}

async function authenticate(email: string, password: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || user.status !== "ACTIVE") return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

const server = createServer(async (req, res) => {
  const url = req.url?.split("?")[0] ?? "/";
  const session = parseSession(req.headers.cookie);

  if (req.method === "GET" && url === "/health") {
    sendJson(res, 200, { ok: true, mode: "lite", service: "platform" });
    return;
  }

  if (req.method === "GET" && url === "/login") {
    if (session) {
      redirect(res, getDashboardPath(session.role));
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(loginHtml());
    return;
  }

  if (req.method === "POST" && url === "/login") {
    try {
      const body = parseBody(await readBody(req));
      const user = await authenticate(body.email ?? "", body.password ?? "");
      if (!user) {
        res.writeHead(401, { "Content-Type": "text/html; charset=utf-8" });
        res.end(loginHtml("Invalid email or password"));
        return;
      }
      const token = signSession(user);
      redirect(res, getDashboardPath(user.role), `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`);
    } catch {
      res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
      res.end(loginHtml("Something went wrong. Try again."));
    }
    return;
  }

  if (req.method === "POST" && url === "/logout") {
    redirect(res, "/login", `${SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0`);
    return;
  }

  if (req.method === "GET" && (url === "/" || url === "/dashboard")) {
    if (!session) {
      redirect(res, "/login");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(dashboardHtml(session));
    return;
  }

  if (req.method === "GET" && (url.startsWith("/admin") || url.startsWith("/advertiser") || url.startsWith("/publisher"))) {
    if (!session) {
      redirect(res, "/login");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(dashboardHtml(session));
    return;
  }

  if (req.method === "POST" && url === "/api/internal/v1/leads/submit") {
    const token = getInternalServiceToken();
    if (!token || req.headers["x-service-token"] !== token) {
      sendJson(res, 401, { error: { code: "UNAUTHORIZED" } });
      return;
    }
    try {
      const body = JSON.parse(await readBody(req));
      const parsed = leadSubmitSchema.safeParse(body);
      if (!parsed.success) {
        sendJson(res, 422, { error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
        return;
      }
      const ip = String(req.headers["x-forwarded-for"] ?? "127.0.0.1").split(",")[0].trim();
      const lead = await submitLead({
        slug: parsed.data.slug,
        data: parsed.data.data,
        honeypot: parsed.data.honeypot,
        ip,
        source: parsed.data.source,
        subId: parsed.data.subId,
        deviceFingerprint: parsed.data.deviceFingerprint,
        submissionMeta: parsed.data.submissionMeta,
      });
      sendJson(res, 201, { lead: { id: lead.id, status: lead.status } });
    } catch (error) {
      sendJson(res, 500, {
        error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Error" },
      });
    }
    return;
  }

  sendJson(res, 404, { error: { code: "NOT_FOUND", message: "Route not available in lite mode" } });
});

server.listen(PORT, HOST, () => {
  console.log(`Platform lite server listening on http://${HOST}:${PORT}`);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  server.close();
});
