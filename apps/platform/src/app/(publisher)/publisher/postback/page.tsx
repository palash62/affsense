import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { PublisherPostbackForm } from "@/components/publisher/publisher-postback-form";

export const dynamic = "force-dynamic";

export default async function PublisherPostbackPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  return <PublisherPostbackForm />;
}
