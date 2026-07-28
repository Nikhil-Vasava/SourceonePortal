import "./globals.css";
import { getUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";

export const metadata = {
  title: "SourceOne ERP",
  description: "Import / Export Trade Operations",
};

// width=device-width stops mobile browsers rendering at a fake 980px and
// zooming out. maximumScale is left alone deliberately — blocking pinch-zoom
// on a data-heavy app makes it unusable for anyone who needs to zoom in.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
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
