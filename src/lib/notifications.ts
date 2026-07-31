// Notification utilities for PWA

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

export async function subscribeToWebPush(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== "granted") return false;
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function unsubscribeFromWebPush(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return true;
    await fetch("/api/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
    return true;
  } catch {
    return false;
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isNotificationSupported()) return "unsupported";
  const result = await Notification.requestPermission();
  return result;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    return registration;
  } catch {
    console.error("SW registration failed");
    return null;
  }
}

export async function sendLocalNotification(title: string, body: string, url?: string): Promise<void> {
  if (!isNotificationSupported() || Notification.permission !== "granted") return;

  const registration = await navigator.serviceWorker.ready;
  registration.showNotification(title, {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: url || "/today" },
  } as NotificationOptions);
}

export async function scheduleNotification(
  title: string,
  body: string,
  delayMs: number,
  url?: string
): Promise<void> {
  if (!isNotificationSupported() || Notification.permission !== "granted") return;

  const registration = await navigator.serviceWorker.ready;
  if (registration.active) {
    registration.active.postMessage({
      type: "SCHEDULE_NOTIFICATION",
      title,
      body,
      delay: delayMs,
      url: url || "/today",
    });
  }
}
