/**
 * Recommendation-Ranked Social Feed Studio
 * Instagram Media Synchronization Module (Server-Side)
 * 
 * Handles real media ingestion, duplicate prevention, token refresh, and rate-limit safety.
 */

const admin = require("firebase-admin");
const { getInstagramUserMedia, refreshLongLivedToken, getMediaInsights } = require("./instagram-api");

/**
 * Synchronize media for a connected user
 * @param {string} userId - Firebase Auth UID
 * @param {object} options - Options { maxPages: number }
 */
async function syncUserInstagramMedia(userId, { maxPages = 4 } = {}) {
  const db = admin.firestore();

  // 1. Fetch secure token from private server-only collection
  const tokenDocRef = db.collection("instagramTokens").doc(userId);
  const tokenDoc = await tokenDocRef.get();

  if (!tokenDoc.exists) {
    await db.collection("instagramConnections").doc(userId).set({
      connectionStatus: "disconnected",
      lastError: "No valid Instagram credentials found. Reconnection required."
    }, { merge: true });
    throw new Error("No Instagram access token found for user. Please reconnect.");
  }

  const tokenData = tokenDoc.data();
  let accessToken = tokenData.accessToken;
  const tokenExpiresAt = new Date(tokenData.tokenExpiresAt);

  // 2. Check if token is nearing expiration (within 7 days) and refresh if needed
  const now = new Date();
  const daysUntilExpiry = (tokenExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (daysUntilExpiry < 7 && daysUntilExpiry > 0) {
    try {
      console.log(`Refreshing Instagram long-lived token for user ${userId}...`);
      const refreshResult = await refreshLongLivedToken(accessToken);
      accessToken = refreshResult.access_token;
      const newExpiry = new Date(Date.now() + (refreshResult.expires_in * 1000));

      await tokenDocRef.update({
        accessToken,
        tokenExpiresAt: newExpiry.toISOString(),
        refreshedAt: new Date().toISOString()
      });

      await db.collection("instagramConnections").doc(userId).set({
        tokenExpiresAt: newExpiry.toISOString()
      }, { merge: true });
    } catch (refreshErr) {
      console.warn("Could not refresh token automatically:", refreshErr.message);
    }
  }

  // 3. Retrieve user connection metadata
  const connDoc = await db.collection("instagramConnections").doc(userId).get();
  const instagramUserId = connDoc.exists ? connDoc.data().instagramUserId : "";

  // 4. Fetch media from Instagram Graph API with pagination
  let importedCount = 0;
  let hasMore = true;
  let afterCursor = null;
  let page = 0;

  try {
    while (hasMore && page < maxPages) {
      page++;
      const { mediaList, paging } = await getInstagramUserMedia(accessToken, { limit: 25, after: afterCursor });

      if (!mediaList || mediaList.length === 0) {
        break;
      }

      // Batch write to Firestore for high performance
      const batch = db.batch();

      for (const item of mediaList) {
        const mediaId = String(item.id);
        const mediaDocRef = db.collection("instagramMedia").doc(`${userId}_${mediaId}`);

        const mediaRecord = {
          mediaId: mediaId,
          ownerUserId: userId,
          instagramUserId: instagramUserId,
          caption: item.caption || "",
          mediaType: item.media_type || "IMAGE",
          mediaUrl: item.media_url || item.thumbnail_url || "",
          permalink: item.permalink || `https://www.instagram.com/p/${mediaId}/`,
          timestamp: item.timestamp || new Date().toISOString(),
          likeCount: typeof item.like_count === "number" ? item.like_count : 0,
          commentsCount: typeof item.comments_count === "number" ? item.comments_count : 0,
          importedAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString()
        };

        batch.set(mediaDocRef, mediaRecord, { merge: true });
        importedCount++;

        // Fetch insights for this media if available
        try {
          const insights = await getMediaInsights(mediaId, accessToken);
          if (insights && Array.isArray(insights)) {
            for (const insight of insights) {
              const insightDocRef = db.collection("instagramInsights").doc(`${userId}_${mediaId}_${insight.name}`);
              batch.set(insightDocRef, {
                mediaId: mediaId,
                ownerUserId: userId,
                metricName: insight.name,
                metricValue: insight.values && insight.values[0] ? insight.values[0].value : 0,
                period: insight.period || "lifetime",
                fetchedAt: new Date().toISOString()
              }, { merge: true });
            }
          }
        } catch (insightErr) {
          // Insights may not be supported for all media types; continue without breaking
        }
      }

      await batch.commit();

      if (paging && paging.cursors && paging.cursors.after) {
        afterCursor = paging.cursors.after;
      } else {
        hasMore = false;
      }
    }

    // 5. Update connection record with sync outcome
    const totalMediaSnapshot = await db.collection("instagramMedia").where("ownerUserId", "==", userId).get();
    const totalImported = totalMediaSnapshot.size;

    await db.collection("instagramConnections").doc(userId).set({
      connectionStatus: "connected",
      lastSyncAt: new Date().toISOString(),
      importedMediaCount: totalImported,
      lastError: null
    }, { merge: true });

    return {
      success: true,
      importedCount,
      totalImported,
      lastSyncAt: new Date().toISOString()
    };

  } catch (err) {
    console.error(`Error syncing media for user ${userId}:`, err);

    const isTokenRevoked = err.isTokenRevoked || err.message.includes("OAuthException") || err.message.includes("Session has expired");

    await db.collection("instagramConnections").doc(userId).set({
      connectionStatus: isTokenRevoked ? "token_expired" : "sync_error",
      lastError: err.message || "Failed to sync media with Instagram Graph API.",
      lastSyncAttemptAt: new Date().toISOString()
    }, { merge: true });

    throw err;
  }
}

module.exports = {
  syncUserInstagramMedia
};
