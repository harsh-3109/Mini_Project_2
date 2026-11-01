/**
 * Recommendation-Ranked Social Feed Studio
 * Firebase Cloud Functions Index
 * 
 * Secure server-side runtime for Meta Instagram Graph API integration.
 * No sensitive credentials exposed to clients.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const { 
  generateAuthUrl, 
  handleOAuthCallback, 
  disconnectUserInstagram, 
  getConfig 
} = require("./instagram-oauth");
const { syncUserInstagramMedia } = require("./instagram-sync");

// CORS helper
function setCorsHeaders(req, res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true;
  }
  return false;
}

// Authenticate Firebase user from Authorization: Bearer <ID_TOKEN>
async function authenticateRequest(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: Missing Bearer token in Authorization header." });
    return null;
  }

  const idToken = authHeader.split("Bearer ")[1].trim();
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (err) {
    res.status(401).json({ error: "Unauthorized: Invalid or expired Firebase ID token." });
    return null;
  }
}

/**
 * Cloud Function: getInstagramAuthUrl
 * Generates official Instagram OAuth URL with CSRF state token
 */
exports.getInstagramAuthUrl = functions.https.onRequest(async (req, res) => {
  if (setCorsHeaders(req, res)) return;

  const user = await authenticateRequest(req, res);
  if (!user) return;

  try {
    const result = await generateAuthUrl(user.uid);
    res.status(200).json(result);
  } catch (err) {
    console.error("Error generating Instagram Auth URL:", err);
    res.status(500).json({ error: err.message || "Failed to generate authorization URL." });
  }
});

/**
 * Cloud Function: instagramOAuthCallback
 * HTTP Callback endpoint receiving redirect from Meta
 */
exports.instagramOAuthCallback = functions.https.onRequest(async (req, res) => {
  await handleOAuthCallback(req, res);
});

/**
 * Cloud Function: syncInstagramMedia
 * Triggers manual or programmatic media synchronization
 */
exports.syncInstagramMedia = functions.https.onRequest(async (req, res) => {
  if (setCorsHeaders(req, res)) return;

  const user = await authenticateRequest(req, res);
  if (!user) return;

  try {
    const result = await syncUserInstagramMedia(user.uid);
    res.status(200).json(result);
  } catch (err) {
    console.error(`Error syncing media for user ${user.uid}:`, err);
    res.status(500).json({ error: err.message || "Failed to synchronize Instagram media." });
  }
});

/**
 * Cloud Function: disconnectInstagram
 * Disconnects and invalidates Instagram access credentials
 */
exports.disconnectInstagram = functions.https.onRequest(async (req, res) => {
  if (setCorsHeaders(req, res)) return;

  const user = await authenticateRequest(req, res);
  if (!user) return;

  try {
    const result = await disconnectUserInstagram(user.uid);
    res.status(200).json(result);
  } catch (err) {
    console.error(`Error disconnecting Instagram for user ${user.uid}:`, err);
    res.status(500).json({ error: err.message || "Failed to disconnect Instagram." });
  }
});

/**
 * Cloud Function: getInstagramConfigStatus
 * Diagnostic endpoint for frontend to inspect whether credentials are configured
 */
exports.getInstagramConfigStatus = functions.https.onRequest(async (req, res) => {
  if (setCorsHeaders(req, res)) return;

  const { clientId, redirectUri } = getConfig();
  res.status(200).json({
    isConfigured: Boolean(clientId && redirectUri),
    hasClientId: Boolean(clientId),
    redirectUri: redirectUri || "Not configured",
    apiVersion: "v21.0 (Meta Instagram Graph API)"
  });
});
