import * as Google from "expo-auth-session/providers/google";
import Constants from 'expo-constants'; // Import Constants
import * as WebBrowser from "expo-web-browser";
import { getAuth, GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { useEffect } from "react";

// Ensures the auth session is completed (needed for redirect flow)
WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth() {
  const auth = getAuth(); // Get Firebase Auth instance

  // Safely access webClientId using optional chaining
  const GOOGLE_WEB_CLIENT_ID = Constants.expoConfig?.extra?.webClientId;

  // If the webClientId is not available, you can log an error or handle it gracefully
  if (!GOOGLE_WEB_CLIENT_ID) {
    console.error("Google Web Client ID is not defined in app.json");
    return { promptAsync: () => {} };  // Prevent further code execution if the client ID is missing
  }

  // Use the Google OAuth request handler from Expo
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID, // Use 'clientId' instead of 'expoClientId'
    iosClientId: GOOGLE_WEB_CLIENT_ID,  // Same for both (if only using one for testing)
    androidClientId: GOOGLE_WEB_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'], // Explicitly requesting the ID token and profile information
  });

  useEffect(() => {
    console.log("Google OAuth response:", response); // Log the full response for debugging

    // When Google successfully redirects, process the OAuth token
    if (response?.type === "success") {
      const { access_token } = response.params; // Extract the access token from the response

      // Log the access token to check
      console.log("Access token received:", access_token);

      // If the access token is present, we authenticate using Firebase
      if (access_token) {
        // Create a Google credential using the access token
        const credential = GoogleAuthProvider.credential(null, access_token); // No ID token, using access token

        // Sign in to Firebase using the Google credential (access token)
        signInWithCredential(auth, credential)
          .then((userCredential) => {
            console.log("User signed in", userCredential.user); // Log user info for debugging
          })
          .catch((error) => {
            console.error("Sign-in error:", error.code, error.message); // Catch any Firebase errors
          });
      } else {
        console.error("No access token found in response params.");
      }
    } else if (response?.type === "error") {
      console.error("Google Sign-In Error: ", response.error);
    }
  }, [response]);

  return { promptAsync }; // Return the function to trigger the Google sign-in flow
}
