/**
 * Recommendation-Ranked Social Feed Studio
 * Client-Side Instagram Media Synchronization Manager
 * 
 * Invokes the secure Cloud Function to sync media, handles rate limits and errors.
 */

import { initFirebase } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";
import { showToast } from "./utils.js";
import { getFunctionsBaseUrl } from "./instagram.js";

/**
 * Trigger media synchronization via Cloud Function
 */
export async function triggerInstagramSync() {
  const user = getCurrentUser();
  if (!user) {
    showToast("Please sign in to synchronize Instagram media.", "warning");
    return { success: false, error: "Not authenticated" };
  }

  const { isLive, auth } = await initFirebase();
  if (!isLive || !auth || !auth.currentUser) {
    throw new Error("You must be logged in with Firebase Authentication to trigger synchronization.");
  }

  const baseUrl = getFunctionsBaseUrl();
  if (baseUrl.includes("YOUR_PROJECT_ID")) {
    throw new Error("Cloud Functions base URL is not configured with your project ID. Update your Firebase Project ID in Settings.");
  }

  try {
    const idToken = await auth.currentUser.getIdToken();

    const response = await fetch(`${baseUrl}/syncInstagramMedia`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      }
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || "Failed to synchronize Instagram media.");
    }

    showToast(`Sync completed! ${result.importedCount} new/updated Instagram posts.`, "success");
    return result;

  } catch (err) {
    console.error("Instagram sync failed:", err);
    showToast(`Sync Error: ${err.message}`, "error");
    throw err;
  }
}

/**
 * Test connectivity to the Cloud Functions Instagram API endpoints
 */
export async function testFunctionsConnectivity() {
  const baseUrl = getFunctionsBaseUrl();
  if (baseUrl.includes("YOUR_PROJECT_ID")) {
    return { isConfigured: false, message: "Cloud Functions base URL is using placeholder Project ID." };
  }

  try {
    const response = await fetch(`${baseUrl}/getInstagramConfigStatus`, { method: "GET" });
    if (!response.ok) {
      return { isConfigured: false, message: `Function returned HTTP status ${response.status}.` };
    }
    const data = await response.json();
    return { isConfigured: true, ...data };
  } catch (err) {
    return { isConfigured: false, message: err.message };
  }
}
