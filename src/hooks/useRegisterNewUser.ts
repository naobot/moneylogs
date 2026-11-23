import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useMutation } from "./useFirebase";
import { db } from "@/config/firebase-config";

type AddNewUserArgs = {
  userId: string;
  displayName: string;
  /** null for a guest (src/features/auth/guest.ts) until they save their account. */
  email: string | null;
};

export const useRegisterNewUser = () => {
  const usersCollectionRef = collection(db, "users");

  const addNewUserFn = async ({ userId, displayName, email }: AddNewUserArgs): Promise<string> => {
    const docRef = await addDoc(usersCollectionRef, {
      userId,
      displayName,
      email,
      createdAt: serverTimestamp(),
      groups: [], // Initialize groups array instead of logs
      // Routes them through /welcome until they've set up their profile (features/onboarding).
      onboardingPending: true,
    });

    if (!docRef?.id) {
      throw new Error("Failed to create user");
    }

    return docRef.id;
  };

  const addNewUserMutation = useMutation(addNewUserFn);

  return {
    addNewUser: addNewUserMutation,
    addNewUserFn,
  };
};
