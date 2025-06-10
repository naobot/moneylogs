import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

admin.initializeApp()

export const updateCommentMetadata = functions.firestore
  .document('log_posts/{postId}/comments/{commentId}')
  .onCreate(async (snap, context) => {
    const { postId } = context.params

    // Update the parent post's latestCommentAt field
    await admin.firestore()
      .collection('log_posts')
      .doc(postId)
      .update({
        latestCommentAt: admin.firestore.FieldValue.serverTimestamp()
      })
  })