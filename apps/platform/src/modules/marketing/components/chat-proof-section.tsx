"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";

const CHATS = [
  {
    src: "/marketing/testimonials/chat-carlos.png",
    alt: "Messenger chat: advertiser gets a sale from only 6 LeadVix leads",
    caption: "Sale from 6 leads",
  },
  {
    src: "/marketing/testimonials/chat-campaign-update.png",
    alt: "Campaign update: 22 opt-ins and 2 OLSP sales on LeadVix",
    caption: "22 opt-ins → 2 sales",
  },
  {
    src: "/marketing/testimonials/chat-aditya.png",
    alt: "Messenger chat: advertiser closes a sale after 81 LeadVix leads",
    caption: "81 leads, sale closed",
  },
  {
    src: "/marketing/testimonials/chat-chris.png",
    alt: "Messenger chat: advertiser loves LeadVix leads and reports more sales",
    caption: "Loving the leads",
  },
] as const;

export function ChatProofSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const open = openIndex !== null;
  const active = openIndex !== null ? CHATS[openIndex] : null;

  const close = useCallback(() => setOpenIndex(null), []);

  const goPrev = useCallback(() => {
    setOpenIndex((i) => (i === null ? i : (i + CHATS.length - 1) % CHATS.length));
  }, []);

  const goNext = useCallback(() => {
    setOpenIndex((i) => (i === null ? i : (i + 1) % CHATS.length));
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close, goPrev, goNext]);

  return (
    <section id="results" className="chat-proof">
      <div className="container">
        <div className="section-title">
          <span className="badge">Client messages</span>
          <h2>Our Clients&apos; Results</h2>
          <p>
            Real messages from advertisers using LeadVix. Results shown are from individual clients
            and may not represent what you will achieve.
          </p>
          <p className="chat-proof-disclaimer">
            <strong>Results not typical.</strong> Individual results vary based on offer, budget,
            funnel, traffic quality, and experience. These chats are testimonials from specific
            clients and are not a guarantee of earnings or sales. LeadVix does not promise income.
          </p>
        </div>

        <div className="chat-proof-grid">
          {CHATS.map((chat, index) => (
            <figure key={chat.src} className="chat-proof-card">
              <button
                type="button"
                className="chat-proof-media-btn"
                aria-label={`View ${chat.caption}`}
                onClick={() => setOpenIndex(index)}
              >
                <span className="chat-proof-media">
                  <Image
                    src={chat.src}
                    alt={chat.alt}
                    width={420}
                    height={760}
                    className="chat-proof-img"
                    sizes="(max-width: 560px) 100vw, (max-width: 900px) 45vw, 220px"
                  />
                </span>
              </button>
              <figcaption className="chat-proof-caption">{chat.caption}</figcaption>
            </figure>
          ))}
        </div>
      </div>

      {open && active ? (
        <div
          className="chat-proof-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Chat screenshot"
        >
          <button
            type="button"
            className="chat-proof-lightbox-backdrop"
            aria-label="Close"
            onClick={close}
          />
          <div className="chat-proof-lightbox-panel">
            <button
              type="button"
              className="chat-proof-lightbox-close"
              aria-label="Close"
              onClick={close}
            >
              ×
            </button>
            <button
              type="button"
              className="chat-proof-lightbox-nav chat-proof-lightbox-prev"
              aria-label="Previous screenshot"
              onClick={goPrev}
            >
              ‹
            </button>
            <div className="chat-proof-lightbox-frame">
              <Image
                src={active.src}
                alt={active.alt}
                width={720}
                height={1280}
                className="chat-proof-lightbox-img"
                sizes="(max-width: 560px) 92vw, 420px"
                priority
              />
            </div>
            <button
              type="button"
              className="chat-proof-lightbox-nav chat-proof-lightbox-next"
              aria-label="Next screenshot"
              onClick={goNext}
            >
              ›
            </button>
            <p className="chat-proof-lightbox-caption">{active.caption}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
