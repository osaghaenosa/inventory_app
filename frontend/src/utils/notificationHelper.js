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
  if (Notification.permission === 'denied') return 'denied';

  // iOS 16.4+ in standalone mode uses the same Notification.requestPermission API
  const result = await Notification.requestPermission();
  return result;
}

/**
 * Show a notification. Prefers the Service Worker path so it works on iOS.
 * Falls back to `new Notification()` if SW is unavailable (desktop legacy).
 */
export async function showNotification(title, body, icon = '/icon.svg') {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  // Try Service Worker route first (required for iOS 16.4+)
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        icon,
        badge: icon,
        vibrate: [100, 50, 100],
        tag: 'inventory-notification', // Collapse duplicate notifications
        renotify: true,
      });
      return;
    } catch (e) {
      // SW path failed — fall through to legacy
    }
  }

  // Legacy fallback (works on Android & Desktop, NOT iOS)
  try {
    new Notification(title, { body, icon });
  } catch (e) {
    console.warn('[Notifications] Could not show notification:', e);
  }
}
