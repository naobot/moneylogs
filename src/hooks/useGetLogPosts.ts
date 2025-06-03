import { collection, where, orderBy, query, doc, limit } from "firebase/firestore"
import { LogPost } from "../types/user"
import { db } from '../config/firebase-config'
import { useGetUserInfo } from "./useGetUserInfo"
import { useFirebaseCollection } from "./useFirebase"

export const useGetLogPosts = ({ groupId, userId }) => {
  const { user } = useGetUserInfo(userId)

  return useFirebaseCollection<LogPost>({
    queryBuilder: () => {
      if (!user?.id || !groupId) return null

      return query(
        collection(db, 'log_posts'),
        where('author', '==', doc(db, 'users', user.id)),
        where('group', '==', doc(db, 'log_groups', groupId)),
        orderBy('postDate', 'desc'),
        limit(100),
      )
    },
    dataTransformer: (docs) => docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as LogPost[],
    dependencies: [user?.id, groupId],
    enabled: !!user?.id && !!groupId
  })
}