import { createContext, useContext } from "react";

/**
 * Display names of the group's members, by users-collection doc id. Group provides it
 * once so deeply nested post items (reaction chips) can name who reacted without each
 * one subscribing to the members list. Empty outside a group.
 */
export const MemberNamesContext = createContext<ReadonlyMap<string, string>>(new Map());

export const useMemberNames = () => useContext(MemberNamesContext);

/** A member's public face, from profiles/{id}. */
export type MemberProfile = { displayName: string; avatar: string[] | null };

/**
 * The group's members' public profiles (avatars), by user doc id. Like
 * MemberNamesContext, provided once by Group. Missing ids (deleted accounts, profiles
 * still loading) fall back to the initial-in-a-square avatar.
 */
export const MemberProfilesContext = createContext<ReadonlyMap<string, MemberProfile>>(new Map());

export const useMemberProfile = (userDocId?: string | null): MemberProfile | undefined => {
  const profiles = useContext(MemberProfilesContext);
  return userDocId ? profiles.get(userDocId) : undefined;
};
