/**
 * Browser notifications.
 *
 * expo-notifications has no web implementation worth relying on, so the web build
 * uses the browser's own Notification API and quietly does nothing when it is absent
 * or refused. Same contract as the native file.
 */
export async function requestNotificationPermission(): Promise<void> {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  } catch {
    /* ignored */
  }
}

export async function notify(title: string, body: string): Promise<void> {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  } catch {
    /* ignored */
  }
}
