import "./globals.css";
import { getUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";

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
  // chrome blend into the app instead of banding against it.
  themeColor: "#0A1118",
};

export default function RootLayout({ children }) {
  const user = getUser();
  return (
    <html lang="en">
      <body className="antialiased">
        {user ? (
          <AppShell user={user}>{children}</AppShell>
        ) : (
          <main>{children}</main>
        )}
      </body>
    </html>
  );
}
