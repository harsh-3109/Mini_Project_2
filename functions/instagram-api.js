/**
 * Recommendation-Ranked Social Feed Studio
 * Official Meta Instagram Graph API Client (Server-Side)
 * 
 * Uses current official Meta Graph API v21.0 specifications.
 * No mock data. No fake responses.
 */

const INSTAGRAM_OAUTH_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const INSTAGRAM_GRAPH_BASE_URL = "https://graph.instagram.com/v21.0";
const INSTAGRAM_EXCHANGE_TOKEN_URL = "https://graph.instagram.com/access_token";
const INSTAGRAM_REFRESH_TOKEN_URL = "https://graph.instagram.com/refresh_access_token";

/**
 * Exchange OAuth authorization code for short-lived access token
 */
async function exchangeCodeForShortLivedToken({ clientId, clientSecret, redirectUri, code }) {
  const formData = new URLSearchParams();
  formData.append("client_id", clientId);
  formData.append("client_secret", clientSecret);
  formData.append("grant_type", "authorization_code");
  formData.append("redirect_uri", redirectUri);
  formData.append("code", code);

  const response = await fetch(INSTAGRAM_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString()
  });

  const data = await response.json();
  if (!response.ok || data.error_type || data.error_message) {
    throw new Error(data.error_message || data.error?.message || "Failed to exchange authorization code with Instagram.");
  }

  // data = { access_token, user_id }
  return data;
}

/**
 * Exchange short-lived access token for long-lived (60-day) access token
 */
async function exchangeForLongLivedToken({ clientSecret, shortLivedToken }) {
  const url = `${INSTAGRAM_EXCHANGE_TOKEN_URL}?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(clientSecret)}&access_token=${encodeURIComponent(shortLivedToken)}`;

  const response = await fetch(url, { method: "GET" });
  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error?.message || "Failed to obtain long-lived Instagram access token.");
  }

  // data = { access_token, token_type: "bearer", expires_in: 5184000 } (~60 days)
  return data;
}

/**
 * Refresh a long-lived access token (extends lifespan another 60 days)
 */
async function refreshLongLivedToken(longLivedToken) {
  const url = `${INSTAGRAM_REFRESH_TOKEN_URL}?grant_type=ig_refresh_token&access_token=${encodeURIComponent(longLivedToken)}`;

  const response = await fetch(url, { method: "GET" });
  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error?.message || "Failed to refresh Instagram access token.");
  }

  // data = { access_token, token_type: "bearer", expires_in: 5184000 }
  return data;
}

/**
 * Fetch Instagram Professional Account Profile Information
 */
async function getInstagramUserProfile(accessToken) {
  const fields = "id,username,account_type,profile_picture_url";
  const url = `${INSTAGRAM_GRAPH_BASE_URL}/me?fields=${fields}&access_token=${encodeURIComponent(accessToken)}`;

  const response = await fetch(url, { method: "GET" });
  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error?.message || "Failed to fetch Instagram profile details from Meta Graph API.");
  }

  return {
    instagramUserId: data.id,
    instagramUsername: data.username,
    accountType: data.account_type || "UNKNOWN",
    profilePictureUrl: data.profile_picture_url || null
  };
}

/**
 * Fetch User Media from Instagram Graph API with pagination support
 */
async function getInstagramUserMedia(accessToken, { limit = 25, after = null } = {}) {
  const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";
  let url = `${INSTAGRAM_GRAPH_BASE_URL}/me/media?fields=${fields}&limit=${limit}&access_token=${encodeURIComponent(accessToken)}`;

  if (after) {
    url += `&after=${encodeURIComponent(after)}`;
  }

  const response = await fetch(url, { method: "GET" });
  const data = await response.json();

  if (!response.ok || data.error) {
    // Check if error is due to expired or revoked token
    const isTokenRevoked = data.error?.code === 190 || data.error?.error_subcode === 463;
    const err = new Error(data.error?.message || "Failed to fetch user media from Instagram.");
    err.isTokenRevoked = isTokenRevoked;
    err.statusCode = response.status;
    throw err;
  }

  return {
    mediaList: data.data || [],
    paging: data.paging || null
  };
}

/**
 * Fetch Media Insights (reach, total_interactions) where supported by account type
 */
async function getMediaInsights(mediaId, accessToken) {
  try {
    const metrics = "reach,total_interactions";
    const url = `${INSTAGRAM_GRAPH_BASE_URL}/${mediaId}/insights?metric=${metrics}&access_token=${encodeURIComponent(accessToken)}`;

    const response = await fetch(url, { method: "GET" });
    const data = await response.json();

    if (!response.ok || data.error) {
      // Insights might not be available for older media, personal accounts, or certain media types
      return null;
    }

    return data.data || [];
  } catch (err) {
    console.warn(`Could not fetch insights for media ${mediaId}:`, err.message);
    return null;
  }
}

module.exports = {
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
  refreshLongLivedToken,
  getInstagramUserProfile,
  getInstagramUserMedia,
  getMediaInsights
};
