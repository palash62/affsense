const FEATURES = [
  {
    icon: "🧲",
    title: "Built-in Funnel Builder",
    description:
      "Use pre-made funnels to quickly launch Pay Per Lead campaigns without building everything from scratch.",
  },
  {
    icon: "💰",
    title: "Custom CPL Bidding",
    description:
      "Bid your desired cost per lead based on campaign type, niche, and country tier minimum bid rules.",
  },
  {
    icon: "🔗",
    title: "Autoresponder API Integration",
    description:
      "Automatically deliver verified leads into GetResponse, AWeber, Systeme.io, or your custom webhook.",
  },
  {
    icon: "🤖",
    title: "AI Lead Scoring",
    description:
      "Our AI helps score and filter leads so advertisers can focus on higher-quality prospects.",
  },
  {
    icon: "📈",
    title: "AI Campaign Optimization",
    description:
      "Optimize campaigns using intelligent insights designed to improve lead quality and campaign performance.",
  },
  {
    icon: "👨‍💻",
    title: "DFY Campaign Optimization",
    description:
      "Our team helps optimize campaign setup, funnel flow, and lead delivery for better results.",
  },
  {
    icon: "🛡",
    title: "Lead Verification",
    description: "Pay only for valid verified lead opt-ins, not clicks, bots, or low-quality traffic.",
  },
  {
    icon: "📊",
    title: "Real-Time Analytics",
    description:
      "Track campaigns, leads, verification status, conversion rates, CPL, and optimization data in one place.",
  },
  {
    icon: "🎯",
    title: "Smart Lead Routing",
    description:
      "Route leads to the right campaigns, advertisers, or integrations using smart delivery rules.",
  },
] as const;

export function FeaturesSection() {
  return (
    <section id="features">
      <div className="container">
        <div className="section-title">
          <h2>Everything You Need To Run Better Pay Per Lead Campaigns</h2>
          <p>
            Affsense combines funnel creation, verified lead buying, API integrations, smart scoring,
            reporting, and AI optimization into one performance marketing platform.
          </p>
        </div>

        <div className="features">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="feature">
              <div className="icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
