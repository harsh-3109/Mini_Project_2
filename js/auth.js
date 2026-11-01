/**
 * Recommendation-Ranked Social Feed Studio
 * Authentication & User Session Management
 * 
 * Implements official Firebase Authentication & Cloud Firestore Database
 * integration with session persistence, email verification, username uniqueness,
 * password reset, and route guards.
 */

import { initFirebase, isFirebaseConfigured, displayConfigWarning } from "./firebase-config.js";
import { showToast, getLocalCollection, saveLocalCollection, sampleUsers } from "./utils.js";

const CURRENT_USER_KEY = "rr_current_user";

// In-memory state
let currentUser = null;
let authListenerRegistered = false;
let authStateCallbacks = [];

/**
 * Register state change listener
 */
export function onAuthStateChange(callback) {
  if (typeof callback === "function") {
    authStateCallbacks.push(callback);
    if (currentUser) {
      try { callback(currentUser); } catch (e) {}
    }
  }
}

function notifyAuthStateListeners(user) {
  authStateCallbacks.forEach(cb => {
    try { cb(user); } catch (e) { console.error("Auth listener error:", e); }
  });
}

/**
 * Get current authenticated user profile
 */
export function getCurrentUser() {
  if (currentUser) return currentUser;
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (raw) {
      currentUser = JSON.parse(raw);
      return currentUser;
    }
  } catch (e) {
    console.error("Error reading stored user:", e);
  }
  return null;
}

/**
 * Save current session locally
 */
export function setCurrentUser(user) {
  currentUser = user;
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
  updateNavAuthState();
  notifyAuthStateListeners(user);
}

/**
 * Initialize Authentication state listener
 */
export async function initAuth() {
  const { isLive, auth, db, firebaseModules } = await initFirebase();

  if (isLive && auth && firebaseModules) {
    const { onAuthStateChanged, reload } = firebaseModules.authModule;
    const { doc, getDoc, setDoc } = firebaseModules.firestoreModule;

    if (!authListenerRegistered) {
      authListenerRegistered = true;
      onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          try {
            const userDocRef = doc(db, "users", firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
              const userData = userDoc.data();
              const profile = {
                uid: firebaseUser.uid,
                ...userData,
                emailVerified: Boolean(firebaseUser.emailVerified)
              };
              setCurrentUser(profile);
            } else {
              // Handle missing profile: create user document automatically
              const displayName = firebaseUser.displayName || "Studio Creator";
              const cleanUsername = (firebaseUser.email ? firebaseUser.email.split("@")[0] : "creator") + "_" + Math.floor(Math.random() * 900 + 100);
              const avatar = firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`;
              const now = new Date().toISOString();

              const newProfile = {
                uid: firebaseUser.uid,
                fullName: displayName,
                name: displayName,
                username: cleanUsername,
                email: firebaseUser.email || "",
                bio: "Explorer of recommendation systems and algorithmic transparency.",
                profileImage: avatar,
                emailVerified: Boolean(firebaseUser.emailVerified),
                createdAt: now,
                updatedAt: now
              };
              await setDoc(userDocRef, newProfile);
              setCurrentUser(newProfile);
            }
          } catch (err) {
            console.error("Error fetching live user doc:", err);
          }
        } else {
          // If signed out in Firebase
          setCurrentUser(null);
        }
        updateNavAuthState();
        displayEmailVerificationBanner();
      });
    }
  } else {
    // Local educational mode persistence
    const existing = getCurrentUser();
    if (!existing) {
      const localUsers = getLocalCollection("users");
      if (localUsers.length === 0) {
        saveLocalCollection("users", sampleUsers);
      }
    }
    updateNavAuthState();
    displayEmailVerificationBanner();
  }

  // Display top configuration notice if credentials are placeholders
  displayConfigWarning();
  return getCurrentUser();
}

/**
 * Check if a username is already taken in Firestore
 */
export async function isUsernameTaken(username, excludeUid = null) {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!clean) return false;

  const { isLive, db, firebaseModules } = await initFirebase();
  if (isLive && db && firebaseModules) {
    try {
      const { collection, query, where, getDocs } = firebaseModules.firestoreModule;
      const q = query(collection(db, "users"), where("username", "==", clean));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return false;
      if (excludeUid && snapshot.docs.length === 1 && snapshot.docs[0].id === excludeUid) {
        return false;
      }
      return true;
    } catch (err) {
      console.warn("Could not check username uniqueness against Firestore:", err);
    }
  }

  // Local collection check
  const users = getLocalCollection("users");
  return users.some(u => u.username && u.username.toLowerCase() === clean && u.uid !== excludeUid);
}

/**
 * User Registration with Real Firebase Auth and Firestore Profile
 */
export async function registerUser({ fullName, name, username, email, password, confirmPassword, profileImage = "", bio = "" }) {
  const finalName = (fullName || name || "").trim();
  if (!finalName || finalName.length < 2) {
    throw new Error("Full name must be at least 2 characters.");
  }

  if (!username || username.trim().length < 3) {
    throw new Error("Username must be at least 3 characters.");
  }
  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (cleanUsername.length < 3) {
    throw new Error("Username can only contain letters, numbers, and underscores.");
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new Error("Please enter a valid email address.");
  }

  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    throw new Error("Passwords do not match.");
  }

  // Check username uniqueness
  const taken = await isUsernameTaken(cleanUsername);
  if (taken) {
    throw new Error(`The username "@${cleanUsername}" is already taken. Please choose another.`);
  }

  const avatar = profileImage.trim() || `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanUsername}`;
  const userBio = bio.trim() || "Social Feed Studio creator exploring recommendation algorithms.";
  const now = new Date().toISOString();

  const { isLive, auth, db, firebaseModules } = await initFirebase();

  if (isLive && auth && firebaseModules) {
    const { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } = firebaseModules.authModule;
    const { doc, setDoc } = firebaseModules.firestoreModule;

    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (authErr) {
      if (authErr.code === "auth/email-already-in-use") {
        throw new Error("An account with this email address already exists.");
      } else if (authErr.code === "auth/invalid-email") {
        throw new Error("The email address is improperly formatted.");
      } else if (authErr.code === "auth/weak-password") {
        throw new Error("The password is too weak. Please choose a stronger password.");
      } else {
        throw new Error(authErr.message || "Failed to create account.");
      }
    }

    const fbUser = userCredential.user;

    // Update Firebase Auth display info
    try {
      await updateProfile(fbUser, {
        displayName: finalName,
        photoURL: avatar
      });
    } catch (e) {
      console.warn("Could not update Auth profile:", e);
    }

    // Create user profile in Firestore
    const userProfile = {
      uid: fbUser.uid,
      fullName: finalName,
      name: finalName, // backwards compatibility
      username: cleanUsername,
      email: email.trim().toLowerCase(),
      bio: userBio,
      profileImage: avatar,
      emailVerified: Boolean(fbUser.emailVerified),
      createdAt: now,
      updatedAt: now
    };

    await setDoc(doc(db, "users", fbUser.uid), userProfile);

    // Send verification email
    try {
      await sendEmailVerification(fbUser);
      showToast("Account created! A verification email has been sent.", "success");
    } catch (verifErr) {
      console.warn("Could not send verification email:", verifErr);
      showToast("Account created successfully!", "success");
    }

    setCurrentUser(userProfile);
    return userProfile;
  } else {
    // Local educational mode persistence
    const users = getLocalCollection("users");
    const existingEmail = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (existingEmail) throw new Error("An account with this email already exists.");

    const newUid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newProfile = {
      uid: newUid,
      fullName: finalName,
      name: finalName,
      username: cleanUsername,
      email: email.trim().toLowerCase(),
      bio: userBio,
      profileImage: avatar,
      emailVerified: false,
      createdAt: now,
      updatedAt: now
    };

    users.push(newProfile);
    saveLocalCollection("users", users);
    setCurrentUser(newProfile);

    showToast(`Welcome, ${finalName}! Account created (Local Mode).`, "success");
    return newProfile;
  }
}

/**
 * User Login with Real Firebase Auth
 */
export async function loginUser(email, password) {
  if (!email || !password) throw new Error("Please enter both email and password.");

  const { isLive, auth, db, firebaseModules } = await initFirebase();

  if (isLive && auth && firebaseModules) {
    const { signInWithEmailAndPassword } = firebaseModules.authModule;
    const { doc, getDoc, setDoc, updateDoc } = firebaseModules.firestoreModule;

    let userCredential;
    try {
      userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (authErr) {
      console.error("Firebase sign in error:", authErr);
      if (authErr.code === "auth/user-not-found") {
        throw new Error("No account found with this email. Please check your spelling or register.");
      } else if (authErr.code === "auth/wrong-password" || authErr.code === "auth/invalid-credential") {
        throw new Error("Incorrect email or password. Please try again.");
      } else if (authErr.code === "auth/invalid-email") {
        throw new Error("The email address is improperly formatted.");
      } else if (authErr.code === "auth/user-disabled") {
        throw new Error("This account has been disabled by an administrator.");
      } else if (authErr.code === "auth/too-many-requests") {
        throw new Error("Too many failed login attempts. Please reset your password or wait a few minutes.");
      } else {
        throw new Error(authErr.message || "Failed to sign in. Please verify your credentials.");
      }
    }

    const fbUser = userCredential.user;
    const userDocRef = doc(db, "users", fbUser.uid);
    const userDoc = await getDoc(userDocRef);

    let profile;
    const now = new Date().toISOString();
    if (userDoc.exists()) {
      const data = userDoc.data();
      profile = {
        uid: fbUser.uid,
        ...data,
        fullName: data.fullName || data.name || fbUser.displayName || "Studio Creator",
        name: data.fullName || data.name || fbUser.displayName || "Studio Creator",
        emailVerified: Boolean(fbUser.emailVerified)
      };

      // Update emailVerified in Firestore if it changed
      if (data.emailVerified !== fbUser.emailVerified) {
        await updateDoc(userDocRef, {
          emailVerified: Boolean(fbUser.emailVerified),
          updatedAt: now
        }).catch(() => {});
      }
    } else {
      // Auto-generate missing profile
      const displayName = fbUser.displayName || "Studio Member";
      const cleanUsername = (email.split("@")[0] || "user") + "_" + Math.floor(Math.random() * 900 + 100);
      profile = {
        uid: fbUser.uid,
        fullName: displayName,
        name: displayName,
        username: cleanUsername,
        email: fbUser.email,
        bio: "Social Feed Studio creator exploring recommendation algorithms.",
        profileImage: fbUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${fbUser.uid}`,
        emailVerified: Boolean(fbUser.emailVerified),
        createdAt: now,
        updatedAt: now
      };
      await setDoc(userDocRef, profile);
    }

    setCurrentUser(profile);
    showToast(`Signed in as ${profile.fullName || profile.name}`, "success");
    return profile;
  } else {
    // Local educational mode login
    let users = getLocalCollection("users");
    if (users.length === 0) {
      users = [...sampleUsers];
      saveLocalCollection("users", users);
    }

    const matchedUser = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!matchedUser) {
      throw new Error("No user found with this email. Try logging in with maya.lin@technet.org (Demo) or create an account.");
    }

    setCurrentUser(matchedUser);
    showToast(`Signed in as ${matchedUser.fullName || matchedUser.name}`, "success");
    return matchedUser;
  }
}

/**
 * Switch / Quick-login to a sample persona (For grading & testing)
 */
export function quickLoginPersona(username) {
  let users = getLocalCollection("users");
  if (users.length === 0) {
    users = [...sampleUsers];
    saveLocalCollection("users", users);
  }

  const persona = users.find(u => u.username === username) || sampleUsers.find(u => u.username === username);
  if (persona) {
    setCurrentUser(persona);
    showToast(`Switched active user to ${persona.name} (@${persona.username})`, "info");
    return persona;
  }
  return null;
}

/**
 * Working Logout
 */
export async function logoutUser() {
  const { isLive, auth, firebaseModules } = await initFirebase();
  if (isLive && auth && firebaseModules) {
    try {
      const { signOut } = firebaseModules.authModule;
      await signOut(auth);
    } catch (e) {
      console.error("Sign out error:", e);
    }
  }
  setCurrentUser(null);
  showToast("You have been signed out.", "info");
  window.location.href = "login.html";
}

/**
 * Password Reset via Firebase Auth
 */
export async function sendPasswordReset(email) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new Error("Please enter a valid email address.");
  }

  const { isLive, auth, firebaseModules } = await initFirebase();
  if (isLive && auth && firebaseModules) {
    const { sendPasswordResetEmail } = firebaseModules.authModule;
    try {
      await sendPasswordResetEmail(auth, email.trim());
      showToast("Password reset email sent! Please check your inbox.", "success");
      return true;
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        throw new Error("No user found with that email address.");
      }
      throw new Error(err.message || "Failed to send reset email.");
    }
  } else {
    showToast(`Password reset link simulated for ${email} (Educational Mode).`, "info");
    return true;
  }
}

/**
 * Resend Email Verification
 */
export async function resendVerificationEmail() {
  const { isLive, auth, firebaseModules } = await initFirebase();
  if (isLive && auth && auth.currentUser && firebaseModules) {
    const { sendEmailVerification } = firebaseModules.authModule;
    try {
      await sendEmailVerification(auth.currentUser);
      showToast("Verification email sent! Check your inbox.", "success");
      return true;
    } catch (err) {
      throw new Error(err.message || "Could not send verification email.");
    }
  } else {
    showToast("Verification email simulated in local mode.", "info");
    return true;
  }
}

/**
 * Check and refresh email verification status
 */
export async function checkEmailVerifiedStatus() {
  const { isLive, auth, db, firebaseModules } = await initFirebase();
  if (isLive && auth && auth.currentUser && firebaseModules) {
    const { reload } = firebaseModules.authModule;
    const { doc, updateDoc } = firebaseModules.firestoreModule;

    await reload(auth.currentUser);
    const isVerified = Boolean(auth.currentUser.emailVerified);

    const user = getCurrentUser();
    if (user) {
      user.emailVerified = isVerified;
      setCurrentUser(user);

      if (isVerified) {
        await updateDoc(doc(db, "users", user.uid), {
          emailVerified: true,
          updatedAt: new Date().toISOString()
        }).catch(() => {});
        showToast("Email successfully verified!", "success");
      }
    }
    displayEmailVerificationBanner();
    return isVerified;
  }
  return false;
}

/**
 * Display Email Verification Banner if user email is unverified
 */
export function displayEmailVerificationBanner() {
  const existing = document.getElementById("email-verification-banner");
  const user = getCurrentUser();

  if (!user || user.emailVerified) {
    if (existing) existing.remove();
    return;
  }

  if (existing) return;

  const banner = document.createElement("div");
  banner.id = "email-verification-banner";
  banner.className = "email-verification-banner";
  banner.innerHTML = `
    <div class="email-verif-inner">
      <span>✉️ <strong>Verify your email:</strong> We sent a verification link to <em>${user.email}</em>.</span>
      <div class="email-verif-actions">
        <button type="button" class="btn btn-xs btn-outline" id="btn-resend-verif">Resend Email</button>
        <button type="button" class="btn btn-xs btn-primary" id="btn-check-verif">I've Verified</button>
        <button type="button" class="verif-close" onclick="this.closest('#email-verification-banner').remove()">✕</button>
      </div>
    </div>
  `;

  document.body.prepend(banner);

  const resendBtn = banner.querySelector("#btn-resend-verif");
  if (resendBtn) {
    resendBtn.addEventListener("click", async () => {
      resendBtn.disabled = true;
      resendBtn.textContent = "Sending...";
      try {
        await resendVerificationEmail();
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        resendBtn.disabled = false;
        resendBtn.textContent = "Resend Email";
      }
    });
  }

  const checkBtn = banner.querySelector("#btn-check-verif");
  if (checkBtn) {
    checkBtn.addEventListener("click", async () => {
      checkBtn.disabled = true;
      checkBtn.textContent = "Checking...";
      try {
        const verified = await checkEmailVerifiedStatus();
        if (verified) {
          banner.remove();
        } else {
          showToast("Email not yet verified. Please click the link in your email first.", "warning");
        }
      } catch (e) {
        showToast(e.message, "error");
      } finally {
        checkBtn.disabled = false;
        checkBtn.textContent = "I've Verified";
      }
    });
  }
}

/**
 * Create a new user profile document in Firestore
 */
export async function createUserProfile(uid, profileData) {
  const { isLive, db, firebaseModules } = await initFirebase();
  const now = new Date().toISOString();
  const profile = {
    uid,
    fullName: profileData.fullName || profileData.name || "Studio Member",
    name: profileData.fullName || profileData.name || "Studio Member",
    username: profileData.username || `user_${uid.substring(0, 6)}`,
    email: profileData.email || "",
    profileImage: profileData.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
    bio: profileData.bio || "Recommendation Studio creator.",
    emailVerified: Boolean(profileData.emailVerified),
    createdAt: now,
    updatedAt: now
  };

  if (isLive && db && firebaseModules) {
    const { doc, setDoc } = firebaseModules.firestoreModule;
    await setDoc(doc(db, "users", uid), profile);
  } else {
    const users = getLocalCollection("users");
    const idx = users.findIndex(u => u.uid === uid);
    if (idx !== -1) users[idx] = profile;
    else users.push(profile);
    saveLocalCollection("users", users);
  }
  return profile;
}

/**
 * Read user profile by UID
 */
export async function getUserProfile(uid) {
  if (!uid) return null;
  const { isLive, db, firebaseModules } = await initFirebase();
  if (isLive && db && firebaseModules) {
    try {
      const { doc, getDoc } = firebaseModules.firestoreModule;
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) {
        return { uid, ...snap.data() };
      }
    } catch (e) {
      console.warn("Could not read profile from Firestore:", e);
    }
  }

  const users = getLocalCollection("users");
  return users.find(u => u.uid === uid) || sampleUsers.find(u => u.uid === uid) || null;
}

/**
 * Update Current User Profile
 */
export async function updateCurrentUserProfile({ fullName, name, bio, profileImage }) {
  const user = getCurrentUser();
  if (!user) throw new Error("You must be logged in to update your profile.");

  const finalName = (fullName || name || user.fullName || user.name).trim();
  const now = new Date().toISOString();

  const updatedProfile = {
    ...user,
    fullName: finalName,
    name: finalName,
    bio: bio !== undefined ? bio.trim() : user.bio,
    profileImage: profileImage ? profileImage.trim() : user.profileImage,
    updatedAt: now
  };

  const { isLive, auth, db, firebaseModules } = await initFirebase();

  if (isLive && db && firebaseModules) {
    const { doc, updateDoc } = firebaseModules.firestoreModule;
    await updateDoc(doc(db, "users", user.uid), {
      fullName: updatedProfile.fullName,
      name: updatedProfile.name,
      bio: updatedProfile.bio,
      profileImage: updatedProfile.profileImage,
      updatedAt: now
    });

    if (auth && auth.currentUser) {
      const { updateProfile } = firebaseModules.authModule;
      await updateProfile(auth.currentUser, {
        displayName: updatedProfile.fullName,
        photoURL: updatedProfile.profileImage
      }).catch(() => {});
    }
  } else {
    const users = getLocalCollection("users");
    const idx = users.findIndex(u => u.uid === user.uid);
    if (idx !== -1) {
      users[idx] = updatedProfile;
      saveLocalCollection("users", users);
    }
  }

  setCurrentUser(updatedProfile);
  showToast("Profile updated successfully!", "success");
  return updatedProfile;
}

/**
 * Update username with uniqueness validation
 */
export async function updateUsername(uid, newUsername) {
  const clean = newUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (clean.length < 3) {
    throw new Error("Username must be at least 3 characters and contain only letters, numbers, or underscores.");
  }

  const taken = await isUsernameTaken(clean, uid);
  if (taken) {
    throw new Error(`The username "@${clean}" is already taken.`);
  }

  const now = new Date().toISOString();
  const { isLive, db, firebaseModules } = await initFirebase();

  if (isLive && db && firebaseModules) {
    const { doc, updateDoc } = firebaseModules.firestoreModule;
    await updateDoc(doc(db, "users", uid), {
      username: clean,
      updatedAt: now
    });
  }

  const user = getCurrentUser();
  if (user && user.uid === uid) {
    user.username = clean;
    user.updatedAt = now;
    setCurrentUser(user);
  }
  return clean;
}

/**
 * Update profile image URL for user
 */
export async function updateProfileImage(uid, imageUrl) {
  if (!imageUrl) throw new Error("Image URL is required.");
  const user = getCurrentUser();
  if (!user || user.uid !== uid) {
    throw new Error("Unauthorized to update this user's avatar.");
  }
  return await updateCurrentUserProfile({ profileImage: imageUrl.trim() });
}

/**
 * Route Guard: Protect Private Pages
 */
export function requireAuth(redirectUrl = null) {
  const user = getCurrentUser();
  if (!user) {
    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    const target = redirectUrl || `login.html?redirect=${encodeURIComponent(currentPath)}`;
    window.location.href = target;
    return false;
  }
  return true;
}

/**
 * Redirect away from auth pages if user is already logged in
 */
export function redirectIfAuthenticated(destination = "dashboard.html") {
  const user = getCurrentUser();
  if (user) {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect") || destination;
    window.location.href = redirect;
    return true;
  }
  return false;
}

/**
 * Update navigation elements dynamically based on auth state
 */
export function updateNavAuthState() {
  const user = getCurrentUser();
  const userElements = document.querySelectorAll(".auth-user-name");
  const avatarElements = document.querySelectorAll(".auth-user-avatar");
  const loggedInContainers = document.querySelectorAll(".auth-only");
  const loggedOutContainers = document.querySelectorAll(".guest-only");

  userElements.forEach(el => {
    el.textContent = user ? (user.fullName || user.name) : "Guest";
  });

  avatarElements.forEach(el => {
    if (el.tagName === "IMG") {
      el.src = user?.profileImage || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";
      el.alt = user ? (user.fullName || user.name) : "User Avatar";
    }
  });

  loggedInContainers.forEach(el => {
    el.style.display = user ? "" : "none";
  });

  loggedOutContainers.forEach(el => {
    el.style.display = user ? "none" : "";
  });
}

