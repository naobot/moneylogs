import { addDoc, collection, serverTimestamp } from "firebase/firestore"
// @ts-ignore
import { db } from '../config/firebase-config'

export const useRegisterNewUser = () => {
  const usersCollectionRef = collection(db, 'users')
  const addNewUser = async ({ userId, displayName, email }) => {
    await addDoc(usersCollectionRef, {
      userId: userId,
      displayName: displayName,
      email: email,
      createdAt: serverTimestamp(),
      logs: [],
    })
  }

  return {
    addNewUser
  }
}