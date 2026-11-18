import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { reportError } from "@/utils/reportError";

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
        reportError(error, { feature: "profile", action: "load_profile" });
        setState({ profile: null, isLoading: false });
      },
    );
  }, [userDocId]);

  return state;
};

const IN_LIMIT = 30;

/** How someone whose account is gone (no profile) is named, once that's known. */
export const DELETED_USER = "deleted user";

const EMPTY: ReadonlyMap<string, Profile> = new Map();

export type ProfilesState = {
  /** The profiles found, by user doc id. Ids without one (deleted accounts) are absent. */
  profiles: ReadonlyMap<string, Profile>;
  /** Not every asked-for id has been looked up yet: absent doesn't mean deleted. (Profiles
   * already known from an earlier set of ids stay in `profiles` meanwhile.) */
  isLoading: boolean;
};

/**
 * The name to show for someone: their display name, `DELETED_USER` once their profile is
 * known to be gone, or undefined while it's still loading (show a placeholder, not
 * "deleted user").
 */
export const profileName = (
  { profiles, isLoading }: ProfilesState,
  userDocId: string,
): string | undefined =>
  profiles.get(userDocId)?.displayName ?? (isLoading ? undefined : DELETED_USER);

/**
 * Several profiles by doc id, live. Ids without a profile (deleted accounts) are absent
 * from `profiles` once `isLoading` is false; use `profileName` to name them.
 */
export const useProfiles = (userDocIds: ReadonlyArray<string>): ProfilesState => {
  const key = useMemo(() => [...new Set(userDocIds)].sort().join("|"), [userDocIds]);
  // Kept with the id set it answers, so a new set reads as loading, not as the old one.
  const [state, setState] = useState<{ key: string; profiles: Map<string, Profile> } | null>(null);

  useEffect(() => {
    const ids = key ? key.split("|") : [];
    if (!ids.length) return;
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += IN_LIMIT) chunks.push(ids.slice(i, i + IN_LIMIT));
    // A chunk's slot stays undefined until it has answered; until every chunk has, the
    // set is still loading.
    const results: Array<Profile[] | undefined> = chunks.map(() => undefined);
    const publish = () => {
      if (results.some((r) => r === undefined)) return;
      setState({ key, profiles: new Map(results.flat().map((p) => [p!.id, p!])) });
    };

    const unsubs = chunks.map((chunk, index) =>
      onSnapshot(
        query(collection(db, "profiles"), where("__name__", "in", chunk)),
        (snap) => {
          results[index] = snap.docs.map((d) => toProfile(d.id, d.data()));
          publish();
        },
        (error) => {
          reportError(error, { feature: "profile", action: "load_profiles" });
          // Show what did load rather than waiting forever; the rest read as gone.
          results[index] = results[index] ?? [];
          publish();
        },
      ),
    );
    return () => unsubs.forEach((unsub) => unsub());
  }, [key]);

  return useMemo(() => {
    if (!key) return { profiles: EMPTY, isLoading: false };
    // A profile is the same whichever set asked for it, so the ones already known keep
    // showing while a changed set loads; only the new ids wait.
    if (state?.key !== key) return { profiles: state?.profiles ?? EMPTY, isLoading: true };
    return { profiles: state.profiles, isLoading: false };
  }, [key, state]);
};
