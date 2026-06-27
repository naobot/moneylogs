export type OrderableMember = { id: string };

export const applyMemberOrder = <T extends OrderableMember>(
  members: T[],
  savedIds: string[],
  currentUserId?: string,
): T[] => {
  if (savedIds.length) {
    const idToMember = new Map(members.map((m) => [m.id, m]));
    const ordered = savedIds.flatMap((id) => {
      const m = idToMember.get(id);
      return m ? [m] : [];
    });
    const orderedSet = new Set(savedIds);
    const newMembers = members.filter((m) => !orderedSet.has(m.id));
    return [...ordered, ...newMembers];
  }
  const myMember = members.find((m) => m.id === currentUserId);
  const others = members.filter((m) => m.id !== currentUserId);
  return myMember ? [myMember, ...others] : members;
};
