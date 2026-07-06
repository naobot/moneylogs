import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { Group } from "@/types/user";
import { db } from "@/config/firebase-config";

export const useGetGroup = (groupId?: string) => {
  const [state, setState] = useState({
    group: undefined as Group | undefined,
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: undefined as unknown,
  });

  useEffect(() => {
    if (!groupId) return;

    setState((prev) => ({ ...prev, isLoading: true }));

    // Listen live so membership changes (and a stale initial read on refresh)
    // surface without a remount — the same reason useGetGroupUsers subscribes.
    console.log("🔄 setting up real-time listener on log_groups collection");
    const unsubscribe = onSnapshot(
      doc(db, "log_groups", groupId),
      (docSnap) => {
        if (docSnap.exists()) {
          setState({
            group: { id: groupId, ...docSnap.data() } as Group,
            isLoading: false,
            isSuccess: true,
            isError: false,
            error: undefined,
          });
        } else {
          setState({
            group: undefined,
            isLoading: false,
            isSuccess: false,
            isError: true,
            error: new Error("Group does not exist"),
          });
        }
      },
      (err) => {
        setState({
          group: undefined,
          isLoading: false,
          isSuccess: false,
          isError: true,
          error: err,
        });
      },
    );

    return () => {
      console.log("🔌 cleaning up log_groups real-time listener");
      unsubscribe();
    };
  }, [groupId]);

  return {
    // Retained for API compatibility; the live listener keeps data current, so a
    // manual refetch is no longer needed.
    refetch: () => {},
    ...state,
  };
};
