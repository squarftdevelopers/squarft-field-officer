import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.0.107:3001';

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
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.message || 'Notification request failed');
  }

  return data;
}

export const notificationApi = {
  // In-App Notifications
  list: (token, page = 1, limit = 20) =>
    request(`/api/v1/field-officer/notifications?page=${page}&limit=${limit}`, token),

  getUnreadCount: (token) =>
    request('/api/v1/field-officer/notifications/unread-count', token),

  markRead: (token, id) =>
    request(`/api/v1/field-officer/notifications/${encodeURIComponent(id)}/read`, token, {
      method: 'PATCH',
    }),

  markAllRead: (token) =>
    request('/api/v1/field-officer/notifications/read-all', token, {
      method: 'PATCH',
    }),

  // Push Tokens
  registerPushToken: (token, payload) =>
    request('/api/v1/push-tokens/register', token, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  unregisterPushToken: (token, payload) =>
    request('/api/v1/push-tokens/register', token, {
      method: 'DELETE',
      body: JSON.stringify(payload),
    }),
};
