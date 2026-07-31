import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { sign, getUser, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

async function login(formData) {
  "use server";
  const email = formData.get("email");
  const password = formData.get("password");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active || !bcrypt.compareSync(password, user.password)) {
    redirect("/login?error=1");
  }
  cookies().set(
    SESSION_COOKIE,
    sign({ id: user.id, name: user.name, role: user.role, region: user.region }),
    sessionCookieOptions
  );
  redirect("/");
}

export default function LoginPage({ searchParams }) {
  if (getUser()) redirect("/");
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center px-4">
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-teal-500 shadow-glow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#04212a"
                 strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 18c1.6 0 1.6 1.4 3.2 1.4S7.8 18 9.4 18s1.6 1.4 3.2 1.4S14.2 18 15.8 18s1.6 1.4 3.2 1.4" />
              <path d="M4.8 14.4 12 12l7.2 2.4-1.1 3.1H5.9z" />
              <path d="M12 12V6.4M8.8 8.8h6.4" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">SourceOne ERP</h1>
          <p className="mt-1 text-xs uppercase tracking-widest text-ink-400">Import · Export · Trade</p>
        </div>

        <form action={login} className="card p-7">
          {searchParams?.error && (
            <div className="alert-error mb-5 py-2 text-sm">
              Invalid email or password
            </div>
          )}
          <div className="mb-4">
            <span className="label">Email</span>
            <input name="email" type="email" required className="input" defaultValue="admin@sourceone.com" />
          </div>
          <div className="mb-6">
            <span className="label">Password</span>
            <input name="password" type="password" required className="input" placeholder="••••••••" />
          </div>
          <button className="btn w-full py-2.5">Sign in</button>
        </form>

        <p className="mt-5 text-center text-2xs text-ink-500">
          Demo · admin@sourceone.com / admin123
        </p>
      </div>
    </div>
  );
}
