import { apiBaseUrl, readSession } from '../services/api';

/**
 * Konversi VAPID Public Key base64 string ke Uint8Array (standar Web Push RFC 8292)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface PushStatus {
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
}

/**
 * Cek status dukungan Web Push Notifications di perangkat browser
 */
export async function checkPushSubscriptionStatus(): Promise<PushStatus> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return {
      supported: false,
      permission: 'default',
      subscribed: false
    };
  }

  const permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return {
      supported: true,
      permission,
      subscribed: subscription !== null
    };
  } catch (err) {
    return {
      supported: true,
      permission,
      subscribed: false
    };
  }
}

/**
 * Berlangganan (Subscribe) Web Push Notifications
 */
export async function subscribeToPushNotifications(options?: {
  userId?: number;
  role?: string;
  onSuccess?: () => void;
  onError?: (err: Error) => void;
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Browser ini belum mendukung Web Push Notifications.');
  }

  // 1. Minta izin notifikasi ke pengguna jika belum diberikan
  let permission = Notification.permission;
  if (permission !== 'granted') {
    permission = await Notification.requestPermission();
  }

  if (permission !== 'granted') {
    throw new Error('Izin notifikasi ditolak. Silakan izinkan notifikasi di pengaturan browser atau aplikasi HP Anda.');
  }

  const baseUrl = apiBaseUrl();
  const session = readSession();
  const token = session?.token || '';
  const currentUserId = options?.userId ?? session?.id;
  const currentRole = options?.role ?? session?.role;

  // 2. Ambil VAPID Public Key dari backend
  const vapidRes = await fetch(`${baseUrl}/push/vapid-public-key`, {
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (!vapidRes.ok) {
    throw new Error('Gagal mengambil kunci VAPID dari server.');
  }
  const { publicKey } = await vapidRes.json();
  if (!publicKey) {
    throw new Error('Kunci VAPID publik belum diset di server.');
  }

  const applicationServerKey = urlBase64ToUint8Array(publicKey);

  // 3. Daftarkan PushSubscription di browser
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as any
    });
  }

  const subJson = subscription.toJSON();

  // 4. Kirim subscription ke backend untuk disimpan di database
  const subscribeRes = await fetch(`${baseUrl}/push/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({
      endpoint: subJson.endpoint,
      p256dh: subJson.keys?.p256dh,
      auth: subJson.keys?.auth,
      user_id: currentUserId,
      role: currentRole,
      device_info: navigator.userAgent
    })
  });

  if (!subscribeRes.ok) {
    const errorData = await subscribeRes.json().catch(() => ({}));
    throw new Error(errorData.message || 'Gagal menyimpan langganan notifikasi di server.');
  }

  // Clear initial badge
  clearAppBadge();

  if (options?.onSuccess) {
    options.onSuccess();
  }

  return true;
}

/**
 * Otomatis pastikan perangkat terdaftar (auto-sync) jika izin notifikasi sudah 'granted'
 */
export async function ensurePushSubscribed(options?: {
  userId?: number;
  role?: string;
}): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      return false;
    }

    if (Notification.permission !== 'granted') {
      return false;
    }

    return await subscribeToPushNotifications(options);
  } catch (err) {
    console.warn('[WebPush] Auto-subscribe silent notice:', err);
    return false;
  }
}

/**
 * Berhenti Berlangganan (Unsubscribe) Web Push Notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    const baseUrl = apiBaseUrl();
    const session = readSession();
    const token = session?.token || '';

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await fetch(`${baseUrl}/push/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });
      await subscription.unsubscribe();
    }

    clearAppBadge();
    return true;
  } catch (err) {
    console.error('[WebPush] Gagal unsubscribe:', err);
    return false;
  }
}

/**
 * Kirim uji coba notifikasi push ke perangkat saat ini
 */
export async function sendTestPushNotification(options?: {
  userId?: number;
  title?: string;
  body?: string;
}): Promise<{ success: boolean; message: string }> {
  const baseUrl = apiBaseUrl();
  const session = readSession();
  const token = session?.token || '';

  let endpoint: string | undefined;
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      endpoint = sub?.endpoint;
    } catch {}
  }

  const res = await fetch(`${baseUrl}/push/send-test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({
      endpoint,
      user_id: options?.userId ?? session?.id,
      title: options?.title || 'Uji Notifikasi Qomaruddin 🔔',
      body: options?.body || 'Alhamdulillah, sistem notifikasi real-time Pondok Qomaruddin berhasil terhubung ke HP Anda!',
      badge_count: 1
    })
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Gagal mengirim uji notifikasi');
  }

  return json;
}

/**
 * 🏷️ APP BADGING API (Angka kecil notifikasi di sudut ikon aplikasi HP Xiaomi / Android / iOS)
 */
export function updateAppBadge(count: number = 1): void {
  if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
    try {
      navigator.setAppBadge(Math.max(1, count)).catch(() => {});
    } catch {}
  }
}

export function clearAppBadge(): void {
  if (typeof navigator !== 'undefined' && 'clearAppBadge' in navigator) {
    try {
      navigator.clearAppBadge().catch(() => {});
    } catch {}
  }
}
