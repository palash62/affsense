import { Suspense } from "react";
import "../styles/vsl-landing.css";
import { MarketingHeader } from "./marketing-header";
import { MarketingHero } from "./marketing-hero";
import { TrustRow } from "./trust-row";
import { CostSection } from "./cost-section";
import { ProblemSolutionSection } from "./problem-solution-section";
import { FeaturesSection } from "./features-section";
import { ChatProofSection } from "./chat-proof-section";
import { IntegrationsSection } from "./integrations-section";
import { VslSection } from "./vsl-section";
import { HowItWorksSection } from "./how-it-works-section";
import { ComparisonSection } from "./comparison-section";
import { CtaSection } from "./cta-section";
import { MarketingFooter } from "./marketing-footer";
import { ReferralCapture } from "./referral-capture";

export function VslLandingPage() {
  return (
    <div className="vslLanding">
      <Suspense fallback={null}>
        <ReferralCapture />
      </Suspense>
      <MarketingHeader />
      <MarketingHero />
      <TrustRow />
      <CostSection />
      <ProblemSolutionSection />
      <FeaturesSection />
      <ChatProofSection />
      <IntegrationsSection />
      <VslSection />
      <HowItWorksSection />
      <ComparisonSection />
      <CtaSection />
      <MarketingFooter />
    </div>
  );
}
