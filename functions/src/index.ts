import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

initializeApp()
const db = getFirestore()

// When a post is created, update both post metadata AND user tracking
export const updatePostMetadata = onDocumentCreated(
  'log_posts/{postId}',
  async (event) => {
    const postData = event.data?.data()
    const { postId } = event.params

    if (!postData?.author || !postData?.group) return

    const timestamp = FieldValue.serverTimestamp()

    try {
      // Batch these operations to use the same timestamp
      const batch = db.batch()

      // Update the user's lastUpdated field
      batch.update(db.collection('users').doc(postData.author.id), {
        [`lastUpdated.${postData.group.id}`]: timestamp
      })

      // Update the user's comment subscription (they're auto-subscribed to their own posts)
      batch.update(db.collection('users').doc(postData.author.id), {
        [`commentSubscriptions.${postId}.lastViewedAt`]: timestamp
      })

      await batch.commit()

      console.log(`Updated user metadata for post ${postId}`)
    } catch (error) {
      console.error('Error updating post metadata:', error)
    }
  }
)

// When a comment is created, update post's latestCommentAt
export const updateCommentMetadata = onDocumentCreated(
  'log_posts/{postId}/comments/{commentId}',
  async (event) => {
    const commentData = event.data?.data()
    const { postId } = event.params

    if (!commentData?.authorId) return

    const timestamp = FieldValue.serverTimestamp()

    try {
      const batch = db.batch()

      // Update post's latest comment timestamp
      batch.update(db.collection('log_posts').doc(postId), {
        latestCommentAt: timestamp
      })

      // Update the commenter's subscription tracking (they've now seen this comment)
      batch.update(db.collection('users').doc(commentData.authorId.id), {
        [`commentSubscriptions.${postId}.lastViewedAt`]: timestamp
      })

      await batch.commit()

      console.log(`Updated comment metadata for post ${postId}`)
    } catch (error) {
      console.error('Error updating comment metadata:', error)
    }
  }
)