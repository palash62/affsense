import { Inter } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { PublicPageTrackingScripts } from "@/components/tracking/public-page-tracking-scripts";
import { PlatformPixelRouteTracker } from "@/components/tracking/platform-pixel-route-tracker";
import { TawkToChat } from "@/components/tracking/tawk-to-chat";
import { getSession } from "@/lib/session";
import { getPublicPlatformPixelConfig } from "@/services/platform-pixel-settings.service";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata = {
  title: "LeadVix",
  description: "Cost Per Lead marketplace for advertisers and publishers",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [session, pixelConfig] = await Promise.all([
    getSession(),
    getPublicPlatformPixelConfig(),
  ]);
  const hasTracking = Boolean(pixelConfig.meta || pixelConfig.googleAds);

  return (
    <html lang="en" className={inter.variable} data-theme="slate-pro" suppressHydrationWarning>
      <body className="bg-background font-sans antialiased">
        {hasTracking ? <PublicPageTrackingScripts config={pixelConfig} /> : null}
        {pixelConfig.meta ? <PlatformPixelRouteTracker /> : null}
        <TawkToChat />
        <ThemeProvider>
          <AuthProvider session={session}>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
