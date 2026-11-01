/**
 * Recommendation-Ranked Social Feed Studio
 * Saved / Bookmarked Posts Controller
 */

import { getCurrentUser, requireAuth } from "./auth.js";
import { initFirebase } from "./firebase-config.js";
import { getAllPosts } from "./posts.js";
import { getLocalCollection, formatRelativeTime, escapeHtml, showToast } from "./utils.js";
import { toggleSavePost } from "./interactions.js";

export async function initSavedPostsPage() {
  if (!requireAuth()) return;
  const user = getCurrentUser();

  const container = document.getElementById("saved-posts-container");
  const countBadge = document.getElementById("saved-count-badge");
  if (!container) return;

  container.innerHTML = `<div class="loading-spinner-container"><div class="spinner"></div><p>Loading bookmarks...</p></div>`;

  try {
    const allPosts = await getAllPosts();
    let savedPostIds = new Set();

    const { isLive, db, firebaseModules } = await initFirebase();
    if (isLive && db && firebaseModules) {
      try {
        const { collection, getDocs, query, where } = firebaseModules.firestoreModule;
        const q = query(collection(db, "savedPosts"), where("userId", "==", user.uid));
        const snap = await getDocs(q);
        snap.forEach(doc => {
          const data = doc.data();
          if (data && data.postId) savedPostIds.add(data.postId);
        });
      } catch (err) {
        console.warn("Could not query savedPosts from Firestore, checking local storage:", err);
      }
    }

    if (savedPostIds.size === 0) {
      const savedRecords = getLocalCollection("savedPosts").filter(s => s.userId === user.uid);
      savedRecords.forEach(s => savedPostIds.add(s.postId));
    }

    const savedPosts = allPosts.filter(p => savedPostIds.has(p.postId));

    if (countBadge) countBadge.textContent = `${savedPosts.length} saved`;

    if (savedPosts.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-icon">🔖</div>
          <h3>No Saved Posts Yet</h3>
          <p>When you discover interesting posts in your feed, tap the bookmark icon to save them here for quick study and reference.</p>
          <a href="feed.html" class="btn btn-primary" style="margin-top: 1rem;">Explore Feed</a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="saved-posts-grid">
        ${savedPosts.map(post => `
          <div class="saved-card" id="saved-card-${post.postId}">
            <div class="saved-header">
              <img src="${post.author.profileImage}" alt="${post.author.name}" class="avatar-sm">
              <div class="saved-author-info">
                <strong>${escapeHtml(post.author.name)}</strong>
                <span>@${escapeHtml(post.author.username)} • ${formatRelativeTime(post.createdAt)}</span>
              </div>
              <button class="btn-icon btn-remove-save" data-id="${post.postId}" title="Remove bookmark">✕</button>
            </div>
            <div class="saved-content">
              <p>${escapeHtml(post.content)}</p>
              ${post.imageUrl ? `<img src="${post.imageUrl}" class="saved-image" alt="Post attachment">` : ''}
            </div>
            <div class="saved-footer">
              <div class="saved-metrics">
                <span>❤️ ${post.likesCount || 0}</span>
                <span>💬 ${post.commentsCount || 0}</span>
                <span>🔄 ${post.sharesCount || 0}</span>
              </div>
              <a href="feed.html#post-${post.postId}" class="btn btn-sm btn-outline">View in Feed</a>
            </div>
          </div>
        `).join("")}
      </div>
    `;

    // Bind remove bookmark events
    container.querySelectorAll(".btn-remove-save").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const postId = btn.getAttribute("data-id");
        await toggleSavePost(postId);
        const card = document.getElementById(`saved-card-${postId}`);
        if (card) {
          card.classList.add("fade-out");
          setTimeout(() => {
            card.remove();
            const remaining = container.querySelectorAll(".saved-card").length;
            if (countBadge) countBadge.textContent = `${remaining} saved`;
            if (remaining === 0) initSavedPostsPage();
          }, 300);
        }
      });
    });

  } catch (err) {
    console.error("Error loading saved posts:", err);
    container.innerHTML = `<div class="error-state-card"><p>Failed to load saved posts.</p></div>`;
  }
}
