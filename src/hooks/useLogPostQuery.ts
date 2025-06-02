import { addDoc, collection, serverTimestamp } from "firebase/firestore"
// @ts-ignore
import { db } from '../config/firebase-config'
import { getGroupDocRef, getUserDocRef, useMutation } from "./useFirebase"
import { Currency } from "../types/user"

type AddNewLogPostArgs = {
  groupId: string
  userId: string
  logData: LogData
}

export type LogData = {
  amount: number
  content: string
  currency: Currency
}

export const useLogPostQuery = () => {
  const logPostsCollectionRef = collection(db, 'log_posts')

  // Core mutation functions
  const addNewLogPostFn = async ({ groupId, userId, logData }: AddNewLogPostArgs): Promise<string> => {
    const { userDocRef, userName } = await getUserDocRef(userId)
    const { groupDocRef, groupName } = await getGroupDocRef(groupId)

    const res = await addDoc(logPostsCollectionRef, {
      amount: logData?.amount,
      currency: logData?.currency,
      content: logData?.content,
      author: userDocRef,
      authorName: userName,
      createdAt: serverTimestamp(),
      postDate: serverTimestamp(),
      group: groupDocRef,
      groupName,
    })

    if (!res?.id) {
      throw new Error('Failed to create log post')
    }

    return res.id
  }

  const addNewLogPostMutation = useMutation(addNewLogPostFn)

  return {
    addNewLogPost: addNewLogPostMutation,
    addNewLogPostFn,
  }
}