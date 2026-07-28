import "./globals.css";
import { getUser } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export const metadata = {
  title: "SourceOne ERP",
  description: "Import / Export Trade Operations",
};

export default function RootLayout({ children }) {
  const user = getUser();
  return (
    <html lang="en">
      <body className="antialiased">
        {user ? (
          <div className="flex h-screen overflow-hidden">
            <Sidebar user={user} />
            <main className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-[1600px] px-8 py-8">{children}</div>
            </main>
          </div>
        ) : (
          <main>{children}</main>
        )}
      </body>
    </html>
  );
}
