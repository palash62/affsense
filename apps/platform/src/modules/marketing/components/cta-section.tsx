import Link from "next/link";

export function CtaSection() {
  return (
    <section id="join">
      <div className="container">
        <div className="cta">
          <h2>
            Stop Buying Clicks. Start Buying <span className="purple">Verified Leads.</span>
          </h2>
          <p>
            Join Affsense today and start building smarter Pay Per Lead campaigns with verified leads,
            flexible CPL bidding, pre-made funnels, and AI optimization.
          </p>
          <br />
          <Link href="/register" className="btn">
            Join Now →
          </Link>
          <p className="cta-note">
            Pay only for valid, verified lead opt-ins. Minimum bid applies based on country tier.
          </p>
        </div>
      </div>
    </section>
  );
}
