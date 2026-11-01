/**
 * Recommendation-Ranked Social Feed Studio
 * Instagram OAuth Flow & Authorization Handlers (Server-Side)
 * 
 * Protects credentials, prevents CSRF with state validation, and securely manages tokens.
 */

const crypto = require("crypto");
const admin = require("firebase-admin");
const { 
  exchangeCodeForShortLivedToken, 
  exchangeForLongLivedToken, 
  getInstagramUserProfile 
} = require("./instagram-api");
const { syncUserInstagramMedia } = require("./instagram-sync");

// Environment & Config Helper
function getConfig() {
  return {
    clientId: process.env.INSTAGRAM_CLIENT_ID || process.env.META_CLIENT_ID || "",
    clientSecret: process.env.INSTAGRAM_CLIENT_SECRET || process.env.META_CLIENT_SECRET || "",
    redirectUri: process.env.INSTAGRAM_REDIRECT_URI || "",
    frontendUrl: process.env.FRONTEND_APP_URL || ""
  };
}

/**
 * Generate Instagram OAuth authorization URL with CSRF state protection
 */
async function generateAuthUrl(userId) {
  const { clientId, redirectUri } = getConfig();

  if (!clientId || !redirectUri) {
    throw new Error("Instagram OAuth is not configured with INSTAGRAM_CLIENT_ID and INSTAGRAM_REDIRECT_URI.");
  }

  const db = admin.firestore();

  // Generate cryptographically secure random state token
  const stateToken = crypto.randomBytes(24).toString("hex");

  // Save state in Firestore with 10-minute expiration
  await db.collection("oauthStates").doc(stateToken).set({
    userId,
    stateToken,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
  });

  // Official Meta Instagram Login authorization URL
  // Requested scopes:
  // - instagram_basic: read account info, media, profile
  // - instagram_manage_insights: read media reach and engagement insights where supported
  const scopes = "instagram_basic,instagram_manage_insights";
  const authUrl = `https://api.instagram.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${encodeURIComponent(stateToken)}`;

  return { authUrl, stateToken };
}

/**
 * Handle incoming OAuth redirect callback from Meta
 */
async function handleOAuthCallback(req, res) {
  const { clientId, clientSecret, redirectUri, frontendUrl } = getConfig();
  const db = admin.firestore();

  const code = req.query.code;
  const state = req.query.state;
  const error = req.query.error;
  const errorReason = req.query.error_reason;
  const errorDescription = req.query.error_description;

  const baseRedirect = frontendUrl || "/";

  // Check if user cancelled or Instagram returned error
  if (error || !code) {
    const errorMsg = errorDescription || errorReason || error || "Authorization was cancelled or denied by user.";
    console.warn("Instagram OAuth error returned by Meta:", errorMsg);
    return res.redirect(`${baseRedirect}/instagram.html?error=${encodeURIComponent(errorMsg)}`);
  }

  // Validate state token for CSRF protection
  if (!state) {
    return res.redirect(`${baseRedirect}/instagram.html?error=${encodeURIComponent("Missing OAuth state token.")}`);
  }

  const stateDocRef = db.collection("oauthStates").doc(state);
  const stateDoc = await stateDocRef.get();

  if (!stateDoc.exists) {
    return res.redirect(`${baseRedirect}/instagram.html?error=${encodeURIComponent("Invalid or expired OAuth state token. Possible CSRF attempt.")}`);
  }

  const stateData = stateDoc.data();
  const userId = stateData.userId;

  // Check expiration
  if (new Date(stateData.expiresAt) < new Date()) {
    await stateDocRef.delete();
    return res.redirect(`${baseRedirect}/instagram.html?error=${encodeURIComponent("OAuth state token has expired. Please try connecting again.")}`);
  }

  // Delete state token to prevent replay attacks
  await stateDocRef.delete();

  try {
    // 1. Exchange authorization code for short-lived token
    console.log(`Exchanging authorization code for short-lived token (User: ${userId})...`);
    const shortLivedData = await exchangeCodeForShortLivedToken({
      clientId,
      clientSecret,
      redirectUri,
      code
    });

    const shortLivedToken = shortLivedData.access_token;
    const instagramUserId = shortLivedData.user_id;

    // 2. Exchange short-lived token for long-lived 60-day token
    console.log("Exchanging short-lived token for long-lived 60-day token...");
    const longLivedData = await exchangeForLongLivedToken({
      clientSecret,
      shortLivedToken
    });

    const accessToken = longLivedData.access_token;
    const expiresInSeconds = longLivedData.expires_in || 5184000;
    const tokenExpiresAt = new Date(Date.now() + (expiresInSeconds * 1000));

    // 3. Fetch account profile details from Meta Graph API
    console.log("Fetching Instagram profile information...");
    const profile = await getInstagramUserProfile(accessToken);

    // 4. Save access token into secure, private collection (Admin SDK only)
    await db.collection("instagramTokens").doc(userId).set({
      userId,
      instagramUserId: profile.instagramUserId || String(instagramUserId),
      accessToken,
      tokenExpiresAt: tokenExpiresAt.toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 5. Save non-sensitive metadata to public/user-readable collection
    await db.collection("instagramConnections").doc(userId).set({
      userId,
      instagramUserId: profile.instagramUserId || String(instagramUserId),
      instagramUsername: profile.instagramUsername,
      accountType: profile.accountType,
      profilePictureUrl: profile.profilePictureUrl,
      connectionStatus: "connected",
      connectedAt: new Date().toISOString(),
      tokenExpiresAt: tokenExpiresAt.toISOString(),
      lastSyncAt: null,
      lastError: null
    }, { merge: true });

    // 6. Trigger initial media synchronization
    try {
      console.log(`Triggering initial media sync for ${profile.instagramUsername}...`);
      await syncUserInstagramMedia(userId, { maxPages: 2 });
    } catch (syncErr) {
      console.warn("Initial sync encountered a non-fatal issue:", syncErr.message);
    }

    // Redirect user back to frontend with success parameters
    return res.redirect(`${baseRedirect}/instagram.html?status=connected&username=${encodeURIComponent(profile.instagramUsername)}`);

  } catch (err) {
    console.error("Error during Instagram OAuth exchange:", err);
    await db.collection("instagramConnections").doc(userId).set({
      connectionStatus: "error",
      lastError: err.message || "Failed to complete Instagram OAuth handshake."
    }, { merge: true });

    return res.redirect(`${baseRedirect}/instagram.html?error=${encodeURIComponent(err.message)}`);
  }
}

/**
 * Disconnect Instagram integration
 */
async function disconnectUserInstagram(userId) {
  const db = admin.firestore();

  // 1. Delete private token
  await db.collection("instagramTokens").doc(userId).delete();

  // 2. Update connection status
  await db.collection("instagramConnections").doc(userId).set({
    connectionStatus: "disconnected",
    disconnectedAt: new Date().toISOString(),
    lastError: null
  }, { merge: true });

  return { success: true };
}

module.exports = {
  generateAuthUrl,
  handleOAuthCallback,
  disconnectUserInstagram,
  getConfig
};
