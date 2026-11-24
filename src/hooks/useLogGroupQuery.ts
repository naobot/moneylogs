import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  runTransaction,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { getUserDocRef, useMutation } from "./useFirebase";

type AddNewLogGroupArgs = {
  title: string;
  max_participants: number;
  startWallClock: string;
  endWallClock: string;
  currentUserId: string;
};

type AddMemberToGroupArgs = {
  currentUserId: string;
  groupId: string;
};

type AddGroupToMemberArgs = {
  currentUserId: string;
  groupId: string;
};

export const useLogGroupQuery = () => {
  const groupsCollectionRef = collection(db, "log_groups");

  // Core mutation functions
  const addNewLogGroupFn = async ({
    title,
    max_participants,
    startWallClock,
    endWallClock,
    currentUserId,
  }: AddNewLogGroupArgs): Promise<string> => {
    const { userDocRef } = await getUserDocRef(currentUserId);

    const res = await addDoc(groupsCollectionRef, {
      title,
      max_participants,
      startWallClock,
      endWallClock,
      // UTC timestamps computed from creator's local timezone — used as fallback for legacy code paths
      start: Timestamp.fromDate(new Date(startWallClock)),
      end: Timestamp.fromDate(new Date(endWallClock)),
      createdAt: serverTimestamp(),
      createdBy: currentUserId, // auth uid; only the creator can delete the group
      members: [userDocRef],
    });

    if (!res?.id) {
      throw new Error("Failed to create log group");
    }

    // Add group to member's groups array
    await addGroupToMemberFn({ currentUserId, groupId: res.id });

    return res.id;
  };

  const addGroupToMemberFn = async ({
    currentUserId,
    groupId,
  }: AddGroupToMemberArgs): Promise<boolean> => {
    const { userDocRef } = await getUserDocRef(currentUserId);

    await runTransaction(db, async (transaction) => {
      console.log("⬇️ executing read on users collection");

      const userDoc = await transaction.get(userDocRef);
      if (!userDoc.exists()) {
        throw new Error("User does not exist");
      }

      const existingGroups = userDoc.data()?.groups || [];
      if (existingGroups.includes(groupId)) {
        return; // Already a member
      }

      const newGroupsList = [groupId, ...existingGroups];
      transaction.update(userDocRef, { groups: newGroupsList });
    });

    return true;
  };

  // Join through the invite page: the log's members and the user's own `groups` list
  // change together, so a join refused for lack of room (the rules check capacity too)
  // leaves neither behind.
  const joinGroupFn = async ({
    currentUserId,
    groupId,
  }: AddMemberToGroupArgs): Promise<boolean> => {
    const groupDocRef = doc(db, "log_groups", groupId);
    const { userDocId, userDocRef } = await getUserDocRef(currentUserId);

    await runTransaction(db, async (transaction) => {
      const groupDoc = await transaction.get(groupDocRef);
      if (!groupDoc.exists()) throw new Error("Log group does not exist");
      const userDoc = await transaction.get(userDocRef);
      if (!userDoc.exists()) throw new Error("User does not exist");

      const existingMembers: { path: string }[] = groupDoc.data().members || [];
      const isMember = existingMembers.some((ref) => ref.path === `users/${userDocId}`);
      if (!isMember) {
        if (existingMembers.length >= (groupDoc.data().max_participants ?? 0)) {
          throw new Error("This log is full.");
        }
        transaction.update(groupDocRef, { members: [userDocRef, ...existingMembers] });
      }

      const existingGroups: string[] = userDoc.data().groups || [];
      if (!existingGroups.includes(groupId)) {
        transaction.update(userDocRef, { groups: [groupId, ...existingGroups] });
      }
    });

    return true;
  };

  // Only the creator is offered this (LogTitleSection), and the rules allow only them.
  const updateLogGroupTitleFn = async ({
    groupId,
    title,
  }: {
    groupId: string;
    title: string;
  }): Promise<boolean> => {
    await updateDoc(doc(db, "log_groups", groupId), { title: title.trim() });
    return true;
  };

  const addNewLogGroupMutation = useMutation(addNewLogGroupFn);
  const joinGroupMutation = useMutation(joinGroupFn);
  const addGroupToMemberMutation = useMutation(addGroupToMemberFn);

  return {
    addNewLogGroup: addNewLogGroupMutation,
    joinGroup: joinGroupMutation,
    addGroupToMember: addGroupToMemberMutation,
    updateLogGroupTitle: useMutation(updateLogGroupTitleFn),
    addNewLogGroupFn,
    joinGroupFn,
    addGroupToMemberFn,
  };
};
