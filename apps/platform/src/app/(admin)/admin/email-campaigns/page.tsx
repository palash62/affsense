import { redirect } from "next/navigation";

export default function AdminEmailCampaignsRedirect() {
  redirect("/admin/bulk-email");
}
