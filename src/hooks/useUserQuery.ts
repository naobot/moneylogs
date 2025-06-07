import { doc, serverTimestamp, updateDoc } from "firebase/firestore"
// @ts-ignore
import { db } from '@/config/firebase-config'
import { useMutation, getUserDocRef } from "./useFirebase"

type UpdateViewTrackingArgs = {
  userId: string
  logGroupId: string
  viewedUserId: string
}

type UpdateDisplayNameArgs = {
  userId: string
  displayName: string
}

export const useUserQuery = () => {
  // Core mutation functions
  const updateViewTrackingFn = async ({ userId, logGroupId, viewedUserId }: UpdateViewTrackingArgs): Promise<void> => {
    const { userDocRef } = await getUserDocRef(userId)

    // viewedUserId is also the auth id so get the doc ref id first
    const { userDocRef: viewedUserDocRef} = await getUserDocRef(viewedUserId)

    await updateDoc(userDocRef, {
      [`viewTracking.${logGroupId}.${viewedUserDocRef?.id}.lastViewedAt`]: serverTimestamp()
    })

    // console.log(`📝 update view tracking: ${userDocRef?.id} viewed ${viewedUserDocRef?.id}`)
  }

  const updateDisplayNameFn = async ({ userId, displayName }: UpdateDisplayNameArgs): Promise<void> => {
    const { userDocRef } = await getUserDocRef(userId)

    await updateDoc(userDocRef, {
      displayName
    })
  }

  const markCommentsAsViewedFn = async ({ userId, logPostId }: { userId: string, logPostId: string }): Promise<void> => {
    const { userDocRef } = await getUserDocRef(userId)

    await updateDoc(userDocRef, {
      [`commentSubscriptions.${logPostId}.lastViewedAt`]: serverTimestamp()
    })
  }

  // Mutations
  const updateViewTrackingMutation = useMutation(updateViewTrackingFn)
  const updateDisplayNameMutation = useMutation(updateDisplayNameFn)

  return {
    updateViewTracking: updateViewTrackingMutation,
    updateViewTrackingFn,
    updateDisplayName: updateDisplayNameMutation,
    updateDisplayNameFn,
    markCommentsAsViewedFn,
  }
}