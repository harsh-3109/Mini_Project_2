/**
 * Recommendation-Ranked Social Feed Studio
 * Posts CRUD & Management Module
 */

import { initFirebase } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";
import { 
  showToast, 
  generateId, 
  getLocalCollection, 
  saveLocalCollection, 
  samplePosts, 
  sampleUsers 
} from "./utils.js";

/**
 * Fetch all posts with author data merged
 */
export async function getAllPosts() {
  const { isLive, db, firebaseModules } = await initFirebase();

  let rawPosts = [];
  let usersList = [];

  if (isLive && db && firebaseModules) {
    try {
      const { collection, getDocs, orderBy, query } = firebaseModules.firestoreModule;
      
      // Fetch posts
      const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"));
      const postsSnapshot = await getDocs(postsQuery);
      postsSnapshot.forEach(doc => {
        rawPosts.push({ postId: doc.id, ...doc.data() });
      });

      // Fetch users for author hydration
      const usersSnapshot = await getDocs(collection(db, "users"));
      usersSnapshot.forEach(doc => {
        usersList.push({ uid: doc.id, ...doc.data() });
      });
    } catch (err) {
      console.warn("Could not fetch posts from live Firestore, falling back to local:", err);
      rawPosts = getLocalCollection("posts");
      usersList = getLocalCollection("users");
    }
  } else {
    rawPosts = getLocalCollection("posts");
    usersList = getLocalCollection("users");
  }

  // If local store is empty, initialize with rich sample data automatically
  if (rawPosts.length === 0) {
    rawPosts = [...samplePosts];
    saveLocalCollection("posts", rawPosts);
  }
  if (usersList.length === 0) {
    usersList = [...sampleUsers];
    saveLocalCollection("users", usersList);
  }

  // Merge author info
  const usersMap = new Map();
  usersList.forEach(u => usersMap.set(u.uid, u));
  sampleUsers.forEach(u => {
    if (!usersMap.has(u.uid)) usersMap.set(u.uid, u);
  });

  return rawPosts.map(post => {
    const author = usersMap.get(post.authorId) || {
      uid: post.authorId,
      name: "Community Creator",
      username: "creator",
      profileImage: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
    };

    return {
      ...post,
      author
    };
  });
}

/**
 * Create a new post
 */
export async function createPost({ content, imageUrl = "", visibility = "public" }) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error("You must be logged in to create a post.");

  if (!content || content.trim().length === 0) {
    throw new Error("Post content cannot be empty.");
  }

  const postId = generateId("post");
  const newPost = {
    postId,
    authorId: currentUser.uid,
    content: content.trim(),
    imageUrl: imageUrl.trim(),
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    createdAt: new Date().toISOString(),
    visibility
  };

  const { isLive, db, firebaseModules } = await initFirebase();

  if (isLive && db && firebaseModules) {
    const { doc, setDoc } = firebaseModules.firestoreModule;
    await setDoc(doc(db, "posts", postId), newPost);
  } else {
    const posts = getLocalCollection("posts");
    posts.unshift(newPost);
    saveLocalCollection("posts", posts);
  }

  showToast("Post published to the feed!", "success");
  return { ...newPost, author: currentUser };
}

/**
 * Update an existing post (Only author allowed)
 */
export async function updatePost(postId, { content, imageUrl }) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error("Authentication required.");

  const posts = await getAllPosts();
  const targetPost = posts.find(p => p.postId === postId);
  if (!targetPost) throw new Error("Post not found.");

  if (targetPost.authorId !== currentUser.uid) {
    throw new Error("You can only edit your own posts.");
  }

  const updatedFields = {
    content: content.trim(),
    imageUrl: imageUrl !== undefined ? imageUrl.trim() : targetPost.imageUrl,
    updatedAt: new Date().toISOString()
  };

  const { isLive, db, firebaseModules } = await initFirebase();

  if (isLive && db && firebaseModules) {
    const { doc, updateDoc } = firebaseModules.firestoreModule;
    await updateDoc(doc(db, "posts", postId), updatedFields);
  } else {
    const localPosts = getLocalCollection("posts");
    const idx = localPosts.findIndex(p => p.postId === postId);
    if (idx !== -1) {
      localPosts[idx] = { ...localPosts[idx], ...updatedFields };
      saveLocalCollection("posts", localPosts);
    }
  }

  showToast("Post updated successfully!", "success");
  return { ...targetPost, ...updatedFields };
}

/**
 * Delete a post (Only author allowed)
 */
export async function deletePost(postId) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error("Authentication required.");

  const posts = await getAllPosts();
  const targetPost = posts.find(p => p.postId === postId);
  if (!targetPost) throw new Error("Post not found.");

  if (targetPost.authorId !== currentUser.uid) {
    throw new Error("You can only delete your own posts.");
  }

  const { isLive, db, firebaseModules } = await initFirebase();

  if (isLive && db && firebaseModules) {
    const { doc, deleteDoc } = firebaseModules.firestoreModule;
    await deleteDoc(doc(db, "posts", postId));
  } else {
    const localPosts = getLocalCollection("posts");
    const filtered = localPosts.filter(p => p.postId !== postId);
    saveLocalCollection("posts", filtered);
  }

  showToast("Post deleted.", "info");
  return true;
}

/**
 * Seed initial sample dataset into Firestore or Local Storage
 */
export async function seedSampleData(force = false) {
  const { isLive, db, firebaseModules } = await initFirebase();

  if (isLive && db && firebaseModules) {
    const { collection, getDocs, doc, setDoc } = firebaseModules.firestoreModule;
    
    // Check if posts already exist
    const snapshot = await getDocs(collection(db, "posts"));
    if (snapshot.size > 0 && !force) {
      showToast(`Database already contains ${snapshot.size} posts. Seeding skipped.`, "info");
      return false;
    }

    // Seed users
    for (const user of sampleUsers) {
      await setDoc(doc(db, "users", user.uid), user);
    }

    // Seed posts
    for (const post of samplePosts) {
      await setDoc(doc(db, "posts", post.postId), post);
    }

    showToast(`Successfully seeded 5 users and ${samplePosts.length} posts to Firestore!`, "success");
    return true;
  } else {
    // Local storage seeding
    const currentPosts = getLocalCollection("posts");
    if (currentPosts.length > 0 && !force) {
      showToast(`Local storage already has ${currentPosts.length} posts.`, "info");
      return false;
    }

    saveLocalCollection("users", sampleUsers);
    saveLocalCollection("posts", samplePosts);
    showToast(`Successfully seeded 5 users and ${samplePosts.length} posts to local store!`, "success");
    return true;
  }
}
