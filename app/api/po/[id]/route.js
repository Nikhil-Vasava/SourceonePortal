import { getUser, canHandlePurchaseOrders } from "@/lib/auth";
import { renderPoPdf } from "@/lib/po-document";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  const user = getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  // The document prints prices, so reading it is a commercial permission —
  // not merely being signed in. Hiding the button would not have stopped
  // anyone typing this URL.
  if (!canHandlePurchaseOrders(user)) return new Response("Forbidden", { status: 403 });

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
