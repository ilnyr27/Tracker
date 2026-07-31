import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const nowUtc = new Date();
  // Apply timezone offset (default UTC+3 Moscow)
  const tzOffset = parseInt(process.env.TZ_OFFSET || "3");
  const localMs = nowUtc.getTime() + tzOffset * 60 * 60 * 1000;
  const local = new Date(localMs);
  const todayStr = local.toISOString().slice(0, 10);
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  const currentTime = `${hh}:${mm}`;

  // task_templates with reminder_time matching now (HH:MM)
  const { data: templates } = await supabase
    .from("task_templates")
    .select("user_id, title, reminder_time")
    .not("reminder_time", "is", null)
    .like("reminder_time", `${currentTime}%`);

  // Goals with reminder_time matching now
  const { data: goals } = await supabase
    .from("goals")
    .select("user_id, title, reminder_time, reminder_date")
    .not("reminder_time", "is", null)
    .like("reminder_time", `${currentTime}%`)
    .or(`reminder_date.is.null,reminder_date.eq.${todayStr}`);

  const reminders = [
    ...(templates || []).map((t) => ({ user_id: t.user_id, title: t.title })),
    ...(goals || []).map((g) => ({ user_id: g.user_id, title: g.title })),
  ];

  // Deduplicate: same user + same title = one notification
  const seen = new Set<string>();
  const unique = reminders.filter((r) => {
    const key = `${r.user_id}:${r.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length === 0) return NextResponse.json({ sent: 0, time: currentTime, found: 0 });

  let sent = 0;
  let errors = 0;
  for (const reminder of unique) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", reminder.user_id);

    for (const sub of subs || []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: "Life Tracker",
            body: `⏰ ${reminder.title}`,
            url: "/today",
          })
        );
        sent++;
      } catch (err: unknown) {
        errors++;
        // Only remove subscription if endpoint is truly gone (HTTP 410)
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      }
    }
  }

  return NextResponse.json({ sent, errors, time: currentTime, found: unique.length });
}
