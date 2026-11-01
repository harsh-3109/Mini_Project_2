/**
 * Recommendation-Ranked Social Feed Studio
 * Main Dashboard Controller
 * 
 * Computes real mathematical metrics from actual database collections
 * including real imported Instagram media.
 */

import { initAuth, getCurrentUser, requireAuth } from "./auth.js";
import { getAllPosts } from "./posts.js";
import { getActiveWeights } from "./feed.js";
import { getInstagramConnection, getImportedInstagramMedia } from "./instagram.js";
import { 
  getLocalCollection, 
  formatRelativeTime, 
  formatCount, 
  escapeHtml 
} from "./utils.js";
import { updateNavbarNotificationBadge } from "./notifications.js";
import { calculateEngagementScore } from "./algorithm.js";

/**
 * Initialize Dashboard
 */
export async function initDashboardPage() {
  if (!requireAuth()) return;
  await initAuth();
  updateNavbarNotificationBadge();

  const user = getCurrentUser();
  const allPosts = await getAllPosts();
  const follows = getLocalCollection("follows");
  const interactions = getLocalCollection("userInteractions");
  const likes = getLocalCollection("likes");
  const comments = getLocalCollection("comments");
  const weights = getActiveWeights();

  renderWelcomeHeader(user);
  await renderInstagramStatusBanner(user);
  await renderMetricCounters(user, allPosts, follows, likes, comments);
  renderAlgorithmSummary(weights);
  renderTrendingPosts(allPosts);
  renderRecentActivity(interactions, allPosts);
}

function renderWelcomeHeader(user) {
  if (!user) return;
  const welcomeEl = document.getElementById("dashboard-welcome-name");
  const usernameEl = document.getElementById("dashboard-welcome-username");
  const emailEl = document.getElementById("dashboard-welcome-email");
  const avatarEl = document.getElementById("dash-user-avatar");
  const verifBadge = document.getElementById("dash-email-status-badge");

  const displayName = user.fullName || user.name || "Studio Creator";
  if (welcomeEl) welcomeEl.textContent = displayName;
  if (usernameEl) usernameEl.textContent = `@${user.username || 'creator'}`;
  if (emailEl) emailEl.textContent = user.email || '';
  if (avatarEl) {
    avatarEl.src = user.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`;
    avatarEl.alt = displayName;
  }

  if (verifBadge) {
    if (user.emailVerified) {
      verifBadge.className = "badge-success";
      verifBadge.style.background = "#d1fae5";
      verifBadge.style.color = "#065f46";
      verifBadge.textContent = "✓ Email Verified";
    } else {
      verifBadge.className = "badge-warning";
      verifBadge.style.background = "#fef3c7";
      verifBadge.style.color = "#92400e";
      verifBadge.textContent = "● Email Unverified";
    }
  }
}

async function renderInstagramStatusBanner(user) {
  const titleEl = document.getElementById("dash-ig-status-title");
  const descEl = document.getElementById("dash-ig-status-desc");
  const actionBtn = document.getElementById("dash-ig-action-btn");

  if (!user || !titleEl) return;

  const conn = await getInstagramConnection(user.uid);
  if (conn && conn.connectionStatus === "connected") {
    titleEl.textContent = `Instagram Connected: @${conn.instagramUsername}`;
    descEl.textContent = `Account Type: ${conn.accountType || 'Professional'} • Last Synced: ${conn.lastSyncAt ? formatRelativeTime(conn.lastSyncAt) : 'Ready to sync'}`;
    if (actionBtn) {
      actionBtn.textContent = "Manage Connection";
      actionBtn.className = "btn btn-outline btn-sm";
    }
  } else if (conn && conn.connectionStatus === "token_expired") {
    titleEl.textContent = `Instagram Connection: Token Expired`;
    descEl.textContent = `Your 60-day token has expired. Re-authenticate to resume syncing media.`;
    if (actionBtn) {
      actionBtn.textContent = "Reconnect Now";
      actionBtn.className = "btn btn-instagram-connect btn-sm";
    }
  } else {
    titleEl.textContent = "Instagram Connection: Disconnected";
    descEl.textContent = "Connect your Instagram Professional account to rank your real Instagram media alongside community content.";
    if (actionBtn) {
      actionBtn.textContent = "Connect Account";
      actionBtn.className = "btn btn-instagram-connect btn-sm";
    }
  }
}

async function renderMetricCounters(user, allPosts, follows, likes, comments) {
  const totalPostsCount = allPosts.length;
  const myPosts = allPosts.filter(p => p.authorId === user.uid);
  const myLikesReceived = myPosts.reduce((acc, p) => acc + (p.likesCount || 0), 0);

  const followingCount = follows.filter(f => f.followerId === user.uid).length;
  const followersCount = follows.filter(f => f.followingId === user.uid).length;

  const totalLikesInSystem = allPosts.reduce((acc, p) => acc + (p.likesCount || 0), 0);
  const avgLikesPerPost = totalPostsCount > 0 ? (totalLikesInSystem / totalPostsCount).toFixed(1) : "0";

  // Fetch real Instagram imported posts count
  const igMedia = user ? await getImportedInstagramMedia(user.uid) : [];
  const igCount = igMedia.length;

  const elIgPosts = document.getElementById("stat-imported-ig-posts");
  const elTotalPosts = document.getElementById("stat-total-posts");
  const elMyLikes = document.getElementById("stat-likes-received");
  const elFollowing = document.getElementById("stat-following-count");
  const elAvgLikes = document.getElementById("stat-avg-likes");

  if (elIgPosts) elIgPosts.textContent = igCount;
  if (elTotalPosts) elTotalPosts.textContent = totalPostsCount;
  if (elMyLikes) elMyLikes.textContent = myLikesReceived;
  if (elFollowing) elFollowing.textContent = followingCount;
  if (elAvgLikes) elAvgLikes.textContent = avgLikesPerPost;
}

function renderAlgorithmSummary(weights) {
  const elRecency = document.getElementById("dash-weight-recency");
  const elEngagement = document.getElementById("dash-weight-engagement");
  const elAffinity = document.getElementById("dash-weight-affinity");
  const elBar = document.getElementById("dash-formula-bar");

  if (elRecency) elRecency.textContent = `${weights.recencyWeight}%`;
  if (elEngagement) elEngagement.textContent = `${weights.engagementWeight}%`;
  if (elAffinity) elAffinity.textContent = `${weights.affinityWeight}%`;

  if (elBar) {
    elBar.innerHTML = `
      <div class="seg-recency" style="width: ${weights.recencyWeight}%">R: ${weights.recencyWeight}%</div>
      <div class="seg-engagement" style="width: ${weights.engagementWeight}%">E: ${weights.engagementWeight}%</div>
      <div class="seg-affinity" style="width: ${weights.affinityWeight}%">A: ${weights.affinityWeight}%</div>
    `;
  }
}

function renderTrendingPosts(allPosts) {
  const container = document.getElementById("dash-trending-posts");
  if (!container) return;

  const sorted = [...allPosts].sort((a, b) => {
    const scoreB = calculateEngagementScore(b);
    const scoreA = calculateEngagementScore(a);
    return scoreB - scoreA;
  });

  const top3 = sorted.slice(0, 3);

  if (top3.length === 0) {
    container.innerHTML = `<p class="empty-subtext">No trending posts yet.</p>`;
    return;
  }

  container.innerHTML = top3.map((post, idx) => `
    <div class="dash-trending-card">
      <div class="trending-rank-num">#${idx + 1}</div>
      <div class="trending-info">
        <div class="trending-meta">
          <strong>${escapeHtml(post.author?.name || 'Creator')}</strong>
          <span>• ${formatRelativeTime(post.createdAt)}</span>
        </div>
        <p class="trending-text">${escapeHtml(post.content.substring(0, 85))}...</p>
        <div class="trending-stats">
          <span>❤️ ${post.likesCount || 0}</span>
          <span>💬 ${post.commentsCount || 0}</span>
          <span>🔄 ${post.sharesCount || 0}</span>
        </div>
      </div>
      <a href="feed.html#post-${post.postId}" class="btn btn-xs btn-outline">Inspect</a>
    </div>
  `).join("");
}

function renderRecentActivity(interactions, allPosts) {
  const container = document.getElementById("dash-recent-activity");
  if (!container) return;

  const recentActs = [...interactions].reverse().slice(0, 6);

  if (recentActs.length === 0) {
    container.innerHTML = `<p class="empty-subtext">No recent platform interactions recorded yet. Like or comment on a post to see activity appear here!</p>`;
    return;
  }

  const postsMap = new Map();
  allPosts.forEach(p => postsMap.set(p.postId, p));

  container.innerHTML = recentActs.map(act => {
    const post = postsMap.get(act.postId);
    const actionLabel = act.interactionType === "like" ? "liked a post"
      : act.interactionType === "comment" ? "commented on a post"
      : act.interactionType === "share" ? "shared a post"
      : act.interactionType === "follow" ? "followed a creator"
      : "interacted";

    return `
      <div class="activity-row">
        <span class="activity-icon ${act.interactionType}">
          ${act.interactionType === 'like' ? '❤️' : act.interactionType === 'comment' ? '💬' : act.interactionType === 'share' ? '🔄' : '👤'}
        </span>
        <div class="activity-details">
          <p class="activity-text">
            User <strong>${actionLabel}</strong>
            ${post ? `: <em>"${escapeHtml(post.content.substring(0, 35))}..."</em>` : ''}
          </p>
          <span class="activity-time">${formatRelativeTime(act.createdAt)}</span>
        </div>
      </div>
    `;
  }).join("");
}
