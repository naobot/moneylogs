import { doc, serverTimestamp, updateDoc } from "firebase/firestore"
// @ts-ignore
import { db } from '@/config/firebase-config'
import { useMutation, getUserDocRef } from "./useFirebase"

type UpdateViewTrackingArgs = {
  userId: string
  logGroupId: string
  viewedUserId: string
  userMap: Map<string, string>
}

type UpdateUserProfileArgs = {
  userId: string
  displayName: string
  displayLocation?: string
  timezone: string
}

export const useUserQuery = () => {
  // Core mutation functions
  const updateViewTrackingFn = async ({ userId, logGroupId, viewedUserId }: UpdateViewTrackingArgs): Promise<void> => {
    // const { userDocRef } = await getUserDocRef(userId)

    // console.log('⬇️ executing read on users collection')
    // viewedUserId is also the auth id so get the doc ref id first
    // const { userDocRef: viewedUserDocRef} = await getUserDocRef(viewedUserId)

    console.log('✍️ executing write on users collection')
    await updateDoc(doc(db, 'users', userId), {
      [`viewTracking.${logGroupId}.${viewedUserId}.lastViewedAt`]: serverTimestamp()
    })
  }

  const updateUserProfileFn = async ({ userId, displayName, displayLocation, timezone }: UpdateUserProfileArgs): Promise<void> => {
    const { userDocRef } = await getUserDocRef(userId)

    console.log('✍️ executing write on users collection')
    await updateDoc(userDocRef, {
      displayName,
      displayLocation,
      timezone,
    })
  }

  const markCommentsAsViewedFn = async ({ userId, logPostId }: { userId: string, logPostId: string }): Promise<void> => {
    const { userDocRef } = await getUserDocRef(userId)

    console.log('✍️ executing write on users collection')
    await updateDoc(userDocRef, {
      [`commentSubscriptions.${logPostId}.lastViewedAt`]: serverTimestamp()
    })
  }

  // Mutations
  const updateViewTrackingMutation = useMutation(updateViewTrackingFn)
  const updateUserProfileMutation = useMutation(updateUserProfileFn)

  return {
    updateViewTracking: updateViewTrackingMutation,
    updateViewTrackingFn,
    updateUserProfile: updateUserProfileMutation,
    updateUserProfileFn,
    markCommentsAsViewedFn,
  }
}