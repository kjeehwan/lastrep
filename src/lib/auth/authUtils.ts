import { auth } from "@/firebaseConfig";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  User,
} from "firebase/auth";

// Unified result type for all auth operations
export type AuthResult =
  | { success: true; user: User }
  | { success: false; message: string };

// ─── Sign Up ───
export const signUpUser = async (
  email: string,
  password: string
): Promise<AuthResult> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error: any) {
    return { success: false, message: error.message || "Sign-up failed. Please try again." };
  }
};

// ─── Sign In ───
export const signInUser = async (
  email: string,
  password: string
): Promise<AuthResult> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error: any) {
    return { success: false, message: error.message || "Sign-in failed. Please check your credentials." };
  }
};

// ─── Type guard (optional but useful) ───
export function isAuthError(result: AuthResult): result is { success: false; message: string } {
  return result.success === false;
}
