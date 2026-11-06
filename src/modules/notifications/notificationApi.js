import { apiRequest } from "../../api/apiClient.js";

const endpoint = "/api/student/notifications";
const allowedSources = new Set(["system", "personal", "admin"]);
export const allowedNotificationDestinations = new Set(["/profile", "/settings#account-info"]);

function isNotification(notification) {
  return notification
    && typeof notification === "object"
    && typeof notification.id === "string"
    && typeof notification.title === "string"
    && typeof notification.message === "string"
    && allowedSources.has(notification.source)
    && typeof notification.category === "string"
    && typeof notification.isRead === "boolean"
    && (notification.readAt === null || typeof notification.readAt === "string")
    && (notification.actionDestination === null
      || allowedNotificationDestinations.has(notification.actionDestination))
    && typeof notification.createdAt === "string";
}

function requireNotification(payload) {
  if (!isNotification(payload?.notification)) {
    throw new Error("The server returned invalid notification data.");
  }
  return payload.notification;
}

export async function listNotifications(request = apiRequest) {
  const payload = await request(endpoint);
  if (!Array.isArray(payload?.notifications) || payload.notifications.some((item) => !isNotification(item))) {
    throw new Error("The server returned invalid notification data.");
  }
  return payload.notifications;
}

export async function getUnreadNotificationCount(request = apiRequest) {
  const payload = await request(`${endpoint}/unread-count`);
  if (!Number.isSafeInteger(payload?.unreadCount) || payload.unreadCount < 0) {
    throw new Error("The server returned an invalid unread notification count.");
  }
  return payload.unreadCount;
}

export async function markNotificationRead(notificationId, csrfToken, request = apiRequest) {
  return requireNotification(await request(
    `${endpoint}/${encodeURIComponent(notificationId)}/read`,
    { method: "PATCH", csrfToken },
  ));
}

export async function markAllNotificationsRead(csrfToken, request = apiRequest) {
  const payload = await request(`${endpoint}/read-all`, {
    method: "PATCH",
    csrfToken,
  });
  if (!Number.isSafeInteger(payload?.updatedCount) || payload.updatedCount < 0) {
    throw new Error("The server returned an invalid notification update count.");
  }
  return payload.updatedCount;
}

export async function deleteNotification(notificationId, csrfToken, request = apiRequest) {
  const payload = await request(`${endpoint}/${encodeURIComponent(notificationId)}`, {
    method: "DELETE",
    csrfToken,
  });
  if (payload?.deletedId !== notificationId || typeof payload.wasUnread !== "boolean") {
    throw new Error("The server returned an invalid notification deletion response.");
  }
  return payload;
}

export function formatUnreadNotificationCount(count) {
  if (!Number.isSafeInteger(count) || count <= 0) return "";
  return count > 99 ? "99+" : String(count);
}

export function formatNotificationDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
