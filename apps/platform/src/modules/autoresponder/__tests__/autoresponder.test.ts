import http from "node:http";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { autoresponderConnectionSchema } from "@/lib/validations";
import { encryptSecret, decryptSecret, maskConfigForApi } from "@/modules/autoresponder/lib/encrypt-secrets";
import { renderWebhookBody } from "@/modules/autoresponder/lib/render-webhook-body";
import { buildAutoresponderTestEmail } from "@/modules/autoresponder/lib/test-email";
import { buildLeadPayload } from "@/modules/autoresponder/mapping/build-payload";
import { sendWebhook } from "@/modules/autoresponder/providers/webhook.provider";
import { buildSystemeTestEmail, sendSysteme, verifySystemeConfig } from "@/modules/autoresponder/providers/systeme.provider";

const samplePayload = {
  event: "lead.captured" as const,
  leadId: "lead_1",
  email: "jane@example.com",
  firstName: "Jane",
  lastName: "Doe",
  phone: "+15551212",
  campaign: { id: "c1", name: "Demo" },
  publisher: { id: "p1" },
  source: "facebook",
  subId: "sub-1",
  submittedAt: "2026-06-30T12:00:00.000Z",
};

describe("renderWebhookBody", () => {
  it("returns default CPL JSON when template is empty", () => {
    const result = renderWebhookBody("", samplePayload);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.parse(result.body)).toEqual(samplePayload);
  });

  it("renders placeholders into a custom JSON shape", () => {
    const result = renderWebhookBody(
      `{
        "formName": "My Opt-in Form",
        "contact": {
          "email": "{{email}}",
          "firstName": "{{firstName}}",
          "lastName": "{{lastName}}",
          "phone": "{{phone}}"
        }
      }`,
      samplePayload,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.parse(result.body)).toEqual({
      formName: "My Opt-in Form",
      contact: {
        email: "jane@example.com",
        firstName: "Jane",
        lastName: "Doe",
        phone: "+15551212",
      },
    });
  });

  it("escapes quotes inside placeholder values", () => {
    const result = renderWebhookBody(
      `{"email":"{{email}}"}`,
      { ...samplePayload, email: 'a"b@example.com' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.parse(result.body).email).toBe('a"b@example.com');
  });

  it("fails when rendered template is not valid JSON", () => {
    const result = renderWebhookBody(`{ email: {{email}} }`, samplePayload);
    expect(result.ok).toBe(false);
  });
});

describe("webhook URL validation", () => {
  function parseWebhook(url: string, bodyTemplate?: string) {
    return autoresponderConnectionSchema.safeParse({
      name: "Test webhook",
      provider: "WEBHOOK",
      trigger: "LEAD_CAPTURED",
      campaignId: null,
      config: { url, ...(bodyTemplate !== undefined ? { bodyTemplate } : {}) },
    });
  }

  it("accepts https webhook URLs", () => {
    expect(parseWebhook("https://hooks.zapier.com/hooks/catch/1/abc").success).toBe(true);
  });

  it("rejects email addresses used as webhook URLs", () => {
    const result = parseWebhook("ppalash62@gmail.com");
    expect(result.success).toBe(false);
  });

  it("rejects mailto URLs", () => {
    const result = parseWebhook("mailto:ppalash62@gmail.com");
    expect(result.success).toBe(false);
  });

  it("accepts a valid bodyTemplate", () => {
    expect(
      parseWebhook("https://example.com/hook", '{"email":"{{email}}"}').success,
    ).toBe(true);
  });

  it("rejects invalid bodyTemplate JSON", () => {
    expect(parseWebhook("https://example.com/hook", "{not-json").success).toBe(false);
  });
});

describe("buildAutoresponderTestEmail", () => {
  it("uses plus-tag on advertiser email", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T12:00:00.000Z"));
    const stamp = Date.now();
    expect(buildAutoresponderTestEmail("advertiser@cpl.local")).toBe(
      `advertiser+cpl-test-${stamp}@cpl.local`,
    );
    vi.useRealTimers();
  });

  it("falls back to example.com when advertiser email is missing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T12:00:00.000Z"));
    const stamp = Date.now();
    expect(buildAutoresponderTestEmail(null)).toBe(`cpl-test-${stamp}@example.com`);
    expect(buildAutoresponderTestEmail("")).toBe(`cpl-test-${stamp}@example.com`);
    vi.useRealTimers();
  });

  it("never uses mailinator", () => {
    expect(buildAutoresponderTestEmail("advertiser@cpl.local")).not.toContain("mailinator");
    expect(buildAutoresponderTestEmail(null)).not.toContain("mailinator");
  });

  it("buildSystemeTestEmail delegates to shared helper", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T12:00:00.000Z"));
    const stamp = Date.now();
    expect(buildSystemeTestEmail("user@affsense.com")).toBe(`user+cpl-test-${stamp}@affsense.com`);
    vi.useRealTimers();
  });
});

describe("encrypt-secrets", () => {
  it("round-trips encrypted values", () => {
    process.env.AUTH_SECRET = "test-secret-key-min-32-characters-long";
    const enc = encryptSecret("my-api-key");
    expect(enc.startsWith("enc:")).toBe(true);
    expect(decryptSecret(enc)).toBe("my-api-key");
  });

  it("masks secrets for API responses", () => {
    const masked = maskConfigForApi({ apiKey: "secret", listId: "abc" });
    expect(masked.apiKey).toBe("••••••••");
    expect(masked.listId).toBe("abc");
  });
});

describe("buildLeadPayload", () => {
  const baseLead = {
    id: "lead_1",
    data: { email: "jane@example.com", first_name: "Jane", phone: "+15551234567" },
    country: "US",
    source: "facebook",
    subId: "sub1",
    createdAt: new Date("2026-06-30T12:00:00Z"),
    campaign: { id: "camp_1", name: "Demo" },
    publisher: { id: "pub_1" },
  } as never;

  it("builds payload with email", () => {
    const payload = buildLeadPayload(baseLead, "LEAD_CAPTURED");
    expect(payload?.email).toBe("jane@example.com");
    expect(payload?.firstName).toBe("Jane");
    expect(payload?.event).toBe("lead.captured");
  });

  it("returns null without email", () => {
    const payload = buildLeadPayload(
      { ...(baseLead as object), data: { first_name: "Jane" } } as never,
      "LEAD_CAPTURED",
    );
    expect(payload).toBeNull();
  });
});

describe("sendWebhook", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts JSON to webhook URL", async () => {
    const result = await sendWebhook(
      { url: "https://example.com/hook" },
      {
        event: "lead.captured",
        leadId: "1",
        email: "a@b.com",
        campaign: { id: "c", name: "C" },
        publisher: { id: "p" },
        submittedAt: new Date().toISOString(),
      },
    );
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/hook",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("sendWebhook live localhost", () => {
  it("delivers signed payload to a local catcher", async () => {
    let receivedBody = "";
    let receivedSig = "";

    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(chunk as Buffer));
      req.on("end", () => {
        receivedBody = Buffer.concat(chunks).toString("utf8");
        receivedSig = String(req.headers["x-cpl-signature"] ?? "");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      throw new Error("Failed to bind local catcher");
    }

    const url = `http://127.0.0.1:${address.port}/hook`;
    const payload = {
      event: "lead.captured" as const,
      leadId: "lead_local_1",
      email: "jane@example.com",
      firstName: "Jane",
      campaign: { id: "c", name: "C" },
      publisher: { id: "p" },
      submittedAt: new Date().toISOString(),
    };

    const result = await sendWebhook({ url, secret: "local-test-secret" }, payload);
    await new Promise<void>((resolve) => server.close(() => resolve()));

    expect(result.ok).toBe(true);
    expect(JSON.parse(receivedBody).email).toBe("jane@example.com");
    expect(receivedSig).toMatch(/^[a-f0-9]{64}$/);
  });

  it("posts rendered bodyTemplate JSON to a local catcher", async () => {
    let receivedBody = "";

    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(chunk as Buffer));
      req.on("end", () => {
        receivedBody = Buffer.concat(chunks).toString("utf8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      throw new Error("Failed to bind local catcher");
    }

    const url = `http://127.0.0.1:${address.port}/hook`;
    const result = await sendWebhook(
      {
        url,
        bodyTemplate: `{
          "formName": "My Opt-in Form",
          "contact": { "email": "{{email}}", "firstName": "{{firstName}}" }
        }`,
      },
      {
        event: "lead.captured",
        leadId: "lead_tmpl",
        email: "tmpl@example.com",
        firstName: "Pat",
        campaign: { id: "c", name: "C" },
        publisher: { id: "p" },
        submittedAt: new Date().toISOString(),
      },
    );
    await new Promise<void>((resolve) => server.close(() => resolve()));

    expect(result.ok).toBe(true);
    expect(JSON.parse(receivedBody)).toEqual({
      formName: "My Opt-in Form",
      contact: { email: "tmpl@example.com", firstName: "Pat" },
    });
  });
});

describe("verifySystemeConfig", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects missing API key", async () => {
    const result = await verifySystemeConfig({ apiKey: "" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("API key");
  });

  it("rejects invalid API key", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    const result = await verifySystemeConfig({ apiKey: "bad-key" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("invalid");
  });

  it("accepts valid API key without tag", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '{"items":[]}',
    });

    const result = await verifySystemeConfig({ apiKey: "good-key" });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.systeme.io/api/contacts?limit=10");
  });

  it("surfaces Systeme limit validation errors", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: async () =>
        JSON.stringify({
          violations: [{ message: "This value should be between 10 and 100.", propertyPath: "limit" }],
        }),
    });

    const result = await verifySystemeConfig({ apiKey: "good-key" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("between 10 and 100");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.systeme.io/api/contacts?limit=10");
  });

  it("rejects unknown tag ID", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => '{"items":[]}' })
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => "" });

    const result = await verifySystemeConfig({ apiKey: "good-key", tagId: "12345" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("12345");
  });
});

describe("sendSysteme", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates contact without tag", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 99 }),
      text: async () => "",
    });

    const result = await sendSysteme(
      { apiKey: "good-key" },
      {
        event: "lead.captured",
        leadId: "1",
        email: "lead@example.com",
        firstName: "Jane",
        campaign: { id: "c", name: "C" },
        publisher: { id: "p" },
        submittedAt: new Date().toISOString(),
      },
    );

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.systeme.io/api/contacts");
  });

  it("assigns tag after contact creation", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 42 }),
        text: async () => "",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "",
      });

    const result = await sendSysteme(
      { apiKey: "good-key", tagId: "7" },
      {
        event: "lead.captured",
        leadId: "1",
        email: "lead@example.com",
        campaign: { id: "c", name: "C" },
        publisher: { id: "p" },
        submittedAt: new Date().toISOString(),
      },
    );

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.systeme.io/api/contacts/42/tags");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ tagId: 7 });
  });
});
