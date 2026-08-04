import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, MailX, XCircle } from "lucide-react";
import {
  getContactByUnsubscribeToken,
  unsubscribeByToken,
} from "@/modules/email-marketing";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
};

async function confirmUnsubscribe(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  if (!token) return;
  await unsubscribeByToken(token);
  redirect(`/unsubscribe/${token}?done=1`);
}

export default async function UnsubscribePage({ params, searchParams }: Props) {
  const { token } = await params;
  const { done } = await searchParams;
  const contact = await getContactByUnsubscribeToken(token);

  if (!contact) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <XCircle className="mx-auto h-12 w-12 text-slate-400" />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Invalid link</h1>
          <p className="mt-2 text-sm text-slate-600">
            This unsubscribe link is invalid or expired.
          </p>
          <Link href="/" className="mt-6 inline-block text-sm text-[var(--theme-primary)] hover:underline">
            Return to home
          </Link>
        </div>
      </div>
    );
  }

  const showSuccess = done === "1" || contact.status === "UNSUBSCRIBED";

  if (showSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">You&apos;re unsubscribed</h1>
          <p className="mt-2 text-sm text-slate-600">
            <strong>{contact.email}</strong> will no longer receive marketing emails from this
            sender.
          </p>
          <Link href="/" className="mt-6 inline-block text-sm text-[var(--theme-primary)] hover:underline">
            Return to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <MailX className="mx-auto h-12 w-12 text-slate-400" />
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Unsubscribe?</h1>
        <p className="mt-2 text-sm text-slate-600">
          Stop marketing emails to <strong>{contact.email}</strong>? Confirm below — opening this
          page alone does not unsubscribe you.
        </p>
        <form action={confirmUnsubscribe} className="mt-6">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
          >
            Confirm unsubscribe
          </button>
        </form>
        <Link href="/" className="mt-4 inline-block text-sm text-slate-500 hover:underline">
          Keep receiving emails
        </Link>
      </div>
    </div>
  );
}
