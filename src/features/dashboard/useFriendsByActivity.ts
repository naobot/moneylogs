import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";

import { functions } from "@/config/firebase-config";
import { useFriendships } from "@/hooks/useFriendships";
import { orderFriends } from "@/utils/friends";
import { reportError } from "@/utils/reportError";

const friendsByActivityCallable = httpsCallable<void, { friends: string[] }>(
  functions,
  "friendsByActivity",
);

/**
 * Your friends, most recently around first (worked out server-side; only the order comes
 * back). The order is fetched once per visit; membership stays live. If the order can't
 * be fetched, friends show in their usual order.
 */
export const useFriendsByActivity = () => {
  const { friends, uidOf, isLoading: friendsLoading } = useFriendships();
  const [order, setOrder] = useState<string[] | null | undefined>(undefined);
  const hasFriends = friends.length > 0;

  useEffect(() => {
    if (!hasFriends || order !== undefined) return;
    let cancelled = false;
    friendsByActivityCallable()
      .then((result) => {
        if (!cancelled) setOrder(result.data.friends);
      })
      .catch((err: unknown) => {
        // The list still shows, just in its usual order.
        reportError(err, { feature: "friends", action: "order_friends", level: "warning" });
        if (!cancelled) setOrder(null);
      });
    return () => {
      cancelled = true;
    };
  }, [hasFriends, order]);

  return {
    friends: orderFriends(friends, order ?? null),
    uidOf,
    isLoading: friendsLoading || (hasFriends && order === undefined),
  };
};
