import { api } from '../services/api';

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

  const permission = Notification.permission;
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
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Browser ini belum mendukung Web Push Notifications.');
  }

  // 1. Minta izin notifikasi ke pengguna
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Izin notifikasi ditolak. Silakan izinkan notifikasi di pengaturan browser Anda.');
  }

  // 2. Ambil VAPID Public Key dari backend
  const vapidRes = await fetch('/api/push/vapid-public-key');
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
  const subscribeRes = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token') || ''}`
    },
    body: JSON.stringify({
      endpoint: subJson.endpoint,
      p256dh: subJson.keys?.p256dh,
      auth: subJson.keys?.auth,
      user_id: options?.userId,
      role: options?.role,
      device_info: navigator.userAgent
    })
  });

  if (!subscribeRes.ok) {
    const errorData = await subscribeRes.json().catch(() => ({}));
    throw new Error(errorData.message || 'Gagal menyimpan langganan notifikasi di server.');
  }

  if (options?.onSuccess) {
    options.onSuccess();
  }

  return true;
}

/**
 * Berhenti Berlangganan (Unsubscribe) Web Push Notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });
      await subscription.unsubscribe();
    }
    return true;
  } catch (err) {
    console.error('[WebPush] Gagal unsubscribe:', err);
    return false;
  }
}
