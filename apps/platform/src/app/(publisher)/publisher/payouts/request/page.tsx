import { redirect } from "next/navigation";

// Affiliates are paid through invoices; self-service withdrawals are closed.
export default function RequestPayoutPage() {
  redirect("/publisher/invoices");
}
