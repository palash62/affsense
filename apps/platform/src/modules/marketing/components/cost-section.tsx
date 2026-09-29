export function CostSection() {
  return (
    <section id="cost">
      <div className="container">
        <div className="section-title">
          <h2>Why Pay $5+ Per Lead When You Can Bid From $0.70?</h2>
          <p>
            Quality clicks from Meta, Google Ads, and solo ads can cost $1–$3+ per click.
            After conversion loss, your real cost per lead often becomes $5+ for Tier 1 countries.
          </p>
        </div>

        <div className="cost-cards">
          <div className="cost-card">
            <div className="badge">Traditional Traffic Buying</div>
            <h3>Pay For Clicks First</h3>
            <div className="price-big">
              $1–$3+ <span>/ click</span>
            </div>
            <ul>
              <li>❌ You pay even if clicks do not convert</li>
              <li>❌ Final CPL can easily go above $5+</li>
              <li>❌ More testing cost</li>
              <li>❌ No guaranteed lead opt-in</li>
              <li>❌ Lower control over final lead cost</li>
            </ul>
          </div>

          <div className="cost-card highlight">
            <div className="badge">Affsense Verified Leads</div>
            <h3>Pay For Verified Leads</h3>
            <div className="price-big">
              $0.70–$2.50 <span>/ lead</span>
            </div>
            <ul>
              <li>✅ Pay only for valid verified lead opt-ins</li>
              <li>✅ Bid your desired cost per lead</li>
              <li>✅ Minimum bid set by country tier</li>
              <li>✅ Better control over campaign budget</li>
              <li>✅ Built for Tier 1 lead generation</li>
            </ul>
            <p className="note">
              Final lead cost depends on targeting, country tier, niche, and bid competition.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
