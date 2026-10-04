/**
 * Push notification registration.
 *
 * CampusFlow's notification service records the device token against the signed-in user, so push,
 * in-app and websocket delivery all refer to the same notification rows. Registration is
 * best-effort: Expo Go, simulators and web cannot always mint a token, and the app must keep
 * working without one (the notification centre reads `GET /me/notifications`).
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { accountApi } from './api';

type NotificationsModule = typeof import('expo-notifications');
const PUSH_TOKEN_KEY = 'campusflow.push-token';

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

async function loadNotifications(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web' || isExpoGo()) return null;

  const notifications = await import('expo-notifications');
  notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
  return notifications;
}

export async function unregisterForPush(): Promise<void> {
  let token: string | null = null;
  try {
    token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
    if (token) await accountApi.unregisterDevice(token);
  } finally {
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY).catch(() => undefined);
  }
}

export async function registerForPush(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;

    const Notifications = await loadNotifications();
    if (!Notifications) return null;

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'CampusFlow',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4340e0',
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    await accountApi.registerDevice({
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      device_name: Device.modelName ?? undefined,
    });
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
    return token;
  } catch {
    // Silent by design: a missing push token never blocks the app.
    return null;
  }
}
