// Notification utilities for PWA

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
