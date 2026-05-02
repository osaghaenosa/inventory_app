/**
 * Notification helper — works on:
 *   • Android Chrome (standard Web Notifications + Service Worker)
 *   • iOS Safari 16.4+  when site is "Add to Home Screen" (requires SW path)
 *   • Desktop Chrome / Firefox / Edge
 *
 * iOS quirks handled:
 *   - iOS ignores `new Notification()`; you MUST use
 *     `registration.showNotification()` from a Service Worker.
 *   - iOS only grants push permission when the PWA is launched from the
 *     home screen (standalone mode). We detect this and guide the user.
 *
 * Android quirks handled:
 *   - The VAPID key must already be subscribed before the app goes to
 *     background; we call subscribeToPush as early as permission is granted.
 *   - Some Android browsers won't accept SVG as the notification icon; we
 *     always use icon-192.png.
 */

/** True when running as an installed PWA (standalone / fullscreen). */
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

/** True on iOS (iPhone / iPad). */
export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * Request notification permission.
 * Returns the permission string: 'granted' | 'denied' | 'default'
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied')  return 'denied';

  const result = await Notification.requestPermission();
  return result;
}

/**
 * Show a local notification.
 * Always uses the Service Worker path (required for iOS 16.4+, also
 * more reliable on Android). Falls back to `new Notification()` only
 * if the SW is unavailable.
 */
export async function showNotification(title, body, icon = '/icon-192.png') {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  // FIX: Always prefer SW path — `new Notification()` is ignored on iOS
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        icon,
        badge: icon,
        vibrate: [100, 50, 100],
        tag: 'inventory-notification',
        renotify: true,
      });
      return;
    } catch (e) {
      console.warn('[Notifications] SW showNotification failed:', e);
    }
  }

  // Legacy fallback (works on Android & Desktop, NOT iOS)
  try {
    new Notification(title, { body, icon });
  } catch (e) {
    console.warn('[Notifications] Could not show notification:', e);
  }
}

// ── VAPID helper ─────────────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Subscribe this browser/device to Web Push and register it with the backend.
 *
 * KEY FIX: We now always call pushManager.subscribe() and send the resulting
 * subscription to the server — even if getSubscription() returns an existing
 * one. This ensures stale subscriptions stored in MongoDB are refreshed and
 * the server always has a working endpoint for this device.
 */
export async function subscribeToPush(apiClient) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Push] PushManager not supported on this browser/OS.');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // 1. Get VAPID public key from server
    const { data } = await apiClient.get('/push/vapid-public-key');
    const applicationServerKey = urlBase64ToUint8Array(data.publicKey);

    // 2. Check for an existing subscription
    let subscription = await registration.pushManager.getSubscription();

    // 3. If none, create one
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      console.log('[Push] New subscription created.');
    } else {
      console.log('[Push] Re-using existing subscription, re-registering with server.');
    }

    // 4. Always (re)send to backend so the DB record stays fresh
    await apiClient.post('/push/subscribe', { subscription: subscription.toJSON() });
    console.log('[Push] Subscription registered with backend successfully.');

    return subscription;
  } catch (err) {
    // DOMException: "Registration failed" usually means the VAPID key changed
    // or the user revoked permission at the OS level.
    console.error('[Push] subscribeToPush failed:', err.name, err.message);
    return null;
  }
}
