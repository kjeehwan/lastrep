import { doc, getDoc, setDoc } from "firebase/firestore"; // Correct imports for Firestore v9+ SDK
import { db } from "./config/firebaseConfig"; // Your Firebase configuration

// Save user data to Firestore (default to merging to avoid overwriting previous onboarding steps)
export const saveUserData = async (userId, userData, merge = true) => {
  try {
    await setDoc(doc(db, "users", userId), userData, { merge });
    console.log(merge ? "User data merged." : "User data saved.");
  } catch (error) {
    console.error("Error saving user data:", error); // Log error in case of failure
  }
};

// Directly fetch user data
export const getUserData = async (userId) => {
  try {
    const docRef = doc(db, "users", userId);  // Direct reference to the user document
    const docSnap = await getDoc(docRef);  // Direct Firestore query

    if (docSnap.exists()) {
      console.log("Fetched user data:", docSnap.data());  // Log user data
      return docSnap.data();  // Return the fetched data
    } else {
      console.warn("No such user document!");  // If the document doesn't exist
      return null;
    }
  } catch (error) {
    console.error("Error fetching user data:", error); // Log any errors
    return null;
  }
};
