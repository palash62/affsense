import type Stripe from "stripe";
import { getResolvedStripeConfig } from "@/services/stripe-settings.service";
import { getStripeClient } from "@/services/stripe-payment.service";
import {
  reverseSoloDeposit,
  settleSoloDeposit,
  SOLO_DEPOSIT_PURPOSE,
} from "@/services/solo-wallet.service";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function intentIdOf(value: string | Stripe.PaymentIntent | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * Stripe events for Solo Ads deposits. The signature is verified before any
 * state changes; handlers are idempotent so Stripe retries are safe.
 */
export async function POST(request: Request) {
  const config = await getResolvedStripeConfig();
  const secret = config.webhookSecret?.trim();
  if (!config.enabled || !secret) {
    return json({ error: { code: "STRIPE_WEBHOOK_NOT_CONFIGURED" } }, 503);
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return json({ error: { code: "MISSING_SIGNATURE" } }, 400);

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    const stripe = await getStripeClient();
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    console.error("[stripe-webhook] signature verification failed", error);
    return json({ error: { code: "INVALID_SIGNATURE" } }, 400);
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
      case "payment_intent.payment_failed":
      case "payment_intent.canceled": {
        const intent = event.data.object as Stripe.PaymentIntent;
        if (intent.metadata?.purpose !== SOLO_DEPOSIT_PURPOSE) break;
        const deposit = await prisma.soloDeposit.findUnique({
          where: { stripePaymentIntentId: intent.id },
          select: { id: true },
        });
        if (deposit) await settleSoloDeposit(deposit.id, intent);
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const intentId = intentIdOf(charge.payment_intent);
        if (intentId) await reverseSoloDeposit(intentId, "refund", charge.amount_refunded, `${charge.id}:${charge.amount_refunded}`);
        break;
      }
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const intentId = intentIdOf(dispute.payment_intent);
        if (intentId) await reverseSoloDeposit(intentId, "chargeback", dispute.amount, dispute.id);
        break;
      }
      default:
        break;
    }
    return json({ received: true });
  } catch (error) {
    console.error("[stripe-webhook] handler failed", event.type, event.id, error);
    return json({ error: { code: "HANDLER_FAILED" } }, 500);
  }
}
