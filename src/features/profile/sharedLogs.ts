import type { Group } from "@/types/user";

type MemberRef = { id?: string; path?: string };

const refId = (ref: MemberRef) => ref?.id ?? ref?.path?.split("/").pop() ?? "";

/**
 * Social logs (from the viewer's own) that the other person is also a member of,
 * most recently started first.
 */
export const sharedGroups = (myGroups: ReadonlyArray<Group>, otherUserDocId: string): Group[] =>
  myGroups
    .filter((g) => (g.members ?? []).some((ref) => refId(ref as MemberRef) === otherUserDocId))
    .sort((a, b) => (b.start?.toMillis?.() ?? 0) - (a.start?.toMillis?.() ?? 0));
