// @vitest-environment jsdom

import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTORESPONDER_ANNOUNCEMENT_DISMISSED_KEY,
  AutoresponderAnnouncementBanner,
  dismissAutoresponderAnnouncement,
  isAutoresponderAnnouncementDismissed,
} from "@/components/advertiser/autoresponder-announcement-banner";

vi.mock("@/components/ui/button-link", () => ({
  ButtonLink: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => createElement("a", { href, className }, children),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    "aria-label": ariaLabel,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    "aria-label"?: string;
  }) => createElement("button", { type: "button", onClick, "aria-label": ariaLabel }, children),
}));

describe("autoresponder announcement storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts not dismissed", () => {
    expect(isAutoresponderAnnouncementDismissed()).toBe(false);
  });

  it("persists dismiss in localStorage", () => {
    dismissAutoresponderAnnouncement();
    expect(localStorage.getItem(AUTORESPONDER_ANNOUNCEMENT_DISMISSED_KEY)).toBe("1");
    expect(isAutoresponderAnnouncementDismissed()).toBe(true);
  });
});

describe("AutoresponderAnnouncementBanner", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  async function renderBanner() {
    await act(async () => {
      root.render(createElement(AutoresponderAnnouncementBanner));
    });
  }

  it("renders title and primary CTA link to /advertiser/email", async () => {
    await renderBanner();

    expect(document.body.textContent).toContain("Autoresponder is now available");
    expect(document.querySelector('a[href="/advertiser/email"]')).toBeTruthy();
    expect(document.querySelector('a[href="/advertiser/email/wallet"]')).toBeTruthy();
  });

  it("dismiss hides banner and sets localStorage key", async () => {
    await renderBanner();

    const dismissButton = document.querySelector(
      'button[aria-label="Dismiss announcement"]',
    ) as HTMLButtonElement;
    expect(dismissButton).toBeTruthy();

    await act(async () => {
      dismissButton.click();
    });

    expect(localStorage.getItem(AUTORESPONDER_ANNOUNCEMENT_DISMISSED_KEY)).toBe("1");
    expect(document.body.textContent).not.toContain("Autoresponder is now available");
  });

  it("does not render when already dismissed", async () => {
    localStorage.setItem(AUTORESPONDER_ANNOUNCEMENT_DISMISSED_KEY, "1");
    await renderBanner();

    expect(document.body.textContent).not.toContain("Autoresponder is now available");
  });
});
