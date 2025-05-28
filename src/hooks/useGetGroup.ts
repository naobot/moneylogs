import { useEffect, useState } from "react"
import { doc, getDoc, collection } from "firebase/firestore"
import { Group } from "../types/user"
// @ts-ignore
import { db } from '../config/firebase-config'

export const useGetGroup = (groupId: string) => {
  const [group, setGroup] = useState<Group>()
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState()

  // const groupsCollectionRef = collection(db, 'log_groups')

  const getGroup = async () => {
    setIsLoading(true)

    try {
      const docRef = doc(db, "log_groups", groupId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setGroup(({ id: groupId, ...docSnap.data() } as Group))
        setIsLoading(false)
        setIsSuccess(true)
      } else {
        // docSnap.data() will be undefined in this case
        throw Error("group log does not exist")
      }
    }
    catch (err) {
      console.log(err)
      setIsLoading(false)
      setIsError(true)
      setError(err)
    }
  }

  useEffect(() => {
    getGroup()
  }, [groupId])

  return {
    group,
    isSuccess,
    isLoading,
    isError,
    error,
  }
}
