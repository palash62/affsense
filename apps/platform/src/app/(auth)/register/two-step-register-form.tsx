"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Inter } from "next/font/google";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { isStrongPassword } from "@/lib/password-policy";
import { COUNTRY_BY_CODE, getCountryName } from "@/lib/campaign-form";
import { readReferralCookie, writeReferralCookie } from "@/lib/referral";
import {
  metaUserDataFromSignup,
  trackSignupLead,
} from "@/lib/tracking/public-page-tracking";
import "./two-step-register.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

const COUNTRY_OPTIONS = Object.keys(COUNTRY_BY_CODE).sort((a, b) =>
  getCountryName(a).localeCompare(getCountryName(b)),
);

const HEARD_FROM = [
  "Facebook",
  "YouTube",
  "Google Search",
  "Telegram",
  "Email",
  "Friend / Referral",
  "Affiliate Community / Forum",
  "Existing Affsense Member",
  "Other",
] as const;

const EXPERIENCE = [
  "New",
  "Under 6 months",
  "6-12 months",
  "1-3 years",
  "3+ years",
  "Agency/Team",
] as const;

const PROMOTION_GOALS = ["Digital Products", "CPA Offers", "Both"] as const;

const TRAFFIC_METHODS = [
  "Email Marketing",
  "Facebook Ads",
  "Google Ads",
  "Native Ads",
  "Push Ads",
  "Solo Ads",
  "SEO / Website",
  "YouTube",
  "Facebook Organic",
  "Instagram",
  "TikTok",
  "Pinterest",
  "Telegram",
  "Influencer / Creator",
  "Other",
] as const;

const MONTHLY_TRAFFIC = [
  "Just starting",
  "Under 1,000",
  "1,000–10,000",
  "10,000–50,000",
  "50,000–100,000",
  "100,000+",
] as const;

export function TwoStepRegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [trafficError, setTrafficError] = useState(false);
  const [contactError, setContactError] = useState(false);
  const [referralRef, setReferralRef] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [heardFrom, setHeardFrom] = useState("");
  const [experience, setExperience] = useState("");
  const [promotionGoal, setPromotionGoal] = useState("");
  const [trafficMethods, setTrafficMethods] = useState<string[]>([]);
  const [currentNetworks, setCurrentNetworks] = useState("");
  const [monthlyTraffic, setMonthlyTraffic] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [promotionPlan, setPromotionPlan] = useState("");
  const [telegram, setTelegram] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [trafficPolicy, setTrafficPolicy] = useState(false);
  const [terms, setTerms] = useState(false);

  useEffect(() => {
    const fromUrl = searchParams.get("referral_by") ?? searchParams.get("ref") ?? "";
    const ref = fromUrl.trim() || readReferralCookie();
    if (fromUrl.trim()) writeReferralCookie(fromUrl.trim());
    setReferralRef(ref);
  }, [searchParams]);

  function toggleTraffic(method: string) {
    setTrafficMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method],
    );
  }

  function goNext() {
    setError("");
    setPasswordMismatch(false);

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !country || !username.trim()) {
      setError("Please complete all required account fields.");
      return;
    }
    if (!isStrongPassword(password)) {
      setError(
        "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.",
      );
      return;
    }
    if (password !== confirmPassword) {
      setPasswordMismatch(true);
      return;
    }
    setStep(2);
    window.scrollTo(0, 0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setTrafficError(false);
    setContactError(false);

    let ok = true;
    if (trafficMethods.length === 0) {
      setTrafficError(true);
      ok = false;
    }
    if (!telegram.trim() && !whatsapp.trim() && !facebookUrl.trim()) {
      setContactError(true);
      ok = false;
    }
    if (!heardFrom || !experience || !promotionGoal || !promotionPlan.trim() || promotionPlan.trim().length < 20) {
      setError("Please complete all required affiliate profile fields.");
      ok = false;
    }
    if (!trafficPolicy || !terms) {
      setError("Please accept the traffic policy and terms to continue.");
      ok = false;
    }
    if (!ok) return;

    setLoading(true);
    const name = `${firstName.trim()} ${lastName.trim()}`.trim();

    const res = await fetch("/api/v1/auth/register/publisher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email: email.trim().toLowerCase(),
        password,
        username: username.trim(),
        country,
        website: websiteUrl.trim() || undefined,
        phone: whatsapp.trim() || undefined,
        referralRef: referralRef.trim() || undefined,
        trafficSource: trafficMethods.join(", "),
        applicationProfile: {
          heardFrom,
          experience,
          promotionGoal,
          trafficMethods,
          currentNetworks: currentNetworks.trim() || null,
          monthlyTraffic: monthlyTraffic || null,
          promotionPlan: promotionPlan.trim(),
          telegram: telegram.trim() || null,
          whatsapp: whatsapp.trim() || null,
          facebookUrl: facebookUrl.trim() || null,
        },
      }),
    });

    const data = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok) {
      setError(data?.error?.message ?? "Registration failed");
      return;
    }

    const userId = typeof data?.user?.id === "string" ? data.user.id : undefined;
    trackSignupLead({
      eventID: userId,
      contentName: "PublisherSignup",
      contentCategory: "PUBLISHER",
      userData: metaUserDataFromSignup({
        email,
        name,
        country,
        phone: whatsapp.trim() || undefined,
      }),
    });

    router.push("/login?registered=publisher-verify");
  }

  return (
    <div className={`tsrPage ${inter.variable}`}>
      <aside className="tsrLeft">
        <Link href="/" className="tsrLogo">
          Aff<i>sense</i>
        </Link>
        <div className="tsrHero">
          <span className="tsrTag">● FREE AFFSENSE MEMBER ACCOUNT</span>
          <h1>
            Join Free.
            <br />
            <span className="tsrGrad">Tell Us How You Promote.</span>
          </h1>
          <p>
            Create your account, then tell us about your affiliate experience and traffic. This helps
            us protect advertisers and review CPA access.
          </p>
          <div className="tsrSideSteps">
            <div className={`tsrSideStep${step === 1 ? " on" : ""}`}>
              <span className="tsrSideNum">1</span>
              <div>
                <b>Create Your Account</b>
                <small>Basic member and login information</small>
              </div>
            </div>
            <div className={`tsrSideStep${step === 2 ? " on" : ""}`}>
              <span className="tsrSideNum">2</span>
              <div>
                <b>Affiliate Profile</b>
                <small>Experience, traffic and contact information</small>
              </div>
            </div>
          </div>
          <div className="tsrNote">
            Your membership is free. CPA access can be reviewed separately based on your profile,
            traffic methods and advertiser requirements.
          </div>
        </div>
        <div className="tsrFoot">© Affsense • Secure member registration</div>
      </aside>

      <main className="tsrRight">
        <div className="tsrWrap">
          <Link href="/" className="tsrLogo tsrMobile">
            Aff<i>sense</i>
          </Link>
          <div className="tsrTop">
            Already registered?{" "}
            <Link href="/login">Sign in →</Link>
          </div>

          <div className="tsrProgress">
            <div className="tsrPhead">
              <span>{step === 1 ? "STEP 1 OF 2 — ACCOUNT" : "STEP 2 OF 2 — AFFILIATE PROFILE"}</span>
              <span>{step === 1 ? "50%" : "100%"}</span>
            </div>
            <div className="tsrBar">
              <div className={`tsrFill${step === 2 ? " done" : ""}`} />
            </div>
          </div>

          {referralRef.trim() ? (
            <div className="tsrReferral">
              You were invited with referral code <strong>{referralRef.toUpperCase()}</strong>.
            </div>
          ) : null}

          {error ? <div className="tsrAlert">{error}</div> : null}

          <form onSubmit={handleSubmit}>
            <section className={`tsrStep${step === 1 ? " on" : ""}`}>
              <h2>Create your free account</h2>
              <div className="tsrSub">
                Start with your basic member information. No signup fee or credit card required.
              </div>

              <div className="tsrGrid2">
                <div className="tsrField">
                  <label>
                    First Name <span className="tsrReq">*</span>
                  </label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    autoComplete="given-name"
                    required
                  />
                </div>
                <div className="tsrField">
                  <label>
                    Last Name <span className="tsrReq">*</span>
                  </label>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    autoComplete="family-name"
                    required
                  />
                </div>
              </div>

              <div className="tsrField">
                <label>
                  Email Address <span className="tsrReq">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="tsrGrid2">
                <div className="tsrField">
                  <label>
                    Country <span className="tsrReq">*</span>
                  </label>
                  <select value={country} onChange={(e) => setCountry(e.target.value)} required>
                    <option value="">Select country</option>
                    {COUNTRY_OPTIONS.map((code) => (
                      <option key={code} value={code}>
                        {getCountryName(code)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="tsrField">
                  <label>
                    Username <span className="tsrReq">*</span>
                  </label>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose username"
                    autoComplete="username"
                    minLength={3}
                    maxLength={40}
                    pattern="[a-zA-Z0-9_]+"
                    required
                  />
                </div>
              </div>

              <div className="tsrGrid2">
                <div className="tsrField">
                  <label>
                    Password <span className="tsrReq">*</span>
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  {password.length > 0 ? (
                    <div className="tsrPwHints">
                      <PasswordRequirements password={password} />
                    </div>
                  ) : null}
                </div>
                <div className="tsrField">
                  <label>
                    Confirm Password <span className="tsrReq">*</span>
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  {passwordMismatch ? (
                    <div className="tsrErr">Passwords do not match.</div>
                  ) : null}
                </div>
              </div>

              <div className="tsrButtons">
                <button className="tsrBtn tsrNext" type="button" onClick={goNext}>
                  Continue to Affiliate Profile →
                </button>
              </div>
            </section>

            <section className={`tsrStep${step === 2 ? " on" : ""}`}>
              <h2>Your affiliate profile</h2>
              <div className="tsrSub">
                Help us understand how you plan to promote offers. CPA access may remain pending until
                reviewed.
              </div>

              <div className="tsrField">
                <label>
                  Where did you hear about Affsense? <span className="tsrReq">*</span>
                </label>
                <select value={heardFrom} onChange={(e) => setHeardFrom(e.target.value)} required>
                  <option value="">Select one</option>
                  {HEARD_FROM.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <span className="tsrLabel">
                Affiliate marketing experience <span className="tsrReq">*</span>
              </span>
              <div className="tsrOptions">
                {EXPERIENCE.map((item) => (
                  <div className="tsrChoice" key={item}>
                    <input
                      id={`exp-${item}`}
                      type="radio"
                      name="experience"
                      checked={experience === item}
                      onChange={() => setExperience(item)}
                      required
                    />
                    <label htmlFor={`exp-${item}`}>
                      {item === "New" ? "I'm New" : item === "Agency/Team" ? "Agency / Team" : item === "6-12 months" ? "6–12 Months" : item === "1-3 years" ? "1–3 Years" : item === "3+ years" ? "3+ Years" : item === "Under 6 months" ? "Under 6 Months" : item}
                    </label>
                  </div>
                ))}
              </div>

              <span className="tsrLabel">
                What do you want to promote? <span className="tsrReq">*</span>
              </span>
              <div className="tsrOptions">
                {PROMOTION_GOALS.map((item) => (
                  <div className="tsrChoice" key={item}>
                    <input
                      id={`goal-${item}`}
                      type="radio"
                      name="promotion_goal"
                      checked={promotionGoal === item}
                      onChange={() => setPromotionGoal(item)}
                      required
                    />
                    <label htmlFor={`goal-${item}`}>{item}</label>
                  </div>
                ))}
              </div>

              <span className="tsrLabel">
                Traffic methods <span className="tsrReq">*</span> — select all that apply
              </span>
              <div className="tsrChecks">
                {TRAFFIC_METHODS.map((item) => (
                  <div className="tsrCheck" key={item}>
                    <input
                      id={`traffic-${item}`}
                      type="checkbox"
                      checked={trafficMethods.includes(item)}
                      onChange={() => toggleTraffic(item)}
                    />
                    <label htmlFor={`traffic-${item}`}>{item}</label>
                  </div>
                ))}
              </div>
              {trafficError ? (
                <div className="tsrErr">Select at least one traffic method.</div>
              ) : null}

              <div className="tsrGrid2">
                <div className="tsrField">
                  <label>Current Affiliate Networks</label>
                  <input
                    value={currentNetworks}
                    onChange={(e) => setCurrentNetworks(e.target.value)}
                    placeholder="ClickBank, WarriorPlus, etc."
                  />
                </div>
                <div className="tsrField">
                  <label>Estimated Monthly Traffic</label>
                  <select
                    value={monthlyTraffic}
                    onChange={(e) => setMonthlyTraffic(e.target.value)}
                  >
                    <option value="">Select range</option>
                    {MONTHLY_TRAFFIC.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="tsrField">
                <label>Website / Main Traffic Source URL</label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://yourwebsite.com or channel/profile URL"
                />
              </div>

              <div className="tsrField">
                <label>
                  How do you plan to promote Affsense offers? <span className="tsrReq">*</span>
                </label>
                <textarea
                  value={promotionPlan}
                  onChange={(e) => setPromotionPlan(e.target.value)}
                  minLength={20}
                  required
                  placeholder="Tell us briefly about your audience, traffic and promotion plan..."
                />
              </div>

              <div className="tsrContact">
                <label>Contact & Social Profiles</label>
                <p>
                  Provide at least one contact method so our team can reach you regarding application
                  review. Never provide passwords.
                </p>
                <div className="tsrGrid2">
                  <div className="tsrField">
                    <label>Telegram Username</label>
                    <input
                      value={telegram}
                      onChange={(e) => setTelegram(e.target.value)}
                      placeholder="@username"
                    />
                  </div>
                  <div className="tsrField">
                    <label>WhatsApp Number</label>
                    <input
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="+1 555 123 4567"
                    />
                  </div>
                </div>
                <div className="tsrField">
                  <label>Facebook Profile URL</label>
                  <input
                    type="url"
                    value={facebookUrl}
                    onChange={(e) => setFacebookUrl(e.target.value)}
                    placeholder="https://facebook.com/yourprofile"
                  />
                </div>
                {contactError ? (
                  <div className="tsrErr">Provide at least one contact method.</div>
                ) : null}
              </div>

              <label className="tsrPolicy">
                <input
                  type="checkbox"
                  checked={trafficPolicy}
                  onChange={(e) => setTrafficPolicy(e.target.checked)}
                  required
                />
                <span>
                  I will follow offer traffic rules and will not use bots, fake leads, unauthorized
                  incentives, deceptive claims, self-conversions, spam or prohibited methods.
                </span>
              </label>

              <label className="tsrPolicy">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                  required
                />
                <span>
                  I agree to the <a href="/termsofservice.html">Terms</a>,{" "}
                  <a href="/privacy.html">Privacy Policy</a> and{" "}
                  <a href="/termsofservice.html">Affiliate Terms</a>. My contact information may be
                  used for application review and support.
                </span>
              </label>

              <div className="tsrButtons">
                <button
                  className="tsrBtn tsrBack"
                  type="button"
                  onClick={() => {
                    setStep(1);
                    window.scrollTo(0, 0);
                  }}
                >
                  ← Back
                </button>
                <button className="tsrBtn tsrNext" type="submit" disabled={loading}>
                  {loading ? "Creating account..." : "Create Free Account →"}
                </button>
              </div>
            </section>
          </form>
        </div>
      </main>
    </div>
  );
}
