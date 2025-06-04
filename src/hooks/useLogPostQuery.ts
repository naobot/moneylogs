import { addDoc, collection, deleteDoc, doc, increment, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore"
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
  postDate: number
}

type AddCommentArgs = {
  logPostId: string
  userId: string
  content: string
}

type DeleteCommentArgs = {
  logPostId: string
  commentId: string
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
      postDate: Timestamp.fromMillis(logData?.postDate),
      group: groupDocRef,
      groupName,
    })
    if (!res?.id) {
      throw new Error('Failed to create log post')
    }
    return res.id
  }

  const deleteLogPostFn = async ({ logPostId }: { logPostId: string }): Promise<void> => {
    await deleteDoc(doc(db, 'log_posts', logPostId))
  }

  const addCommentFn = async ({ logPostId, userId, content }: AddCommentArgs): Promise<string> => {
    const { userDocRef, userName } = await getUserDocRef(userId)

    // Add the comment to the subcollection
    const commentRes = await addDoc(collection(db, 'log_posts', logPostId, 'comments'), {
      authorId: userDocRef,
      authorName: userName,
      content,
      createdAt: serverTimestamp()
    })

    // Increment the counter on the parent log post
    await updateDoc(doc(db, 'log_posts', logPostId), {
      commentCount: increment(1)
    })

    if (!commentRes?.id) {
      throw new Error('Failed to create comment')
    }
    return commentRes.id
  }

  const deleteCommentFn = async ({ logPostId, commentId }: DeleteCommentArgs): Promise<void> => {
    await deleteDoc(doc(db, 'log_posts', logPostId, 'comments', commentId))

    // Decrement the counter
    await updateDoc(doc(db, 'log_posts', logPostId), {
      commentCount: increment(-1)
    })
  }

  // Mutations
  const addNewLogPostMutation = useMutation(addNewLogPostFn)
  const addCommentMutation = useMutation(addCommentFn)
  const deleteCommentMutation = useMutation(deleteCommentFn)
  const deleteLogPostMutation = useMutation(deleteLogPostFn)

  return {
    addNewLogPost: addNewLogPostMutation,
    addNewLogPostFn,
    addComment: addCommentMutation,
    addCommentFn,
    deleteComment: deleteCommentMutation,
    deleteCommentFn,
    deleteLogPost: deleteLogPostMutation,
    deleteLogPostFn,
  }
}