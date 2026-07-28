import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth";
import { NextResponse } from "next/server";
export async function POST() {
  cookies().delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
