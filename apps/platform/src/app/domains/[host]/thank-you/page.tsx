import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ThankYouFunnelPage } from "@/components/optin/thank-you-funnel-page";
import { resolveFunnelByDomain } from "@/services/advertiser-domain.service";
import { resolveThankYouPageForRequest } from "@/services/optin-funnel.service";

function decodeHostParam(host: string) {
  try {
    return decodeURIComponent(host).toLowerCase();
  } catch {
    return host.toLowerCase();
  }
}

async function getOrigin() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export default async function CustomDomainThankYouPage({
  params,
  searchParams,
}: {
  params: Promise<{ host: string }>;
  searchParams: Promise<{ lead_id?: string; preview?: string }>;
}) {
  const { host } = await params;
  const resolved = await resolveFunnelByDomain(decodeHostParam(host));
  if (!resolved) notFound();

  const { lead_id: leadId, preview } = await searchParams;
  const origin = await getOrigin();
  const slug = resolved.funnel.slug;

  const page = await resolveThankYouPageForRequest({ slug, leadId, preview });
  if (!page) notFound();

  return <ThankYouFunnelPage page={page} origin={origin} />;
}
