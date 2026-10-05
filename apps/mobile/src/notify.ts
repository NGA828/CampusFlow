import * as Notifications from 'expo-notifications';

/**
 * Time-sensitive guidance on a phone.
 *
 * Local notifications, not a push service: everything CampusFlow has to say right now
 * — your position is fixed, your room request was answered — is already known on the
 * device. A push server would add infrastructure without adding information. The
 * notification handler shows banners even while the app is in the foreground, because
 * these messages are about where the student is standing.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

export async function requestNotificationPermission(): Promise<void> {
  try {
    await Notifications.requestPermissionsAsync();
  } catch {
    /* a refused permission must never stop the app from starting */
  }
}

export async function notify(title: string, body: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
  } catch {
    /* notifications are a courtesy, never a dependency */
  }
}
