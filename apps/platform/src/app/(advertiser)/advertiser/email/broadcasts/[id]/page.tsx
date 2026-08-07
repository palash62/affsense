import { BroadcastComposePanel } from "@/components/advertiser/email/panels/broadcast-compose-panel";

type Props = { params: Promise<{ id: string }> };

export default async function AdvertiserEmailBroadcastEditPage({ params }: Props) {
  const { id } = await params;
  return <BroadcastComposePanel broadcastId={id} />;
}
