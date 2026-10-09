const TASK_NOTIFICATION_ROUTE = "/(tabs)/tasks";

export const resolveNotificationRoute = (route) => {
  if (typeof route !== "string") return null;

  const normalized = route.trim();
  if (!normalized.startsWith("/")) return null;

  // Older task notifications used a backend-style resource URL that does not
  // exist in Expo Router. Send every task notification to the Tasks tab.
  if (
    normalized === "/field-officer/tasks" ||
    normalized.startsWith("/field-officer/tasks/") ||
    normalized === "/tasks" ||
    normalized.startsWith("/tasks/")
  ) {
    return TASK_NOTIFICATION_ROUTE;
  }

  return normalized;
};

