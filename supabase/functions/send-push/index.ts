import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PushRequestBody {
  recipient_id?: string;
  recipient_ids?: string[];
  title?: string;
  body?: string;
  card_key?: string;
  url?: string;
}

interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:danieldiaz@azzorti.com";

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ ok: false, error: "Missing Supabase environment variables" }, 500);
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      return jsonResponse(
        { ok: false, skipped: true, reason: "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not configured" },
        200
      );
    }

    const reqBody = (await req.json().catch(() => ({}))) as PushRequestBody;
    const recipientIds: string[] = [];
    if (typeof reqBody.recipient_id === "string" && reqBody.recipient_id.trim()) {
      recipientIds.push(reqBody.recipient_id.trim());
    }
    if (Array.isArray(reqBody.recipient_ids)) {
      for (const id of reqBody.recipient_ids) {
        const trimmed = String(id || "").trim();
        if (trimmed && !recipientIds.includes(trimmed)) {
          recipientIds.push(trimmed);
        }
      }
    }

    if (recipientIds.length === 0) {
      return jsonResponse({ ok: false, error: "recipient_id is required" }, 400);
    }

    const title = (reqBody.title || "Cronograma AGLAB").trim();
    const body = (reqBody.body || "Tienes una actualización en el calendario.").trim();
    const cardKey = (reqBody.card_key || "").trim();
    const url = reqBody.url || (cardKey ? `./index.html?card=${encodeURIComponent(cardKey)}` : "./index.html");

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: subscriptions, error: fetchError } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", recipientIds);

    if (fetchError) {
      return jsonResponse({ ok: false, error: fetchError.message }, 500);
    }

    const rows = (subscriptions ?? []) as PushSubscriptionRow[];
    if (rows.length === 0) {
      return jsonResponse({ ok: true, sent: 0, expiredRemoved: 0, totalSubscriptions: 0 }, 200);
    }

    const notificationPayload = JSON.stringify({
      title,
      body,
      card_key: cardKey,
      url,
    });

    const expiredIds: string[] = [];
    let sentCount = 0;

    const results = await Promise.allSettled(
      rows.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            notificationPayload,
            { TTL: 86400 }
          );
          sentCount++;
        } catch (err: unknown) {
          const statusCode =
            typeof err === "object" && err !== null && "statusCode" in err
              ? Number((err as { statusCode?: number }).statusCode)
              : 0;
          if (statusCode === 410 || statusCode === 404) {
            expiredIds.push(sub.id);
          } else {
            console.warn("Web Push delivery error for subscription", sub.id, err);
          }
        }
      })
    );

    if (expiredIds.length > 0) {
      const { error: cleanupError } = await supabase
        .from("push_subscriptions")
        .delete()
        .in("id", expiredIds);
      if (cleanupError) {
        console.warn("Failed removing expired push subscriptions:", cleanupError.message);
      }
    }

    return jsonResponse(
      {
        ok: true,
        sent: sentCount,
        attempted: results.length,
        expiredRemoved: expiredIds.length,
        totalSubscriptions: rows.length,
      },
      200
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
