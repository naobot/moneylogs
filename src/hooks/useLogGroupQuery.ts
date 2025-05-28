import { addDoc, collection, doc, serverTimestamp, runTransaction, where, query, getDocs, Timestamp } from "firebase/firestore"
// @ts-ignore
import { db } from '../config/firebase-config'

export const useLogGroupQuery = () => {
  const groupsCollectionRef = collection(db, 'log_groups')
  const usersCollectionRef = collection(db, 'users')

  const addNewLogGroup = async ({ title, max_participants, start, end, currentUserId }) => {
    try {
      const res = await addDoc(groupsCollectionRef, {
        title: title,
        max_participants: max_participants,
        start: Timestamp.fromDate(new Date(start)),
        end: Timestamp.fromDate(new Date(end)),
        createdAt: serverTimestamp(),
        members: [currentUserId],
      })

      if (res?.id) {
        await addGroupToMember({
          currentUserId: currentUserId,
          groupId: res.id
        })
        return res.id
      }
    } catch (error) {
      console.error("Error adding new log group:", error)
      throw error
    }
  }

  const addGroupToMember = async ({ currentUserId, groupId }) => {
    try {
      // Use getDocs instead of onSnapshot for a one-time read
      const queryUsers = query(
        usersCollectionRef,
        where('userId', '==', currentUserId),
      )

      const snapshot = await getDocs(queryUsers)

      if (!snapshot.empty) {
        const userDocId = snapshot.docs[0].id
        const userDocRef = doc(db, 'users', userDocId)

        await runTransaction(db, async (transaction) => {
          const userDoc = await transaction.get(userDocRef)

          if (!userDoc.exists()) {
            throw new Error('user does not exist')
          }

          const existingGroups = userDoc.data()?.groups || []

          if (existingGroups.length > 0 && !existingGroups.includes(groupId)) {
            const newGroupsList = [groupId, ...existingGroups]
            transaction.update(userDocRef, { groups: newGroupsList })
          } else {
            transaction.update(userDocRef, { groups: [groupId] })
          }
        })

        return true
      }
      return false
    } catch (error) {
      console.error('Add group to member failed:', error)
      throw error
    }
  }

  const addMemberToGroup = async ({ currentUserId, groupId }) => {
    const groupDocRef = doc(db, 'log_groups', groupId)

    try {
      await runTransaction(db, async (transaction) => {
        const groupDoc = await transaction.get(groupDocRef)

        if (!groupDoc.exists()) {
          throw new Error('log group does not exist')
        }

        const existingMembers = groupDoc.data()?.members || []

        if (!existingMembers.includes(currentUserId)) {
          const newMembersList = [currentUserId, ...existingMembers]
          transaction.update(groupDocRef, { members: newMembersList })
        }
      })

      return true
    } catch (error) {
      console.error('Add member to group failed:', error)
      throw error
    }
  }

  return {
    addNewLogGroup,
    addMemberToGroup,
    addGroupToMember,
  }
}