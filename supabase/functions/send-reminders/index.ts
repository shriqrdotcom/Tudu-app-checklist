import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import webPush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id: string;
}

interface ReminderRow {
  id: string;
  task_id: string;
  user_id: string;
  project_id: string;
  remind_at: string;
  status: string;
}

interface TaskRow {
  id: string;
  title: string;
  project_id: string;
  is_completed: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  // Verify cron secret - shared secret set in Supabase Vault/Env
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  
  if (!cronSecret || providedSecret !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { 
      status: 401, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;

  if (!supabaseUrl || !serviceRoleKey || !vapidPrivateKey || !vapidPublicKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  webPush.setVapidDetails(
    "mailto:tudu@example.com",
    vapidPublicKey,
    vapidPrivateKey
  );

  try {
    // 1. Find due reminders (status=pending, remind_at <= now)
    const nowIso = new Date().toISOString();
    
    const { data: reminders, error: remError } = await supabase
      .from("task_reminders")
      .select("id, task_id, user_id, project_id, remind_at, status")
      .eq("status", "pending")
      .lte("remind_at", nowIso)
      .limit(100);

    if (remError) throw remError;
    if (!reminders || reminders.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 2. Get task details to verify they still exist and aren't completed
    const taskIds = [...new Set(reminders.map(r => r.task_id))];
    const { data: tasks, error: taskError } = await supabase
      .from("progress_tasks")
      .select("id, title, project_id, is_completed")
      .in("id", taskIds);

    if (taskError) throw taskError;
    
    const activeTaskIds = new Set(
      (tasks || [])
        .filter(t => !t.is_completed)
        .map(t => t.id)
    );

    // Filter reminders to only those for active tasks
    const validReminders = reminders.filter(r => activeTaskIds.has(r.task_id));
    
    if (validReminders.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 3. Get push subscriptions for affected users
    const userIds = [...new Set(validReminders.map(r => r.user_id))];
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, user_id")
      .in("user_id", userIds);

    if (subError) throw subError;

    // Group subscriptions by user
    const subsByUser = new Map<string, PushSubscriptionRow[]>();
    for (const sub of subscriptions || []) {
      const arr = subsByUser.get(sub.user_id) || [];
      arr.push(sub);
      subsByUser.set(sub.user_id, arr);
    }

    // 4. Send notifications
    let sent = 0;
    let failed = 0;
    const toMarkDelivered: string[] = [];
    const endpointsToRemove: string[] = [];

    for (const reminder of validReminders) {
      const userSubs = subsByUser.get(reminder.user_id) || [];
      const task = tasks?.find(t => t.id === reminder.task_id);
      
      if (!task || userSubs.length === 0) {
        // No subscriptions or task not found - still mark delivered to avoid retry
        toMarkDelivered.push(reminder.id);
        continue;
      }

      const title = `TU DU ★ Alert: ${task.title} is due now!`;
      const body = `"${task.title}" was scheduled for ${new Date(reminder.remind_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} and is still pending.`;
      
      const payload = JSON.stringify({
        taskId: task.id,
        projectId: task.project_id,
        title: task.title,
      });

      for (const sub of userSubs) {
        try {
          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
            {
              TTL: 86400, // 24 hours
              headers: {
                "X-Tudu-Task-Id": task.id,
                "X-Tudu-Project-Id": task.project_id,
              },
            }
          );
          sent++;
        } catch (err: any) {
          failed++;
          // Handle gone subscriptions (404/410)
          if (err.statusCode === 404 || err.statusCode === 410) {
            endpointsToRemove.push(sub.endpoint);
          }
        }
      }

      toMarkDelivered.push(reminder.id);
    }

    // 5. Mark reminders as delivered
    if (toMarkDelivered.length > 0) {
      const { error: updError } = await supabase
        .from("task_reminders")
        .update({ status: "delivered", delivered_at: new Date().toISOString() })
        .in("id", toMarkDelivered);
      if (updError) console.error("Failed to mark delivered:", updError);
    }

    // 6. Clean up gone subscriptions
    if (endpointsToRemove.length > 0) {
      const { error: delError } = await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", endpointsToRemove);
      if (delError) console.error("Failed to remove gone subscriptions:", delError);
    }

    return new Response(
      JSON.stringify({ processed: validReminders.length, sent, failed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("send-reminders error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});