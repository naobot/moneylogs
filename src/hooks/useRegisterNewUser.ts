import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { useMutation } from "./useFirebase"
// @ts-ignore
import { db } from '@/config/firebase-config'

type AddNewUserArgs = {
  userId: string
  displayName: string
  email: string
}

export const useRegisterNewUser = () => {
  const usersCollectionRef = collection(db, 'users')

  const addNewUserFn = async ({ userId, displayName, email }: AddNewUserArgs): Promise<string> => {
    const docRef = await addDoc(usersCollectionRef, {
      userId,
      displayName,
      email,
      createdAt: serverTimestamp(),
      groups: [], // Initialize groups array instead of logs
    })

    if (!docRef?.id) {
      throw new Error('Failed to create user')
    }

    return docRef.id
  }

  const addNewUserMutation = useMutation(addNewUserFn)

  return {
    addNewUser: addNewUserMutation,
    addNewUserFn,
  }
}