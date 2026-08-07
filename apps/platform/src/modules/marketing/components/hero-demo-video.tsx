"use client";

import { useState } from "react";

const DEMO_VIDEO_ID = "_TaHJPGSQ6Q";
const THUMBNAIL_MAXRES = `https://i.ytimg.com/vi/${DEMO_VIDEO_ID}/maxresdefault.jpg`;
const THUMBNAIL_HQ = `https://i.ytimg.com/vi/${DEMO_VIDEO_ID}/hqdefault.jpg`;

export function HeroDemoVideo() {
  const [playing, setPlaying] = useState(false);
  const [thumbSrc, setThumbSrc] = useState(THUMBNAIL_MAXRES);

  return (
    <div className="mockup hero-video">
      <div className="hero-video-frame">
        {playing ? (
          <iframe
            src={`https://www.youtube.com/embed/${DEMO_VIDEO_ID}?autoplay=1&rel=0&modestbranding=1`}
            title="LeadVix demo video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            className="hero-video-poster"
            onClick={() => setPlaying(true)}
            aria-label="Play LeadVix demo video"
          >
            <img
              src={thumbSrc}
              alt=""
              className="hero-video-poster-img"
              onError={() => {
                if (thumbSrc !== THUMBNAIL_HQ) setThumbSrc(THUMBNAIL_HQ);
              }}
            />
            <span className="hero-video-play" aria-hidden>
              <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                <path d="M8 5.14v13.72L19 12 8 5.14z" />
              </svg>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
