import { getUser } from "@/lib/auth";
import { renderPoPdf } from "@/lib/po-document";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  if (!getUser()) return new Response("Unauthorized", { status: 401 });

  const doc = await renderPoPdf(params.id);
  if (!doc) return new Response("Purchase order not found", { status: 404 });

  return new Response(doc.pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
