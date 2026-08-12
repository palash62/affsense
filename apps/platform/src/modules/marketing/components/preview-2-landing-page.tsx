"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Inter, Manrope } from "next/font/google";
import { Menu, X } from "lucide-react";
import "../styles/preview-2-landing.css";
import { ReferralCapture } from "./referral-capture";

const inter = Inter({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const SECTION_LINKS = [
  { href: "#offers", label: "Use Any Offer" },
  { href: "#flow", label: "How It Works" },
  { href: "#why", label: "Why PPL" },
  { href: "#features", label: "Features" },
  { href: "#marketplace", label: "Marketplace" },
  { href: "#autoresponder", label: "Autoresponder" },
  { href: "#demo", label: "Demo" },
] as const;

export function Preview2LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("show");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    root.querySelectorAll(".reveal, .stagger").forEach((el) => observer.observe(el));

    const vsl = root.querySelector<HTMLElement>(".vsl-shell");

    function onMouseMove(e: MouseEvent) {
      if (!vsl || window.innerWidth < 900) return;
      const r = vsl.getBoundingClientRect();
      if (e.clientY < r.top - 120 || e.clientY > r.bottom + 120) return;
      const x = (e.clientX - (r.left + r.width / 2)) / r.width;
      const y = (e.clientY - (r.top + r.height / 2)) / r.height;
      vsl.style.transform = `perspective(1200px) rotateY(${x * 1.4}deg) rotateX(${-y * 1.4}deg)`;
    }

    function onMouseLeave() {
      if (vsl) vsl.style.transform = "none";
    }

    window.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseleave", onMouseLeave);

    return () => {
      observer.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return (
    <div ref={rootRef} className={`preview2Landing ${inter.variable} ${manrope.variable}`}>
      <Suspense fallback={null}>
        <ReferralCapture />
      </Suspense>
      
      
        <div className="nav-wrap">
          <div className="container">
            <nav>
              <Link href="/" className="brand" onClick={closeMenu}>
                <span className="brandmark">✦</span>
                <span>LeadVix</span>
              </Link>
              <div className="nav-links">
                {SECTION_LINKS.map((link) => (
                  <a key={link.href} href={link.href}>
                    {link.label}
                  </a>
                ))}
              </div>
              <div className="nav-actions">
                <Link href="/login" className="btn btn-secondary">
                  Login
                </Link>
                <Link href="/register" className="btn btn-primary">
                  Join Now →
                </Link>
                <button
                  type="button"
                  className="mobile-menu-toggle"
                  aria-label={menuOpen ? "Close menu" : "Open menu"}
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((value) => !value)}
                >
                  {menuOpen ? <X size={22} /> : <Menu size={22} />}
                </button>
              </div>
            </nav>
          </div>

          {menuOpen ? (
            <div
              className="mobile-nav-panel is-open"
              role="dialog"
              aria-label="Mobile navigation"
            >
              {SECTION_LINKS.map((link) => (
                <a key={link.href} href={link.href} onClick={closeMenu}>
                  {link.label}
                </a>
              ))}
              <div className="mobile-nav-actions">
                <Link href="/login" className="btn btn-secondary" onClick={closeMenu}>
                  Login
                </Link>
                <Link href="/register" className="btn btn-primary" onClick={closeMenu}>
                  Join Now →
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      
        <main>
          <section className="hero">
            <div className="container hero-inner">
              <div className="eyebrow"><i /> AI-Powered Pay Per Lead Network</div>
              <h1 style={{"marginTop":"22px"}}>Stop Paying for Clicks.<br />Start Paying for <span className="gradient">Verified Leads.</span></h1>
              <p className="lead">
                Generate verified opt-ins for your own product, affiliate offer, individual program, make-money-online offer,
                business opportunity or other compatible campaign — or use LeadVix{'\''}s built-in high-converting CPA offers to start monetizing immediately.
              </p>
      
              <div className="proof-pills">
                <span className="proof-pill"><i>✓</i> Use Your Own Offer</span>
                <span className="proof-pill"><i>✓</i> Built-In CPA Marketplace</span>
                <span className="proof-pill"><i>✓</i> In-House Autoresponder</span>
                <span className="proof-pill"><i>✓</i> Verified Opt-ins</span>
              </div>
            </div>
          </section>
      
          <section className="vsl-wrap">
            <div className="container">
              <div className="vsl-shell reveal">
                <div className="vsl-frame">
                  <iframe
                    src="https://www.youtube.com/embed/_TaHJPGSQ6Q?si=HqEZyKG2Gv-ITkhb"
                    title="LeadVix Presentation"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen></iframe>
                </div>
              </div>
      
              <div className="hero-actions">
                <Link href="/register" className="btn btn-primary">Start Buying Verified Leads →</Link>
                <a href="#demo" className="btn btn-secondary">Watch Product Demo ↓</a>
              </div>
      
              <p className="video-note">Watch this first to understand how LeadVix works and why Pay Per Lead changes the economics of paid traffic.</p>
            </div>
          </section>
      
          <div className="ticker">
            <div className="ticker-track">
              <div className="ticker-item"><span>🎯</span> Use Your Own Offer</div>
              <div className="ticker-item"><span>🛍</span> Built-In CPA Marketplace</div>
              <div className="ticker-item"><span>✓</span> Live Email Verification</div>
              <div className="ticker-item"><span>✉</span> In-House Autoresponder</div>
              <div className="ticker-item"><span>🤖</span> AI Lead Scoring</div>
              <div className="ticker-item"><span>📊</span> Real-Time Analytics</div>
      
              <div className="ticker-item"><span>🎯</span> Use Your Own Offer</div>
              <div className="ticker-item"><span>🛍</span> Built-In CPA Marketplace</div>
              <div className="ticker-item"><span>✓</span> Live Email Verification</div>
              <div className="ticker-item"><span>✉</span> In-House Autoresponder</div>
              <div className="ticker-item"><span>🤖</span> AI Lead Scoring</div>
              <div className="ticker-item"><span>📊</span> Real-Time Analytics</div>
            </div>
          </div>
      
          <section className="section" id="offers">
            <div className="container">
              <div className="section-head reveal">
                <div className="eyebrow"><i /> Use LeadVix Your Way</div>
                <h2>Bring Your Own Offer —<br /><span className="gradient">Or Use One of Ours.</span></h2>
                <p className="lead">
                  LeadVix is not limited to our in-house CPA offers. You can generate verified leads for your own product,
                  affiliate offer, individual program, MMO offer, business opportunity or other compatible campaign.
                </p>
              </div>
      
              <div className="offer-choice-grid stagger">
                <article className="choice own">
                  <div className="choice-icon">🎯</div>
                  <h3>Use Your Own Product or Offer</h3>
                  <p>Already have something to promote? Connect your existing offer to the LeadVix funnel and start building your list with verified leads.</p>
                  <div className="choice-tags">
                    <span className="choice-tag">Your Product</span>
                    <span className="choice-tag">Affiliate Offer</span>
                    <span className="choice-tag">Individual Program</span>
                    <span className="choice-tag">Make Money Online</span>
                    <span className="choice-tag">Business Opportunity</span>
                  </div>
                  <div className="choice-path">
                    <span className="path-chip">Your Offer</span><span className="path-arrow">→</span>
                    <span className="path-chip">LeadVix Funnel</span><span className="path-arrow">→</span>
                    <span className="path-chip">Verified Leads</span><span className="path-arrow">→</span>
                    <span className="path-chip">Follow-Up</span>
                  </div>
                </article>
      
                <article className="choice market">
                  <div className="choice-icon">🛍</div>
                  <h3>Use LeadVix{'\''}s Built-In CPA Offers</h3>
                  <p>Don{'\''}t have an offer ready? Choose from built-in high-converting CPA offers and integrate one into your opt-in funnel in just a few clicks.</p>
                  <div className="choice-tags">
                    <span className="choice-tag">High-Converting Offers</span>
                    <span className="choice-tag">Few-Click Integration</span>
                    <span className="choice-tag">Fast Monetization</span>
                    <span className="choice-tag">Built Into LeadVix</span>
                  </div>
                  <div className="choice-path">
                    <span className="path-chip">Choose CPA Offer</span><span className="path-arrow">→</span>
                    <span className="path-chip">Connect Funnel</span><span className="path-arrow">→</span>
                    <span className="path-chip">Launch</span><span className="path-arrow">→</span>
                    <span className="path-chip">Monetize</span>
                  </div>
                </article>
              </div>
            </div>
          </section>
      
          <section className="section-sm" id="flow">
            <div className="container">
              <div className="section-head reveal">
                <div className="eyebrow"><i /> See Exactly What Happens</div>
                <h2>Traffic Comes In.<br /><span className="gradient">LeadVix Handles the Rest of the Flow.</span></h2>
                <p className="lead">
                  The visitor reaches your opt-in page, submits their email, LeadVix verifies the lead live, adds the accepted lead to your autoresponder,
                  and then sends the visitor to your thank-you page or directly to your offer.
                </p>
              </div>
      
              <div className="live-board reveal">
                <div className="live-top">
                  <h3>Live Lead Journey</h3>
                  <div className="live-pill"><span className="pulse"></span> CAMPAIGN ACTIVE</div>
                </div>
      
                <div className="journey">
                  <div className="journey-card">
                    <div className="journey-icon">🚦</div>
                    <b>1. Traffic Reaches Your Opt-In Page</b>
                    <p>Visitors from LeadVix traffic sources land on your campaign's opt-in funnel.</p>
                    <span className="micro-status blue">Visitor Arrived</span>
                  </div>
      
                  <div className="journey-card">
                    <div className="journey-icon">📝</div>
                    <b>2. Visitor Opts In</b>
                    <p>The visitor enters their email and submits the form on your opt-in page.</p>
                    <span className="micro-status violet">Form Submitted</span>
                  </div>
      
                  <div className="journey-card">
                    <div className="journey-icon">🛡</div>
                    <b>3. LeadVix Verifies the Lead Live</b>
                    <p>Email validity, duplicates, targeting and campaign rules are checked before the lead is accepted.</p>
                    <span className="micro-status verified">Verified ✓</span>
                  </div>
      
                  <div className="journey-card">
                    <div className="journey-icon">✉</div>
                    <b>4. Lead Is Added to Your Autoresponder</b>
                    <p>The verified lead enters the LeadVix in-house autoresponder or your connected external email platform.</p>
                    <span className="micro-status orange">Follow-Up Starts</span>
                  </div>
      
                  <div className="moving-lead"></div>
                </div>
      
                <div className="route-split">
                  <div className="route-card thank">
                    <i>📄</i>
                    <div>
                      <b>Option A — Redirect to Your Thank-You Page</b>
                      <small>Use a thank-you page where your product, affiliate offer or CPA offer is linked.</small>
                    </div>
                  </div>
                  <div className="route-card direct">
                    <i>↗</i>
                    <div>
                      <b>Option B — Redirect Directly to Your Offer</b>
                      <small>Skip the thank-you page and send the visitor straight to the offer after opt-in.</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
      
          <section className="section" id="why">
            <div className="container">
              <div className="section-head reveal">
                <div className="eyebrow"><i /> Why Pay Per Lead Is Different</div>
                <h2>With PPC, the Money Leaves First.<br /><span className="gradient">The Lead May Never Arrive.</span></h2>
                <p className="lead">Traditional PPC charges at the top of the funnel. A visitor can bounce, ignore the offer, or never opt in — but the click has already consumed your budget.</p>
              </div>
      
              <div className="compare-grid">
                <article className="compare ppc reveal">
                  <div className="compare-label">Traditional Pay Per Click</div>
                  <h3>You Pay Before You Know the Result</h3>
                  <div className="money-card">
                    <div className="money-row"><div className="money-icon">💸</div><div><b>Click purchased</b><small>Budget spent immediately</small></div><span className="money-value">Paid</span></div>
                    <div className="money-row"><div className="money-icon">↩</div><div><b>Visitor leaves</b><small>No opt-in, no lead</small></div><span className="money-value">Waste</span></div>
                    <div className="money-row"><div className="money-icon">×</div><div><b>Some submit poor data</b><small>More filtering after spend</small></div><span className="money-value">More Loss</span></div>
                    <div className="money-row"><div className="money-icon">📈</div><div><b>Your effective CPL climbs</b><small>Only a fraction of clicks become leads</small></div><span className="money-value">Higher CPL</span></div>
                  </div>
                  <div className="compare-footer">You can pay for many visitors who never become usable leads.</div>
                </article>
      
                <article className="compare ppl reveal">
                  <div className="compare-label">LeadVix Pay Per Lead</div>
                  <h3>Pay for the Action You Actually Want</h3>
                  <div className="money-card">
                    <div className="money-row"><div className="money-icon">🎯</div><div><b>Set your CPL</b><small>Control your target lead cost</small></div><span className="money-value">Controlled</span></div>
                    <div className="money-row"><div className="money-icon">📝</div><div><b>Visitor opts in</b><small>The lead event happens first</small></div><span className="money-value">Lead</span></div>
                    <div className="money-row"><div className="money-icon">🛡</div><div><b>Verification runs</b><small>Invalid submissions can be rejected</small></div><span className="money-value">Verified</span></div>
                    <div className="money-row"><div className="money-icon">✉</div><div><b>Lead enters follow-up</b><small>Keep monetizing after acquisition</small></div><span className="money-value">Delivered</span></div>
                  </div>
                  <div className="compare-footer">Your spend is focused further down the funnel on accepted opt-ins.</div>
                </article>
              </div>
      
              <p className="disclaimer">PPC can work well when managed effectively. This comparison explains the billing model difference; actual CPL and campaign performance vary by niche, targeting, creative, offer and market conditions.</p>
            </div>
          </section>
      
          <section className="section-sm">
            <div className="container">
              <div className="section-head reveal">
                <div className="eyebrow"><i /> The Full LeadVix Stack</div>
                <h2>Everything You Need to Turn<br /><span className="gradient">Verified Leads Into Revenue.</span></h2>
              </div>
      
              <div className="feature-grid stagger">
                <article className="feature violet">
                  <div className="ficon">🎯</div>
                  <h3>Use Any Compatible Offer</h3>
                  <p>Promote your own product, affiliate offer, individual program, MMO offer, business opportunity or other compatible campaign.</p>
                  <div className="mini-ui">
                    <div className="mini-row"><span>Your Product</span><span style={{"color":"#16a66d"}}>Supported</span></div>
                    <div className="mini-row"><span>Affiliate Offer</span><span style={{"color":"#16a66d"}}>Supported</span></div>
                    <div className="mini-row"><span>Business Opportunity</span><span style={{"color":"#16a66d"}}>Supported</span></div>
                  </div>
                </article>
      
                <article className="feature blue">
                  <div className="ficon">🛍</div>
                  <h3>Built-In CPA Offers Marketplace</h3>
                  <p>Don{'\''}t have an offer? Choose from LeadVix{'\''}s high-converting in-house CPA offers and connect one to your funnel in a few clicks.</p>
                  <div className="mini-ui">
                    <div className="mini-row"><span>Offer selected</span><span style={{"color":"#6151ef"}}>Ready</span></div>
                    <div className="mini-row"><span>Funnel connected</span><span style={{"color":"#16a66d"}}>✓</span></div>
                    <div className="mini-row"><span>Offer CTA</span><span style={{"color":"#16a66d"}}>Active</span></div>
                  </div>
                </article>
      
                <article className="feature orange">
                  <div className="ficon">✉</div>
                  <h3>In-House Autoresponder</h3>
                  <p>Build automated follow-up sequences directly inside LeadVix, or connect GetResponse, AWeber, Systeme.io or webhook.</p>
                  <div className="mini-ui">
                    <div className="mini-row"><span>Welcome email</span><span style={{"color":"#16a66d"}}>Sent</span></div>
                    <div className="mini-row"><span>Follow-up #2</span><span style={{"color":"#6151ef"}}>Scheduled</span></div>
                    <div className="mini-row"><span>Follow-up #3</span><span style={{"color":"#6151ef"}}>Scheduled</span></div>
                  </div>
                </article>
      
                <article className="feature green">
                  <div className="ficon">🤖</div>
                  <h3>AI Lead Scoring & Optimization</h3>
                  <p>Use lead-quality signals and campaign data to help surface stronger prospects and improve routing decisions.</p>
                  <div className="mini-ui">
                    <div className="mini-row"><span>Email valid</span><span style={{"color":"#16a66d"}}>✓</span></div>
                    <div className="mini-row"><span>Country match</span><span style={{"color":"#16a66d"}}>✓</span></div>
                    <div className="mini-row"><span>Lead score</span><span style={{"color":"#16a66d"}}>94 / 100</span></div>
                  </div>
                </article>
              </div>
            </div>
          </section>
      
      
          <section className="section" id="features">
            <div className="container">
              <div className="section-head reveal">
                <div className="eyebrow"><i /> Complete LeadVix Feature Set</div>
                <h2>Everything Built to Help You<br /><span className="gradient">Acquire, Verify, Follow Up & Monetize Leads.</span></h2>
                <p className="lead">LeadVix combines campaign buying, funnel tools, verification, monetization, email follow-up, analytics and optimization in one advertiser platform.</p>
              </div>
      
              <div className="all-features-grid stagger">
                <article className="all-feature">
                  <div className="af-icon">🎯</div>
                  <h3>Pay Per Lead Campaigns</h3>
                  <p>Pay for accepted lead opt-ins instead of paying for every click that reaches your funnel.</p>
                </article>
      
                <article className="all-feature">
                  <div className="af-icon">💰</div>
                  <h3>Custom CPL Bidding</h3>
                  <p>Set the price you are willing to pay per lead based on your targeting and country-tier minimums.</p>
                </article>
      
                <article className="all-feature">
                  <div className="af-icon">🌍</div>
                  <h3>Country & Tier Targeting</h3>
                  <p>Target the countries and traffic tiers that match your campaign and acquisition goals.</p>
                </article>
      
                <article className="all-feature">
                  <div className="af-icon">🧲</div>
                  <h3>Built-In Funnel Builder</h3>
                  <p>Create and launch opt-in funnels inside LeadVix without needing a separate page builder.</p>
                </article>
      
                <article className="all-feature">
                  <div className="af-icon">🧩</div>
                  <h3>Done-For-You Funnel Templates</h3>
                  <p>Start faster with pre-built funnel layouts designed for lead capture and campaign conversion.</p>
                </article>
      
                <article className="all-feature">
                  <div className="af-icon">🎯</div>
                  <h3>Use Your Own Offer</h3>
                  <p>Promote your own product, affiliate offer, individual program, MMO offer or business opportunity.</p>
                </article>
      
                <article className="all-feature">
                  <div className="af-icon">🛍</div>
                  <h3>Built-In CPA Offers Marketplace</h3>
                  <p>Choose high-converting in-house CPA offers and connect them to your funnel in a few clicks.</p>
                </article>
      
                <article className="all-feature">
                  <div className="af-icon">↗</div>
                  <h3>Flexible Offer Redirect</h3>
                  <p>Redirect opt-ins to your thank-you page or send them directly to your offer after submission.</p>
                </article>
      
                <article className="all-feature">
                  <div className="af-icon">🛡</div>
                  <h3>Live Email Verification</h3>
                  <p>Check email quality during the opt-in process and reject invalid submissions before acceptance.</p>
                </article>
      
                <article className="all-feature">
                  <div className="af-icon">♻</div>
                  <h3>Duplicate Lead Filtering</h3>
                  <p>Help reduce repeated submissions by checking leads against duplicate rules before delivery.</p>
                </article>
      
                <article className="all-feature">
                  <div className="af-icon">🔍</div>
                  <h3>Fraud & Quality Filtering</h3>
                  <p>Apply campaign-quality checks designed to reduce invalid or suspicious lead submissions.</p>
                </article>
      
                <article className="all-feature">
                  <div className="af-icon">🤖</div>
                  <h3>AI Lead Scoring</h3>
                  <p>Score leads using quality signals so advertisers can better understand potential lead quality.</p>
                </article>
      
                <article className="all-feature">
                  <div className="af-icon">⚙</div>
                  <h3>AI Campaign Optimization</h3>
                  <p>Use campaign data and performance signals to help improve traffic quality and campaign efficiency.</p>
                </article>
      
                <article className="all-feature">
                  <div className="af-icon">✉</div>
                  <h3>In-House Autoresponder</h3>
                  <p>Build and run automated email follow-up sequences directly inside LeadVix.</p>
                </article>
      
                <article className="all-feature">
                  <div className="af-icon">🔗</div>
                  <h3>External Autoresponder Integrations</h3>
                  <p>Connect GetResponse, AWeber, Systeme.io or other supported external email workflows.</p>
                </article>
      
                <article className="all-feature">
                  <div className="af-icon">⌁</div>
                  <h3>Webhook Integration</h3>
                  <p>Send verified lead data into custom systems, CRMs, automations or your own backend workflow.</p>
                </article>
      
                <article className="all-feature">
                  <div className="af-icon">⚡</div>
                  <h3>Real-Time Lead Delivery</h3>
                  <p>Send accepted leads into your autoresponder or connected system as soon as they are verified.</p>
                </article>
      
                <article className="all-feature">
                  <div className="af-icon">📊</div>
                  <h3>Real-Time Campaign Analytics</h3>
                  <p>Monitor leads, CPL, campaign activity and performance from the advertiser dashboard.</p>
                </article>
      
                <article className="all-feature">
                  <div className="af-icon">📈</div>
                  <h3>Lead & Conversion Tracking</h3>
                  <p>Track campaign performance so you can understand which leads and offers are producing results.</p>
                </article>
      
                <article className="all-feature">
                  <div className="af-icon">🧠</div>
                  <h3>Smart Lead Routing</h3>
                  <p>Route accepted leads into the correct campaign, list, integration or follow-up workflow.</p>
                </article>
      
                <article className="all-feature">
                  <div className="af-icon">🧰</div>
                  <h3>All-In-One Advertiser Workflow</h3>
                  <p>Manage funnels, offers, lead buying, verification, follow-up and reporting from one platform.</p>
                </article>
              </div>
            </div>
          </section>
      
          <section className="section" id="marketplace">
            <div className="container split">
              <div className="reveal">
                <div className="eyebrow"><i /> Optional Built-In CPA Marketplace</div>
                <h2 style={{"marginTop":"20px"}}>No Offer Yet?<br /><span className="gradient">Choose One and Start Monetizing Faster.</span></h2>
                <p className="lead">
                  The marketplace is optional. If you already have your own offer, use it. If you don't, LeadVix gives you access to built-in high-converting CPA offers that can be connected to your opt-in funnel in just a few clicks.
                </p>
                <div className="flowline">
                  <span className="flowtag">Choose CPA Offer</span><span className="arrow">→</span>
                  <span className="flowtag">Attach to Funnel</span><span className="arrow">→</span>
                  <span className="flowtag">Launch</span><span className="arrow">→</span>
                  <span className="flowtag">Monetize</span>
                </div>
                <div style={{"marginTop":"27px"}}><Link href="/register" className="btn btn-primary">Access LeadVix Marketplace →</Link></div>
              </div>
      
              <div className="visual-panel reveal">
                <div className="panel-head">
                  <div><small style={{"color":"#8691a5"}}>LEADVIX MARKETPLACE</small><h3>High-Converting CPA Offers</h3></div>
                  <span className="tag">Optional</span>
                </div>
                <div className="offer-grid">
                  <div className="offer"><div className="offer-thumb"></div><b>Online Business Offer</b><small>CPA offer · Active</small><span className="connect">Connect to Funnel →</span></div>
                  <div className="offer"><div className="offer-thumb" style={{"background":"linear-gradient(135deg,#20a9c4,#4582f4)"}}></div><b>AI Marketing Offer</b><small>CPA offer · Active</small><span className="connect">Connect to Funnel →</span></div>
                  <div className="offer"><div className="offer-thumb" style={{"background":"linear-gradient(135deg,#ff8f70,#d94f88)"}}></div><b>Side Hustle Offer</b><small>CPA offer · Active</small><span className="connect">Connect to Funnel →</span></div>
                  <div className="offer"><div className="offer-thumb" style={{"background":"linear-gradient(135deg,#8ab847,#5d8b26)"}}></div><b>Income System Offer</b><small>CPA offer · Active</small><span className="connect">Connect to Funnel →</span></div>
                </div>
              </div>
            </div>
          </section>
      
          <section className="section" id="autoresponder">
            <div className="container split">
              <div className="visual-panel reveal">
                <div className="panel-head">
                  <div><small style={{"color":"#8691a5"}}>IN-HOUSE AUTORESPONDER</small><h3>Automated Follow-Up Sequence</h3></div>
                  <span className="tag" style={{"color":"#16a66d","background":"#ebfbf5","borderColor":"#d7f2e5"}}>LIVE</span>
                </div>
                <div className="email-list">
                  <div className="email-row"><div className="email-no">01</div><div><b>Welcome — Here's What to Do Next</b><small>Immediately after opt-in</small></div><span className="sent">SENT ✓</span></div>
                  <div className="email-row"><div className="email-no">02</div><div><b>Why This System Works Differently</b><small>1 day later</small></div><span className="scheduled">SCHEDULED</span></div>
                  <div className="email-row"><div className="email-no">03</div><div><b>How to Get More From Every Lead</b><small>2 days later</small></div><span className="scheduled">SCHEDULED</span></div>
                  <div className="email-row"><div className="email-no">04</div><div><b>Recommended Offer + CTA</b><small>3 days later</small></div><span className="scheduled">SCHEDULED</span></div>
                </div>
              </div>
      
              <div className="reveal">
                <div className="eyebrow"><i /> Follow Up Inside LeadVix</div>
                <h2 style={{"marginTop":"20px"}}>The Lead Is the Start.<br /><span className="gradient">The Follow-Up Creates More Value.</span></h2>
                <p className="lead">Once the lead is verified, it can enter LeadVix{'\''}s in-house autoresponder automatically. You can also connect GetResponse, AWeber, Systeme.io or your own webhook.</p>
                <div className="flowline">
                  <span className="flowtag">Lead Verified</span><span className="arrow">→</span>
                  <span className="flowtag">Added to List</span><span className="arrow">→</span>
                  <span className="flowtag">Sequence Starts</span><span className="arrow">→</span>
                  <span className="flowtag">Automated Follow-Up</span>
                </div>
                <div style={{"marginTop":"27px"}}><Link href="/register" className="btn btn-primary">Start Using LeadVix →</Link></div>
              </div>
            </div>
          </section>
      
          <section className="section" id="demo">
            <div className="container">
              <div className="section-head reveal">
                <div className="eyebrow"><i /> Product Demo</div>
                <h2>You{'\''}ve Seen the Process.<br /><span className="gradient">Now See the LeadVix Platform in Action.</span></h2>
                <p className="lead">Watch the platform walkthrough to see campaign setup, funnels, integrations and the advertiser workflow inside LeadVix.</p>
              </div>
      
              <div className="demo-shell reveal">
                <div className="demo-frame">
                  <iframe
                    src="https://www.youtube-nocookie.com/embed/723b7GEcZ7o?autoplay=0&controls=1&playsinline=1&rel=0"
                    title="LeadVix Platform Demo"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen></iframe>
                </div>
              </div>
      
              <div className="center" style={{"marginTop":"28px"}}><Link href="/register" className="btn btn-primary">Create My Advertiser Account →</Link></div>
            </div>
          </section>
      
          <section className="section" id="results">
            <div className="container">
              <div className="section-head reveal">
                <div className="eyebrow"><i /> Advertiser Feedback</div>
                <h2>Real Campaign Conversations.<br /><span className="gradient">Real LeadVix Advertiser Feedback.</span></h2>
              </div>
      
              <div className="results-grid stagger">
                <article className="result"><div className="result-img"><img loading="lazy" src="https://leadvix.io/marketing/testimonials/chat-carlos.png" alt="LeadVix advertiser testimonial" /></div><div className="result-cap"><b>Sale from 6 leads</b><span>Individual advertiser result</span></div></article>
                <article className="result"><div className="result-img"><img loading="lazy" src="https://leadvix.io/marketing/testimonials/chat-campaign-update.png" alt="LeadVix campaign update" /></div><div className="result-cap"><b>22 opt-ins → 2 sales</b><span>Individual advertiser result</span></div></article>
                <article className="result"><div className="result-img"><img loading="lazy" src="https://leadvix.io/marketing/testimonials/chat-aditya.png" alt="LeadVix advertiser result" /></div><div className="result-cap"><b>81 leads, sale closed</b><span>Individual advertiser result</span></div></article>
                <article className="result"><div className="result-img"><img loading="lazy" src="https://leadvix.io/marketing/testimonials/chat-chris.png" alt="LeadVix advertiser feedback" /></div><div className="result-cap"><b>Positive lead feedback</b><span>Individual advertiser feedback</span></div></article>
              </div>
      
              <p className="disclaimer">Results shown are individual examples and are not typical or guaranteed. Performance depends on offer, niche, funnel, targeting, budget, follow-up, market conditions and experience.</p>
            </div>
          </section>
      
          <section className="section-sm" style={{"paddingBottom":"0"}}>
            <div className="container">
              <div className="cta reveal">
                <div className="eyebrow"><i /> Your Offer. Your Funnel. Your Leads.</div>
                <h2 style={{"marginTop":"22px"}}>Use Your Own Offer — Or Start With One of Ours.<br /><span className="gradient">LeadVix Handles the Lead Generation Flow.</span></h2>
                <p>
                  Generate verified opt-ins for your own product, affiliate offer, program or business opportunity, or choose a built-in CPA offer.
                  LeadVix connects the opt-in, verification, autoresponder and offer redirect process in one advertiser platform.
                </p>
                <Link href="/register" className="btn btn-primary">Create My LeadVix Account →</Link>
              </div>
            </div>
          </section>
        </main>
      
        <footer>
          <div className="container">
            <div className="footer-top">
              <div className="footer-brand">
                <Link href="/" className="brand"><span className="brandmark">✦</span><span>LeadVix</span></Link>
                <p>AI-powered Pay Per Lead advertising with verified opt-ins, flexible offer support, built-in CPA offers, an in-house autoresponder, funnels, integrations and campaign optimization.</p>
              </div>
              <div className="footer-links">
                <div className="footer-col">
                  <h4>Platform</h4>
                  <a href="#offers">Use Any Offer</a>
                  <a href="#flow">How It Works</a>
                  <a href="#why">Why Pay Per Lead</a>
                  <a href="#marketplace">CPA Marketplace</a>
                  <a href="#autoresponder">Autoresponder</a>
                  <a href="#demo">Demo</a>
                </div>
                <div className="footer-col">
                  <h4>Account</h4>
                  <Link href="/register">Join Now</Link>
                  <Link href="/login">Login</Link>
                </div>
                <div className="footer-col">
                  <h4>Company</h4>
                  <a href="/contact">Contact</a>
                  <a href="/privacy">Privacy Policy</a>
                  <a href="/terms">Terms of Service</a>
                </div>
              </div>
            </div>
      
            <div className="copy">
              <span>© 2026 LeadVix. All rights reserved.</span>
              <span>Lead costs and campaign results vary by niche, targeting, country tier and market conditions.</span>
            </div>
          </div>
        </footer>
      
        
    </div>
  );
}
