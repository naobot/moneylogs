import { doc, serverTimestamp, updateDoc } from "firebase/firestore"
// @ts-ignore
import { db } from '@/config/firebase-config'
import { useMutation, getUserDocRef } from "./useFirebase"

type UpdateViewTrackingArgs = {
  userId: string
  logGroupId: string
  viewedUserId: string
}

type UpdateUserProfileArgs = {
  userId: string
  displayName: string
  displayLocation?: string
  timezone: string
}

type UpdatePinnedPostArgs = {
  userId: string
  logGroupId: string
  postId: string
}

export const useUserQuery = () => {
  // Core mutation functions
  const updateViewTrackingFn = async ({ userId, logGroupId, viewedUserId }: UpdateViewTrackingArgs): Promise<void> => {
    console.log('✍️ executing write on users collection')

    await updateDoc(doc(db, 'users', userId), {
      [`viewTracking.${logGroupId}.${viewedUserId}.lastViewedAt`]: serverTimestamp()
    })
  }

  const updateUserProfileFn = async ({ userId, displayName, displayLocation, timezone }: UpdateUserProfileArgs): Promise<void> => {
    console.log('✍️ executing write on users collection')

    await updateDoc(doc(db, 'users', userId), {
      displayName,
      displayLocation,
      timezone,
    })
  }

  const markCommentsAsViewedFn = async ({ userId, logPostId }: { userId: string, logPostId: string }): Promise<void> => {
    console.log('✍️ executing write on users collection')

    await updateDoc(doc(db, 'users', userId), {
      [`commentSubscriptions.${logPostId}.lastViewedAt`]: serverTimestamp()
    })
  }

  const updatePinnedPostFn = async ({ userId, logGroupId, postId }: UpdatePinnedPostArgs): Promise<void> => {
    console.log('✍️ executing write on users collection')

    await updateDoc(doc(db, 'users', userId), {
      [`pinnedPosts.${logGroupId}.pinnedPost`]: postId
    })
  }

  // Mutations
  const updateViewTrackingMutation = useMutation(updateViewTrackingFn)
  const updateUserProfileMutation = useMutation(updateUserProfileFn)
  const updatePinnedPostMutation = useMutation(updatePinnedPostFn)

  return {
    updateViewTracking: updateViewTrackingMutation,
    updateViewTrackingFn,
    updateUserProfile: updateUserProfileMutation,
    updateUserProfileFn,
    markCommentsAsViewedFn,
    updatePinnedPost: updatePinnedPostMutation,
    updatePinnedPostFn,
  }
}