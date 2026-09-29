import Link from "next/link";
import { getYouTubeEmbedUrlFromLink } from "@/lib/youtube";

const DEMO_VIDEO_URL = "https://www.youtube.com/embed/723b7GEcZ7o?si=CfMisilYluVqcAOL";
const DEMO_EMBED_URL =
  getYouTubeEmbedUrlFromLink(DEMO_VIDEO_URL, { controls: true }) ?? DEMO_VIDEO_URL;

export function VslSection() {
  return (
    <section id="vsl">
      <div className="container">
        <div className="vsl">
          <div className="video-box">
            <iframe
              src={DEMO_EMBED_URL}
              title="Affsense demo video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
          <div>
            <div className="badge">Watch The Demo</div>
            <h2>See How Affsense Helps You Launch Smarter Lead Campaigns</h2>
            <p className="vsl-desc">
              Discover how advertisers can launch campaigns, use pre-made funnels, connect autoresponders,
              verify leads, bid CPL, and optimize performance with AI.
            </p>
            <Link href="/register" className="btn">
              Join Now →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
