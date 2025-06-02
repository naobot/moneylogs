import { addDoc, collection, doc, serverTimestamp, runTransaction, where, query, getDocs, Timestamp } from "firebase/firestore"
// @ts-ignore
import { db } from '../config/firebase-config'
import { getUserDocRef, useMutation } from "./useFirebase"

type AddNewLogGroupArgs = {
  title: string
  max_participants: number
  start: string | Date
  end: string | Date
  currentUserId: string
}

type AddMemberToGroupArgs = {
  currentUserId: string
  groupId: string
}

type AddGroupToMemberArgs = {
  currentUserId: string
  groupId: string
}

export const useLogGroupQuery = () => {
  const groupsCollectionRef = collection(db, 'log_groups')
  // const usersCollectionRef = collection(db, 'users')

  // // Helper function to get user document reference
  // const getUserDocRef = async (currentUserId: string) => {
  //   const queryUsers = query(
  //     usersCollectionRef,
  //     where('userId', '==', currentUserId),
  //   )
  //   const userSnapshot = await getDocs(queryUsers)
  //   if (userSnapshot.empty) {
  //     throw new Error('User does not exist')
  //   }

  //   const userDocId = userSnapshot.docs[0].id
  //   return { userDocId, userDocRef: doc(db, 'users', userDocId) }
  // }

  // Core mutation functions
  const addNewLogGroupFn = async ({ title, max_participants, start, end, currentUserId }: AddNewLogGroupArgs): Promise<string> => {
    const { userDocRef } = await getUserDocRef(currentUserId)

    const res = await addDoc(groupsCollectionRef, {
      title,
      max_participants,
      start: Timestamp.fromDate(new Date(start)),
      end: Timestamp.fromDate(new Date(end)),
      createdAt: serverTimestamp(),
      members: [userDocRef],
    })

    if (!res?.id) {
      throw new Error('Failed to create log group')
    }

    // Add group to member's groups array
    await addGroupToMemberFn({ currentUserId, groupId: res.id })

    return res.id
  }

  const addGroupToMemberFn = async ({ currentUserId, groupId }: AddGroupToMemberArgs): Promise<boolean> => {
    const { userDocRef } = await getUserDocRef(currentUserId)

    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userDocRef)
      if (!userDoc.exists()) {
        throw new Error('User does not exist')
      }

      const existingGroups = userDoc.data()?.groups || []
      if (existingGroups.includes(groupId)) {
        return // Already a member
      }

      const newGroupsList = [groupId, ...existingGroups]
      transaction.update(userDocRef, { groups: newGroupsList })
    })

    return true
  }

  const addMemberToGroupFn = async ({ currentUserId, groupId }: AddMemberToGroupArgs): Promise<boolean> => {
    const groupDocRef = doc(db, 'log_groups', groupId)

    await runTransaction(db, async (transaction) => {
      const groupDoc = await transaction.get(groupDocRef)
      if (!groupDoc.exists()) {
        throw new Error('Log group does not exist')
      }

      const { userDocId, userDocRef } = await getUserDocRef(currentUserId)
      const existingMembers = groupDoc.data()?.members || []

      // Check if user reference already exists
      const userRefExists = existingMembers.some(memberRef =>
        memberRef.path === `users/${userDocId}`
      )

      if (!userRefExists) {
        const newMembersList = [userDocRef, ...existingMembers]
        transaction.update(groupDocRef, { members: newMembersList })
      }
    })

    return true
  }

  const addNewLogGroupMutation = useMutation(addNewLogGroupFn)
  const addMemberToGroupMutation = useMutation(addMemberToGroupFn)
  const addGroupToMemberMutation = useMutation(addGroupToMemberFn)

  return {
    addNewLogGroup: addNewLogGroupMutation,
    addMemberToGroup: addMemberToGroupMutation,
    addGroupToMember: addGroupToMemberMutation,
    addNewLogGroupFn,
    addMemberToGroupFn,
    addGroupToMemberFn,
  }
}