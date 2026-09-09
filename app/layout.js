import "./globals.css";
import { cookies } from "next/headers";
import { getUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import { THEME_COOKIE, THEME_BG, serverTheme, normaliseTheme, THEME_BOOT_SCRIPT } from "@/lib/theme";

export const metadata = {
  title: {
    default: "SourceOne ERP",
    // Every page gets "Bookings · SourceOne ERP" without repeating itself.
    template: "%s · SourceOne ERP",
  },
  description: "Import / Export Trade Operations — Source One Ventures NZ Ltd",
  applicationName: "SourceOne ERP",

  // The mark, not a lockup — it renders at 16px in a browser tab.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo-mark.svg", type: "image/svg+xml" },
    ],
    apple: "/logo-mark-256.png",
  },

  // Saved to a phone home screen, this is the name that shows.
  appleWebApp: {
    title: "SourceOne",
    capable: true,
    statusBarStyle: "black-translucent",
  },
};

// width=device-width stops mobile browsers rendering at a fake 980px and
// zooming out. maximumScale is left alone deliberately — blocking pinch-zoom
// on a data-heavy app makes it unusable for anyone who needs to zoom in.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  // Matches the page background so the phone's status bar and the browser
  // chrome blend into the app instead of banding against it. The boot script
  // rewrites this to the theme actually in use — the media queries are only
  // the starting value for the split second before it runs.
  themeColor: [
    { media: "(prefers-color-scheme: dark)",  color: THEME_BG.dark },
    { media: "(prefers-color-scheme: light)", color: THEME_BG.light },
  ],
};

export default function RootLayout({ children }) {
  const user = getUser();

  // The cookie travels with the request, so the very first HTML already
  // carries the right theme. See lib/theme.js for why this isn't localStorage.
  const stored = cookies().get(THEME_COOKIE)?.value;
  const theme = serverTheme(stored);
  // The raw choice ("system" included) goes to the controls, so the toggle
  // shows the right state on its first render instead of correcting itself.
  const choice = normaliseTheme(stored);

  return (
    // suppressHydrationWarning: the boot script may correct this attribute
    // between the server render and hydration — when the choice is "system"
    // and the OS disagrees with the server's guess. That's the mechanism
    // working, not a bug, and React shouldn't complain about it.
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <head>
        {/* Before anything paints. Placed here, not in a component, because a
            component would run after the first paint — which is exactly the
            flash this exists to prevent. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="antialiased">
        {user ? (
          <AppShell user={user} theme={choice}>{children}</AppShell>
        ) : (
          <main>{children}</main>
        )}
      </body>
    </html>
  );
}
