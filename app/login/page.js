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
        {/* The one screen with room for the full lockup. Uses the reversed
            wordmark — the brand navy is 1.46:1 on this background, invisible. */}
        <div className="mb-8 flex flex-col items-center">
          <img
            src="/logo-primary-dark.svg"
            alt="Source One Ventures"
            width={240}
            height={185}
            className="w-[220px] max-w-full"
            // eslint-disable-next-line @next/next/no-img-element
          />
          <p className="mt-3 text-xs uppercase tracking-widest text-ink-400">
            Import · Export · Trade
          </p>
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
