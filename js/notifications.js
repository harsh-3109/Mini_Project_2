/**
 * Recommendation-Ranked Social Feed Studio
 * Notifications Module
 */

import { initFirebase } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";
import { generateId, getLocalCollection, saveLocalCollection, formatRelativeTime, escapeHtml } from "./utils.js";

/**
 * Create a new notification
 */
export async function createNotification({ recipientId, senderId, type, postId = null, message }) {
  if (!recipientId || recipientId === senderId) return;

  const notification = {
    notificationId: generateId("notif"),
    recipientId,
    senderId,
    type, // 'like', 'comment', 'follow', 'system'
    postId,
    message,
    isRead: false,
    createdAt: new Date().toISOString()
  };

  const { isLive, db, firebaseModules } = await initFirebase();

  if (isLive && db && firebaseModules) {
    try {
      const { doc, setDoc } = firebaseModules.firestoreModule;
      await setDoc(doc(db, "notifications", notification.notificationId), notification);
    } catch (e) {
      console.warn("Could not save live notification:", e);
    }
  } else {
    const list = getLocalCollection("notifications");
    list.unshift(notification);
    saveLocalCollection("notifications", list);
  }

  updateNavbarNotificationBadge();
}

/**
 * Fetch all notifications for current user
 */
export async function getUserNotifications() {
  const user = getCurrentUser();
  if (!user) return [];

  const { isLive, db, firebaseModules } = await initFirebase();
  let notifs = [];

  if (isLive && db && firebaseModules) {
    try {
      const { collection, getDocs, query, where, orderBy } = firebaseModules.firestoreModule;
      const q = query(
        collection(db, "notifications"),
        where("recipientId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      snap.forEach(d => notifs.push({ notificationId: d.id, ...d.data() }));
    } catch (e) {
      notifs = getLocalCollection("notifications").filter(n => n.recipientId === user.uid);
    }
  } else {
    notifs = getLocalCollection("notifications").filter(n => n.recipientId === user.uid);
  }

  return notifs;
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(notificationId) {
  const { isLive, db, firebaseModules } = await initFirebase();

  if (isLive && db && firebaseModules) {
    try {
      const { doc, updateDoc } = firebaseModules.firestoreModule;
      await updateDoc(doc(db, "notifications", notificationId), { isRead: true });
    } catch (e) {
      //
    }
  } else {
    const list = getLocalCollection("notifications");
    const idx = list.findIndex(n => n.notificationId === notificationId);
    if (idx !== -1) {
      list[idx].isRead = true;
      saveLocalCollection("notifications", list);
    }
  }

  updateNavbarNotificationBadge();
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead() {
  const user = getCurrentUser();
  if (!user) return;

  const notifs = await getUserNotifications();
  for (const n of notifs) {
    if (!n.isRead) {
      await markNotificationAsRead(n.notificationId);
    }
  }
  updateNavbarNotificationBadge();
}

/**
 * Render and update notification bell indicator in the navbar
 */
export async function updateNavbarNotificationBadge() {
  const badgeEl = document.getElementById("navbar-notif-badge");
  const bellContainer = document.getElementById("navbar-notif-container");
  if (!badgeEl) return;

  const notifs = await getUserNotifications();
  const unreadCount = notifs.filter(n => !n.isRead).length;

  if (unreadCount > 0) {
    badgeEl.textContent = unreadCount > 9 ? "9+" : unreadCount;
    badgeEl.style.display = "flex";
  } else {
    badgeEl.style.display = "none";
  }

  // Populate dropdown list if container exists
  const listEl = document.getElementById("navbar-notif-list");
  if (listEl) {
    if (notifs.length === 0) {
      listEl.innerHTML = `<div class="notif-empty"><p>No notifications yet</p></div>`;
    } else {
      listEl.innerHTML = notifs.slice(0, 8).map(n => `
        <div class="notif-item ${n.isRead ? 'read' : 'unread'}" data-id="${n.notificationId}">
          <div class="notif-icon notif-type-${n.type}">
            ${n.type === 'like' ? '❤️' : n.type === 'comment' ? '💬' : n.type === 'follow' ? '👤' : '✨'}
          </div>
          <div class="notif-content">
            <p class="notif-text">${escapeHtml(n.message)}</p>
            <span class="notif-time">${formatRelativeTime(n.createdAt)}</span>
          </div>
        </div>
      `).join("");

      // Add click listener to mark read
      listEl.querySelectorAll(".notif-item").forEach(item => {
        item.addEventListener("click", async () => {
          const id = item.getAttribute("data-id");
          await markNotificationAsRead(id);
          item.classList.remove("unread");
          item.classList.add("read");
        });
      });
    }
  }
}
