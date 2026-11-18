import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "@/config/firebase-config";
import { reportError } from "@/utils/reportError";

/**
 * Someone's public friends list, live, from friendLists/{userDocId} (server-written by
 * mirrorFriendList). `friends` is null when they don't show their list: the doc only
 * exists while `users.showFriends` is on, and it already leaves out anyone who opted out
 * of appearing on friends lists.
 */
export const useFriendList = (userDocId?: string) => {
  const [state, setState] = useState<{ friends: string[] | null; isLoading: boolean }>({
    friends: null,
    isLoading: !!userDocId,
  });

  useEffect(() => {
    if (!userDocId) {
      setState({ friends: null, isLoading: false });
      return;
    }
    setState({ friends: null, isLoading: true });
    return onSnapshot(
      doc(db, "friendLists", userDocId),
      (snap) => {
        const friends = snap.get("friends");
        setState({
          friends: snap.exists() && Array.isArray(friends) ? (friends as string[]) : null,
          isLoading: false,
        });
      },
      (error) => {
        reportError(error, { feature: "profile", action: "load_friend_list" });
        setState({ friends: null, isLoading: false });
      },
    );
  }, [userDocId]);

  return state;
};
