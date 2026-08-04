/**
 * Minimal WhatsApp Cloud API (Meta) sender. Sends a plain text message to the
 * owner's number. Note: outside the 24h customer-service window, Meta only
 * allows pre-approved *template* messages — for a reliable nightly push you'll
 * typically register a template and switch this to a `template` payload. Plain
 * text is kept here for simplicity + testing; see README "WhatsApp setup".
 */
export type WhatsAppResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string };

export async function sendWhatsAppText(
  to: string,
  body: string
): Promise<WhatsAppResult> {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    return { ok: false, error: "WhatsApp env vars are not configured." };
  }

  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body },
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      messages?: Array<{ id: string }>;
      error?: { message?: string };
    };

    if (!res.ok) {
      return {
        ok: false,
        error: data?.error?.message ?? `WhatsApp API returned ${res.status}`,
      };
    }

    return { ok: true, id: data?.messages?.[0]?.id ?? null };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown WhatsApp error",
    };
  }
}
