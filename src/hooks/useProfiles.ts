import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/config/firebase-config";

/**
 * profiles/{userDocId}: the public face of a user, written only by the mirrorProfile
 * Cloud Function from users/{id}. Safe to read for anyone; never holds email or prefs.
 */
export type Profile = {
  id: string;
  displayName: string;
  displayLocation: string | null;
  timezone: string | null;
  avatar: string[] | null;
};

const toProfile = (id: string, data: Record<string, unknown> | undefined): Profile => ({
  id,
  displayName: typeof data?.displayName === "string" ? data.displayName : "someone",
  displayLocation: typeof data?.displayLocation === "string" ? data.displayLocation : null,
  timezone: typeof data?.timezone === "string" ? data.timezone : null,
  avatar: Array.isArray(data?.avatar) ? (data.avatar as string[]) : null,
});

/** One profile, live. `profile` is null once loaded if there's no such user. */
export const useProfile = (userDocId?: string) => {
  const [state, setState] = useState<{ profile: Profile | null; isLoading: boolean }>({
    profile: null,
    isLoading: !!userDocId,
  });

  useEffect(() => {
    if (!userDocId) {
      setState({ profile: null, isLoading: false });
      return;
    }
    setState((prev) => ({ ...prev, isLoading: true }));
    return onSnapshot(
      doc(db, "profiles", userDocId),
      (snap) =>
        setState({
          profile: snap.exists() ? toProfile(snap.id, snap.data()) : null,
          isLoading: false,
        }),
      (error) => {
        console.error("Failed to load profile:", error);
        setState({ profile: null, isLoading: false });
      },
    );
  }, [userDocId]);

  return state;
};

const IN_LIMIT = 30;

/**
 * Several profiles by doc id, live, as a Map. Ids without a profile (deleted accounts)
 * are simply absent, so callers can fall back to "deleted user".
 */
export const useProfiles = (userDocIds: ReadonlyArray<string>) => {
  const key = useMemo(() => [...new Set(userDocIds)].sort().join("|"), [userDocIds]);
  const [profiles, setProfiles] = useState<ReadonlyMap<string, Profile>>(new Map());

  useEffect(() => {
    const ids = key ? key.split("|") : [];
    if (!ids.length) {
      setProfiles(new Map());
      return;
    }
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += IN_LIMIT) chunks.push(ids.slice(i, i + IN_LIMIT));
    const results: Profile[][] = chunks.map(() => []);

    const unsubs = chunks.map((chunk, index) =>
      onSnapshot(
        query(collection(db, "profiles"), where("__name__", "in", chunk)),
        (snap) => {
          results[index] = snap.docs.map((d) => toProfile(d.id, d.data()));
          setProfiles(new Map(results.flat().map((p) => [p.id, p])));
        },
        (error) => console.error("Failed to load profiles:", error),
      ),
    );
    return () => unsubs.forEach((unsub) => unsub());
  }, [key]);

  return profiles;
};
