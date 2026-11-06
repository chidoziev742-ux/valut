import assert from "node:assert/strict";
import test from "node:test";
import {
  formatNotificationDate,
  formatUnreadNotificationCount,
  allowedNotificationDestinations,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notificationApi.js";
import { getRoute } from "../../routeConfig.js";

const welcome = {
  id: "notification-1",
  title: "Welcome to Vaultori",
  message: "Add profile information if you like.",
  source: "system",
  category: "welcome",
  isRead: false,
  readAt: null,
  actionDestination: "/settings#account-info",
  createdAt: "2026-11-06T11:00:00.000Z",
};

test("loads persisted notifications from the authenticated endpoint and validates response shapes", async () => {
  const notifications = await listNotifications(async (path) => {
    assert.equal(path, "/api/student/notifications");
    return {
      notifications: [
        welcome,
        { ...welcome, id: "notification-2", source: "personal", actionDestination: null },
        { ...welcome, id: "notification-3", source: "admin", actionDestination: null },
      ],
    };
  });
  assert.deepEqual(notifications.map(({ source }) => source), ["system", "personal", "admin"]);
  await assert.rejects(listNotifications(async () => ({ notifications: [{ ...welcome, source: "unknown" }] })), /invalid notification data/i);
  await assert.rejects(listNotifications(async () => ({
    notifications: [{ ...welcome, actionDestination: "https://example.com" }],
  })), /invalid notification data/i);
});

test("loads and validates the unread count", async () => {
  assert.equal(await getUnreadNotificationCount(async (path) => {
    assert.equal(path, "/api/student/notifications/unread-count");
    return { unreadCount: 6 };
  }), 6);
  await assert.rejects(getUnreadNotificationCount(async () => ({ unreadCount: -1 })), /invalid unread notification count/i);
});

test("marks one notification read with PATCH and the session CSRF token", async () => {
  const read = { ...welcome, isRead: true, readAt: "2026-11-06T11:05:00.000Z" };
  assert.deepEqual(await markNotificationRead("id/with/slash", "csrf", async (path, options) => {
    assert.equal(path, "/api/student/notifications/id%2Fwith%2Fslash/read");
    assert.deepEqual(options, { method: "PATCH", csrfToken: "csrf" });
    return { notification: read };
  }), read);
});

test("marks all notifications read with PATCH and validates the server confirmation", async () => {
  assert.equal(await markAllNotificationsRead("csrf", async (path, options) => {
    assert.equal(path, "/api/student/notifications/read-all");
    assert.deepEqual(options, { method: "PATCH", csrfToken: "csrf" });
    return { updatedCount: 4 };
  }), 4);
  await assert.rejects(markAllNotificationsRead("csrf", async () => ({ updatedCount: "4" })), /invalid notification update count/i);
});

test("propagates notification API failures", async () => {
  const failure = new Error("Request failed");
  await assert.rejects(listNotifications(async () => { throw failure; }), failure);
  await assert.rejects(getUnreadNotificationCount(async () => { throw failure; }), failure);
  await assert.rejects(markNotificationRead("notification-1", "csrf", async () => { throw failure; }), failure);
  await assert.rejects(markAllNotificationsRead("csrf", async () => { throw failure; }), failure);
});

test("formats unread badge counts including zero and the 99+ cap", () => {
  assert.equal(formatUnreadNotificationCount(0), "");
  assert.equal(formatUnreadNotificationCount(1), "1");
  assert.equal(formatUnreadNotificationCount(99), "99");
  assert.equal(formatUnreadNotificationCount(100), "99+");
});

test("formats notification timestamps and handles invalid dates", () => {
  assert.notEqual(formatNotificationDate(welcome.createdAt), "Date unavailable");
  assert.equal(formatNotificationDate("not-a-date"), "Date unavailable");
});

test("welcome action resolves through the existing Settings route and anchor", () => {
  assert.equal(allowedNotificationDestinations.has("/settings#account-info"), true);
  assert.equal(getRoute("/settings")?.path, "/settings");
  assert.equal(getRoute("/settings")?.kind, "student");
});
