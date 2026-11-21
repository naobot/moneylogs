import { useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";

import { functions } from "@/config/firebase-config";
import { useCurrentUser } from "@/contexts";
import { useFriendships } from "@/hooks/useFriendships";
import { storage } from "@/platform";
import { orderFriends } from "@/utils/friends";
import { reportError } from "@/utils/reportError";

const friendsByActivityCallable = httpsCallable<void, { friends: string[] }>(
  functions,
  "friendsByActivity",
);

/** The last order fetched on this device, per signed-in uid. */
export const orderCacheKey = (uid: string) => `ML__friends_order_${uid}`;

/** How long a cached order is used as-is, without asking the server again. */
export const ORDER_FRESH_MS = 30 * 60 * 1000;

export type CachedOrder = { at: number; order: string[] };

/** The cached order for `uid`, or undefined when there's none or it's malformed. */
export const readCachedOrder = (uid: string): CachedOrder | undefined => {
  const value = storage.getJSON<CachedOrder>(orderCacheKey(uid));
  return value &&
    typeof value.at === "number" &&
    Array.isArray(value.order) &&
    value.order.every((id) => typeof id === "string")
    ? value
    : undefined;
};

export const isFresh = (cached: CachedOrder, now: number) =>
  now - cached.at >= 0 && now - cached.at < ORDER_FRESH_MS;

/** One request per uid at a time, shared by every mount (StrictMode, quick re-visits). */
const inFlight = new Map<string, Promise<string[]>>();

const fetchOrder = (uid: string): Promise<string[]> => {
  const pending = inFlight.get(uid);
  if (pending) return pending;
  const request = friendsByActivityCallable()
    .then((result) => {
      const order = result.data.friends;
      storage.setJSON(orderCacheKey(uid), { at: Date.now(), order } satisfies CachedOrder);
      return order;
    })
    .finally(() => inFlight.delete(uid));
  inFlight.set(uid, request);
  return request;
};

/**
 * Your friends, most recently around first (worked out server-side; only the order comes
 * back). Membership stays live; the order is cached on the device:
 * - fresh cache (under 30 min): used as-is, no call;
 * - stale cache: shown straight away, and refreshed quietly for the next visit (so the
 *   list never reshuffles under you);
 * - no cache: the list waits for the call, which starts as soon as the uid is known when
 *   a cache says you had friends, rather than after the friendships query.
 * If the order can't be fetched, friends show in their usual order.
 */
export const useFriendsByActivity = () => {
  const { user } = useCurrentUser();
  const uid = user?.userId;
  const { friends, uidOf, isLoading: friendsLoading } = useFriendships();
  const hasFriends = friends.length > 0;

  // Read once per uid: a refresh only lands in storage, for the next visit.
  const cached = useMemo(() => (uid ? readCachedOrder(uid) : undefined), [uid]);
  // Only filled when there was no cache to show: undefined while waiting, null on failure.
  const [fetched, setFetched] = useState<string[] | null | undefined>(undefined);

  // With a cache this is settled on mount, so it asks once per visit at most.
  const shouldFetch = !!uid && (!!cached || hasFriends);

  useEffect(() => {
    if (!uid || !shouldFetch || (cached && isFresh(cached, Date.now()))) return;
    let cancelled = false;
    fetchOrder(uid)
      .then((order) => {
        if (!cancelled && !cached) setFetched(order);
      })
      .catch((err: unknown) => {
        // The list still shows, in the cached or usual order.
        reportError(err, { feature: "friends", action: "order_friends", level: "warning" });
        if (!cancelled && !cached) setFetched(null);
      });
    return () => {
      cancelled = true;
    };
  }, [uid, cached, shouldFetch]);

  const order = cached?.order ?? fetched ?? null;

  return {
    friends: orderFriends(friends, order),
    uidOf,
    isLoading: friendsLoading || (hasFriends && !cached && fetched === undefined),
  };
};
