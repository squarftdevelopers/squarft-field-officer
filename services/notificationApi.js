import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveNotificationRoute } from './notificationNavigation';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.0.107:3001';
const FIELD_OFFICER_NOTIFICATIONS_PATH = '/api/field-officer/notifications';

async function request(path, token, options = {}) {
  const authToken = token || await AsyncStorage.getItem('authToken');

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options.headers,
    },
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Notification request failed (${response.status})`);
  }

  if (!response.ok) {
    throw new Error(data.message || 'Notification request failed');
  }

  return data;
}

export const notificationApi = {
  // In-App Notifications
  list: (token, page = 1, limit = 20) =>
    request(`${FIELD_OFFICER_NOTIFICATIONS_PATH}?page=${page}&limit=${limit}`, token),

  getUnreadCount: (token) =>
    request(`${FIELD_OFFICER_NOTIFICATIONS_PATH}/unread-count`, token),

  markRead: (token, id) =>
    request(`${FIELD_OFFICER_NOTIFICATIONS_PATH}/${encodeURIComponent(id)}/read`, token, {
      method: 'PATCH',
    }),

  markAllRead: (token) =>
    request(`${FIELD_OFFICER_NOTIFICATIONS_PATH}/read-all`, token, {
      method: 'PATCH',
    }),

  // Push Tokens
  registerPushToken: (token, payload) =>
    request(`${FIELD_OFFICER_NOTIFICATIONS_PATH}/device-tokens`, token, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  unregisterPushToken: (token, payload) =>
    request(`${FIELD_OFFICER_NOTIFICATIONS_PATH}/device-tokens/deactivate`, token, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};

const notificationTypeByEvent = (eventKey = '') => {
  if (eventKey.includes('MEETING') || eventKey.includes('FOLLOW_UP')) return 'visit';
  if (eventKey.includes('PROJECT') || eventKey.includes('ONBOARDING')) return 'inventory';
  if (eventKey.includes('KYC') || eventKey.includes('APPROVED')) return 'success';
  if (eventKey.includes('REJECTED') || eventKey.includes('FAILED')) return 'error';
  return 'default';
};

export const mapNotificationResponse = (response) => {
  const records = response?.data?.notifications;
  if (!Array.isArray(records)) return [];

  return records.map((notification) => ({
    id: notification.id,
    title: notification.title,
    description: notification.body,
    watched: String(notification.status).toUpperCase() === 'READ',
    target: resolveNotificationRoute(notification.route),
    type: notificationTypeByEvent(notification.eventKey),
    time: notification.createdAt
      ? new Date(notification.createdAt).toLocaleString([], {
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit',
        })
      : 'Recently',
  }));
};
