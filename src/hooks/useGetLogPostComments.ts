import { collection, orderBy, query } from "firebase/firestore"
import { Comment } from "../types/user" // assuming you have a Comment type
import { db } from '../config/firebase-config'
import { useFirebaseCollection } from "./useFirebase"

export const useGetComments = ({ logPostId }: { logPostId: string | null }) => {
  return useFirebaseCollection<Comment>({
    queryBuilder: () => {
      if (!logPostId) return null
      return query(
        collection(db, 'log_posts', logPostId, 'comments'),
        orderBy('createdAt', 'asc')
      )
    },
    dataTransformer: (docs) => docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Comment[],
    dependencies: [logPostId],
    enabled: !!logPostId
  })
}