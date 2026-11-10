import { createContext, useContext } from "react";

/**
 * Display names of the group's members, by users-collection doc id. Group provides it
 * once so deeply nested post items (reaction chips) can name who reacted without each
 * one subscribing to the members list. Empty outside a group.
 */
export const MemberNamesContext = createContext<ReadonlyMap<string, string>>(new Map());

export const useMemberNames = () => useContext(MemberNamesContext);
