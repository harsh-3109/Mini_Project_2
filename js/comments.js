/**
 * Recommendation-Ranked Social Feed Studio
 * Comments Management Module
 */

import { initFirebase } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";
import { 
  showToast, 
  generateId, 
  getLocalCollection, 
  saveLocalCollection, 
  sampleComments, 
  sampleUsers 
} from "./utils.js";
import { createNotification } from "./notifications.js";
import { recordInteraction } from "./interactions.js";

/**
 * Fetch all comments for a specific post
 */
export async function getCommentsForPost(postId) {
  const { isLive, db, firebaseModules } = await initFirebase();
  let comments = [];
  let usersList = [];

  if (isLive && db && firebaseModules) {
    try {
      const { collection, getDocs, query, where, orderBy } = firebaseModules.firestoreModule;
      const q = query(
        collection(db, "comments"), 
        where("postId", "==", postId),
        orderBy("createdAt", "asc")
      );
      const snapshot = await getDocs(q);
      snapshot.forEach(doc => {
        comments.push({ commentId: doc.id, ...doc.data() });
      });

      const usersSnapshot = await getDocs(collection(db, "users"));
      usersSnapshot.forEach(doc => usersList.push({ uid: doc.id, ...doc.data() }));
    } catch (e) {
      console.warn("Falling back to local comments:", e);
      comments = getLocalCollection("comments").filter(c => c.postId === postId);
      usersList = getLocalCollection("users");
    }
  } else {
    comments = getLocalCollection("comments").filter(c => c.postId === postId);
    usersList = getLocalCollection("users");
  }

  // Prepopulate sample comments if empty
  if (comments.length === 0) {
    const defaultComments = sampleComments.filter(c => c.postId === postId);
    if (defaultComments.length > 0) {
      comments = defaultComments;
      const allLocal = getLocalCollection("comments");
      saveLocalCollection("comments", [...allLocal, ...defaultComments]);
    }
  }

  // Hydrate user info
  const usersMap = new Map();
  [...sampleUsers, ...usersList].forEach(u => usersMap.set(u.uid, u));

  return comments.map(comment => ({
    ...comment,
    author: usersMap.get(comment.authorId) || {
      uid: comment.authorId,
      name: "Community Member",
      username: "user",
      profileImage: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
    }
  }));
}

/**
 * Add a comment to a post
 */
export async function addComment(postId, postAuthorId, commentText) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error("Please log in to leave a comment.");

  if (!commentText || commentText.trim().length === 0) {
    throw new Error("Comment cannot be empty.");
  }

  const commentId = generateId("comm");
  const newComment = {
    commentId,
    postId,
    authorId: currentUser.uid,
    commentText: commentText.trim(),
    createdAt: new Date().toISOString()
  };

  const { isLive, db, firebaseModules } = await initFirebase();

  if (isLive && db && firebaseModules) {
    const { doc, setDoc, updateDoc, increment } = firebaseModules.firestoreModule;
    await setDoc(doc(db, "comments", commentId), newComment);
    
    // Increment post comment count
    try {
      await updateDoc(doc(db, "posts", postId), {
        commentsCount: increment(1)
      });
    } catch (e) {
      console.warn("Could not increment comment count in live post:", e);
    }
  } else {
    const comments = getLocalCollection("comments");
    comments.push(newComment);
    saveLocalCollection("comments", comments);

    const posts = getLocalCollection("posts");
    const pIdx = posts.findIndex(p => p.postId === postId);
    if (pIdx !== -1) {
      posts[pIdx].commentsCount = (posts[pIdx].commentsCount || 0) + 1;
      saveLocalCollection("posts", posts);
    }
  }

  // Record interaction for affinity tracking
  await recordInteraction({
    userId: currentUser.uid,
    authorId: postAuthorId,
    postId,
    interactionType: "comment"
  });

  // Notify post author if not self
  if (postAuthorId && postAuthorId !== currentUser.uid) {
    await createNotification({
      recipientId: postAuthorId,
      senderId: currentUser.uid,
      type: "comment",
      postId,
      message: `${currentUser.name} commented: "${commentText.trim().substring(0, 40)}..."`
    });
  }

  showToast("Comment posted!", "success");
  return { ...newComment, author: currentUser };
}

/**
 * Delete a comment (Author only)
 */
export async function deleteComment(commentId, postId) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error("Authentication required.");

  const { isLive, db, firebaseModules } = await initFirebase();

  if (isLive && db && firebaseModules) {
    const { doc, getDoc, deleteDoc, updateDoc, increment } = firebaseModules.firestoreModule;
    const commentRef = doc(db, "comments", commentId);
    const snap = await getDoc(commentRef);
    if (snap.exists() && snap.data().authorId !== currentUser.uid) {
      throw new Error("You can only delete your own comments.");
    }

    await deleteDoc(commentRef);

    try {
      await updateDoc(doc(db, "posts", postId), {
        commentsCount: increment(-1)
      });
    } catch (e) {
      console.warn("Error updating post count:", e);
    }
  } else {
    const comments = getLocalCollection("comments");
    const target = comments.find(c => c.commentId === commentId);
    if (target && target.authorId !== currentUser.uid) {
      throw new Error("You can only delete your own comments.");
    }

    const filtered = comments.filter(c => c.commentId !== commentId);
    saveLocalCollection("comments", filtered);

    const posts = getLocalCollection("posts");
    const pIdx = posts.findIndex(p => p.postId === postId);
    if (pIdx !== -1 && posts[pIdx].commentsCount > 0) {
      posts[pIdx].commentsCount -= 1;
      saveLocalCollection("posts", posts);
    }
  }

  showToast("Comment deleted.", "info");
  return true;
}
