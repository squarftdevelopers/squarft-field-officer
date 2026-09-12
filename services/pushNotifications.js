import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationApi } from './notificationApi';

const FIELD_OFFICER_APP_KEY = 'field_officer_app';
const DEVICE_ID_KEY = 'squarft_field_officer_push_device_id';

let lastRegisteredToken = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const getStableDeviceId = async () => {
  try {
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = `fo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return `fo-${Date.now()}`;
  }
};

const getProjectId = () =>
  Constants.easConfig?.projectId ||
  Constants.expoConfig?.extra?.eas?.projectId ||
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
  '47957612-4b27-42fc-8ce2-14f8b16c8313';

const ensureAndroidNotificationChannel = async () => {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('field-alerts', {
    name: 'Field Officer Alerts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#EF4444',
    sound: 'default',
  });
};

const requestNotificationPermissions = async () => {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return existing;
  return Notifications.requestPermissionsAsync();
};

export const registerForPushNotificationsAsync = async (authToken) => {
  if (!authToken || Platform.OS === 'web') return null;

  if (Constants.isDevice === false) {
    console.log('[PushNotifications] Push requires physical device');
    return null;
  }

  try {
    await ensureAndroidNotificationChannel();

    const permissions = await requestNotificationPermissions();
    if (permissions.status !== 'granted') {
      console.warn('[PushNotifications] Permission not granted:', permissions.status);
      return null;
    }

    const projectId = getProjectId();
    if (!projectId) {
      console.warn('[PushNotifications] Missing Expo projectId');
      return null;
    }

    const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (!expoPushToken || expoPushToken === lastRegisteredToken) {
      return expoPushToken || null;
    }

    const deviceId = await getStableDeviceId();

    await notificationApi.registerPushToken(authToken, {
      appKey: FIELD_OFFICER_APP_KEY,
      expoPushToken,
      platform: Platform.OS,
      deviceId,
    });

    lastRegisteredToken = expoPushToken;
    console.log('[PushNotifications] Registered field officer push token successfully');
    return expoPushToken;
  } catch (err) {
    console.warn('[PushNotifications] Registration error:', err.message);
    return null;
  }
};
