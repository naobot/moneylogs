import { useEffect, useState } from "react"
import { doc, getDoc } from "firebase/firestore"
import { Group } from "../types/user"
// @ts-ignore
import { db } from '../config/firebase-config'

export const useGetGroup = (groupId?: string) => {
  const [state, setState] = useState({
    group: undefined as Group | undefined,
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: undefined as any,
  })

  const fetchGroup = async () => {
    setState(prev => ({ ...prev, isLoading: true }))

    try {
      const docRef = doc(db, "log_groups", groupId)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        setState({
          group: { id: groupId, ...docSnap.data() } as Group,
          isLoading: false,
          isSuccess: true,
          isError: false,
          error: undefined
        })
      } else {
        throw new Error("Group does not exist")
      }
    } catch (err) {
      setState({
        group: undefined,
        isLoading: false,
        isSuccess: false,
        isError: true,
        error: err
      })
    }
  }

  useEffect(() => {
    if (!groupId) return

    fetchGroup()
  }, [groupId])

  return {
    refetch: () => { fetchGroup() },
    ...state
  }
}