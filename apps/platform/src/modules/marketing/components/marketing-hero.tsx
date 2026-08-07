import Link from "next/link";
import { HeroDemoVideo } from "./hero-demo-video";

export function MarketingHero() {
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div>
          <div className="badge">AI-Powered Pay Per Lead Network</div>
          <h1>
            Stop Paying $1–$3 Per Click. Start Buying <span>Verified Leads.</span>
          </h1>
          <p>
            LeadVix helps advertisers buy 100% verified lead opt-ins from $0.70–$2.50 per lead,
            instead of wasting budget on expensive clicks that may never convert.
          </p>
        </div>

        <div className="hero-visual">
          <HeroDemoVideo />
          <div className="hero-actions">
            <Link href="/register" className="btn">
              Join Now →
            </Link>
            <a href="#vsl" className="video-btn">
              ▶ Watch Demo
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
