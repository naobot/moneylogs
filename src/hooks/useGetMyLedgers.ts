import { useEffect } from "react";
import { collection, orderBy, query, where } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/config/firebase-config";
import { Ledger } from "@/types/ledger";
import { useFirebaseCollection } from "./useFirebase";

/** Financial logs the signed-in user is a member of, newest first. */
export const useGetMyLedgers = () => {
  const [firebaseUser] = useAuthState(auth);
  const uid = firebaseUser?.uid;

  const result = useFirebaseCollection<Ledger>({
    // `memberUids array-contains uid` is what lets security rules prove the list query.
    queryBuilder: () =>
      uid
        ? query(
            collection(db, "ledgers"),
            where("memberUids", "array-contains", uid),
            orderBy("createdAt", "desc"),
          )
        : null,
    dataTransformer: (docs) => docs.map((d) => ({ id: d.id, ...d.data() }) as Ledger),
    dependencies: [uid],
    enabled: !!uid,
  });

  useEffect(() => {
    // Surface failures (e.g. a missing index or a rules rejection) instead of silently
    // rendering "no financial logs".
    if (result.isError) console.error("Failed to load financial logs:", result.error);
  }, [result.isError, result.error]);

  // useFirebaseCollection starts with isLoading=false until its effect runs; report
  // loading until the first snapshot so callers (Home) don't flash a fallback layout.
  const isLoading = result.isLoading || (!!uid && !result.isSuccess && !result.isError);

  return { ...result, ledgers: result.data, isLoading };
};
