import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

// Initialize admin app
initializeApp()
const db = getFirestore()

export const updateCommentMetadata = onDocumentCreated(
  'log_posts/{postId}/comments/{commentId}',
  async (event) => {
    const { postId } = event.params

    try {
      await db.collection('log_posts').doc(postId).update({
        latestCommentAt: FieldValue.serverTimestamp()
      })

      console.log(`Updated latestCommentAt for post ${postId}`)
    } catch (error) {
      console.error('Error updating comment metadata:', error)
    }
  }
)