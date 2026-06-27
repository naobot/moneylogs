import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  Query,
  QueryDocumentSnapshot,
  runTransaction,
  Transaction,
  where,
} from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { db } from "@/config/firebase-config";

export type FirebaseQuery<T> = {
  data: T[];
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: FirebaseError | null;
};

type MutationState = {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
};

export const useFirebaseCollection = <T>({
  queryBuilder,
  dataTransformer,
  dependencies = [],
  enabled = true,
}: {
  queryBuilder: () => Query | null;
  dataTransformer: (docs: QueryDocumentSnapshot[]) => T[];
  dependencies?: unknown[];
  enabled?: boolean;
}) => {
  const [state, setState] = useState<FirebaseQuery<T>>({
    data: [] as T[],
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: null,
  });

  useEffect(() => {
    if (!enabled) return;

    const query = queryBuilder();
    if (!query) return;

    setState((prev) => ({ ...prev, isLoading: true }));

    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        const data = snapshot.empty ? [] : dataTransformer(snapshot.docs);

        setState({
          data,
          isLoading: false,
          isSuccess: true,
          isError: false,
          error: null,
        });
      },
      (error) => {
        setState({
          data: [],
          isLoading: false,
          isSuccess: false,
          isError: true,
          error,
        });
      },
    );

    return unsubscribe;
  }, dependencies);

  return state;
};

export const useFirebaseTransaction = () => {
  const executeTransaction = async <T>(
    operation: (transaction: Transaction) => Promise<T>,
    errorMessage: string,
  ): Promise<T> => {
    try {
      return await runTransaction(db, operation);
    } catch (error) {
      console.error(`${errorMessage}:`, error);
      throw error;
    }
  };

  return { executeTransaction };
};

export const useMutation = <TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) => {
  const [state, setState] = useState<MutationState>({
    isLoading: false,
    isError: false,
    error: null,
  });

  const mutate = async (args: TArgs): Promise<TResult> => {
    setState({ isLoading: true, isError: false, error: null });
    try {
      const result = await mutationFn(args);
      setState({ isLoading: false, isError: false, error: null });
      return result;
    } catch (error) {
      setState({ isLoading: false, isError: true, error });
      throw error;
    }
  };

  return { mutate, ...state };
};

export const getUserDocRef = async (userId: string) => {
  // userId is the auth id not the doc id
  const usersCollectionRef = collection(db, "users");
  const queryUsers = query(usersCollectionRef, where("userId", "==", userId), limit(1));

  console.log("⬇️ executing read on users collection");
  const userSnapshot = await getDocs(queryUsers);
  if (userSnapshot.empty) {
    throw new Error("User does not exist");
  }

  const userDocId = userSnapshot.docs[0].id;
  const userName = userSnapshot.docs[0].data().displayName;
  return { userDocId, userName, userDocRef: doc(db, "users", userDocId) };
};

export const getGroupDocRef = async (groupId: string) => {
  const groupDocRef = doc(db, "log_groups", groupId); // Fixed collection name

  console.log("⬇️ executing read on log_groups collection");
  const groupSnapshot = await getDoc(groupDocRef);

  if (!groupSnapshot.exists()) {
    throw new Error(`Group with id ${groupId} does not exist`);
  }

  const groupName = groupSnapshot?.data()?.title;
  return {
    groupDocId: groupId,
    groupName,
    groupDocRef,
  };
};
