/**
 * WhatsApp Cloud API (Meta) sender.
 *
 * Two send paths, because Meta treats them differently:
 *   - `sendWhatsAppText`     — free-form text. Only delivers inside the 24h
 *                              customer-service window (owner messaged the
 *                              business number recently). Good for testing.
 *   - `sendWhatsAppTemplate` — a pre-approved *template* message. The only
 *                              thing Meta lets you send to a user who hasn't
 *                              messaged you recently — i.e. the nightly 7pm
 *                              push. See README "WhatsApp setup".
 *
 * The cron prefers the template when one is configured and falls back to text.
 */
export type WhatsAppResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string };

const GRAPH_VERSION = "v21.0";

function graphUrl(phoneNumberId: string): string {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;
}

// Shared POST + response parsing for both send paths.
async function postMessage(payload: Record<string, unknown>): Promise<WhatsAppResult> {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    return { ok: false, error: "WhatsApp env vars are not configured." };
  }

  try {
    const res = await fetch(graphUrl(phoneNumberId), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
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

/**
 * Meta rejects template parameters that contain newlines, tabs, or runs of 4+
 * spaces. Flatten to a single clean line so a multi-line summary survives as a
 * body parameter.
 */
export function sanitizeTemplateParam(s: string): string {
  return s.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

/** Free-form text message (24h-window only). */
export async function sendWhatsAppText(
  to: string,
  body: string
): Promise<WhatsAppResult> {
  return postMessage({
    recipient_type: "individual",
    to,
    type: "text",
    text: { preview_url: false, body },
  });
}

/**
 * Pre-approved template message. `bodyParams` fill the template's {{1}}, {{2}}…
 * body placeholders in order; each is sanitized to a single line. Pass `[]` for
 * a template with no parameters.
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[]
): Promise<WhatsAppResult> {
  const components =
    bodyParams.length > 0
      ? [
          {
            type: "body",
            parameters: bodyParams.map((p) => ({
              type: "text",
              text: sanitizeTemplateParam(p),
            })),
          },
        ]
      : [];

  return postMessage({
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components.length > 0 ? { components } : {}),
    },
  });
}
