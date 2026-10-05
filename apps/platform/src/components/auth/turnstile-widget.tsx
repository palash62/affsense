"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

type TurnstileWidgetProps = {
  onToken: (token: string | null) => void;
  /** Change this value to re-render the challenge (e.g. after a failed submit). */
  resetKey?: number;
  className?: string;
};

export function TurnstileWidget({ onToken, resetKey = 0, className }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !scriptReady) return;
    const api = window.turnstile;
    const container = containerRef.current;
    if (!api || !container) return;

    onTokenRef.current(null);
    const widgetId = api.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: "light",
      callback: (token) => onTokenRef.current(token),
      "expired-callback": () => onTokenRef.current(null),
      "error-callback": () => onTokenRef.current(null),
    });

    return () => {
      try {
        api.remove(widgetId);
      } catch {
        // widget already gone
      }
    };
  }, [scriptReady, resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <>
      <Script
        src={TURNSTILE_SCRIPT_SRC}
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <div ref={containerRef} className={className} />
    </>
  );
}

/** Hidden field real users never see; bots that autofill every input fill it. */
export function SignupHoneypot({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}
    >
      <label htmlFor="company_website">Company website</label>
      <input
        id="company_website"
        name="company_website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function useSignupBotCheck() {
  const [formStartedAt, setFormStartedAt] = useState<number | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    setFormStartedAt(Date.now());
  }, []);

  const resetCaptcha = useCallback(() => {
    setTurnstileToken(null);
    setResetKey((key) => key + 1);
  }, []);

  return {
    captchaReady: !TURNSTILE_SITE_KEY || Boolean(turnstileToken),
    payload: {
      turnstileToken: turnstileToken ?? undefined,
      company_website: honeypot,
      formStartedAt: formStartedAt ?? undefined,
    },
    widgetProps: { onToken: setTurnstileToken, resetKey },
    honeypotProps: { value: honeypot, onChange: setHoneypot },
    resetCaptcha,
  };
}
