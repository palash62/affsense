import type { SoloDevice } from "./eligibility";

const BOT_UA =
  /bot|crawl|spider|slurp|curl\/|wget|python|httpclient|http-client|headless|phantom|selenium|puppeteer|playwright|scrapy|go-http|java\/|okhttp|axios|node-fetch|undici|libwww|facebookexternalhit|preview|monitor|uptime|lighthouse/i;

export function isLikelyBot(userAgent: string | null | undefined): boolean {
  const ua = userAgent?.trim() ?? "";
  if (ua.length < 20) return true;
  return BOT_UA.test(ua);
}

export function deviceFromUserAgent(userAgent: string | null | undefined): SoloDevice {
  const ua = userAgent ?? "";
  if (/ipad|tablet|kindle|playbook|silk/i.test(ua)) return "tablet";
  if (/android|mobile|iphone|ipod|windows phone/i.test(ua)) return "mobile";
  return "desktop";
}

export const SOLO_DEVICES: SoloDevice[] = ["desktop", "mobile", "tablet"];
