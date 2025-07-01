import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { onCall } from 'firebase-functions/https'

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

      batch.update(db.collection('log_posts').doc(postId), {
        createdAt: timestamp
      })

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

export const processGroupAnalytics = onCall(async (request) => {
  const { groupId } = request.data

  if (!groupId) {
    throw new Error('Group ID is required')
  }

  try {
    // Set up progress tracking
    await updateProgress(groupId, "Gathering group data...", 10)

    // Fetch all log posts for this group
    const logPosts = await fetchGroupLogPosts(groupId)
    await updateProgress(groupId, "Processing spending data...", 40)

    const postsMetadata = await backfillPostMetadata(logPosts)

    // Calculate raw analytics
    const analytics = {
      isCalculated: true,
      processedAt: FieldValue.serverTimestamp(),
      raw: calculateRawAnalytics(logPosts),
      posts: postsMetadata
    }

    await updateProgress(groupId, "Saving results...", 80)

    // Update group document
    await db.collection('log_groups').doc(groupId).update({ analytics })

    await updateProgress(groupId, "Complete!", 100)

    // Clean up the processing document after a short delay
    setTimeout(async () => {
      try {
        await db.collection('processing').doc(groupId).delete()
        console.log(`Cleaned up processing document for group ${groupId}`)
      } catch (cleanupError) {
        console.warn(`Failed to cleanup processing document for ${groupId}:`, cleanupError)
        // Don't throw here - the main operation succeeded
      }
    }, 5000) // 5 second delay to ensure client sees "Complete!" status

    return { success: true }

  } catch (error) {
    console.error('Analytics processing failed:', error)

    // Also cleanup on failure
    try {
      await db.collection('processing').doc(groupId).delete()
    } catch (cleanupError) {
      console.warn(`Failed to cleanup processing document after error:`, cleanupError)
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    throw new Error(`Analytics processing failed: ${errorMessage}`)
  }
})

// Helper functions
async function updateProgress(groupId: string, step: string, percentage: number) {
  await db.collection('processing').doc(groupId).set({
    step,
    percentage,
    isComplete: percentage >= 100,
    updatedAt: FieldValue.serverTimestamp()
  })
}

async function fetchGroupLogPosts(groupId: string) {
  const groupRef = db.collection('log_groups').doc(groupId)
  const snapshot = await db.collection('log_posts')
    .where('group', '==', groupRef)
    .get()

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}

function calculateRawAnalytics(logPosts: any[]) {
  // Currency totals across all posts
  const totalSpentByCurrency = new Map<string, number>()

  // Member spending tracking
  const memberSpending = new Map<string, Map<string, number>>() // userId -> currency -> amount

  // Hot posts calculation (most expensive + most commented)
  const postScores = new Map<string, number>()

  // Active hours tracking (UTC-based)
  const hourlyActivity = new Map<number, number>() // hour (0-23) -> post count

  logPosts.forEach(post => {
    const currency = post.currency
    const amount = Number(post.amount)
    const authorId = post.author.id

    // 1. Total spending by currency
    totalSpentByCurrency.set(
      currency,
      (totalSpentByCurrency.get(currency) || 0) + amount
    )

    // 2. Member spending tracking
    if (!memberSpending.has(authorId)) {
      memberSpending.set(authorId, new Map())
    }
    const userCurrencyMap = memberSpending.get(authorId)!
    userCurrencyMap.set(
      currency,
      (userCurrencyMap.get(currency) || 0) + amount
    )

    // 3. Hot posts scoring (amount + comment weight)
    // We'll need comment count - for now use a placeholder
    const commentCount = 0 // TODO: We'll fetch this from subcollection
    const expenseScore = amount / 100 // Normalize expense impact
    const commentScore = commentCount * 2 // Comments worth 2 points each
    postScores.set(post.id, expenseScore + commentScore)

    // 4. Active hours (UTC-based)
    const postDate = new Date(post.postDate.seconds * 1000)
    const hour = postDate.getUTCHours()
    hourlyActivity.set(hour, (hourlyActivity.get(hour) || 0) + 1)
  })

  // Calculate member percentiles for each currency
  const currencyPercentiles = new Map<string, any>()

  for (const currency of totalSpentByCurrency.keys()) {
    const amounts = Array.from(memberSpending.values())
      .map(userMap => userMap.get(currency) || 0)
      .filter(amount => amount > 0)
      .sort((a, b) => a - b)

    if (amounts.length > 0) {
      currencyPercentiles.set(currency, {
        p25: calculatePercentile(amounts, 25),
        p50: calculatePercentile(amounts, 50),
        p75: calculatePercentile(amounts, 75)
      })
    }
  }

  // Convert Maps to objects for Firestore storage
  return {
    totalSpent: Object.fromEntries(totalSpentByCurrency),
    memberRankings: Array.from(memberSpending.entries()).map(([userId, currencyMap]) => ({
      userId,
      totals: Object.fromEntries(currencyMap)
    })),
    hotPosts: Array.from(postScores.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([postId, score]) => ({ postId, score })),
    currencyPercentiles: Object.fromEntries(
      Array.from(currencyPercentiles.entries()).map(([currency, percentiles]) => [
        currency,
        percentiles
      ])
    ),
    activeHours: Object.fromEntries(hourlyActivity)
  }
}

// Helper function for percentile calculation
function calculatePercentile(sortedArray: number[], percentile: number): number {
  const index = (percentile / 100) * (sortedArray.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const weight = index % 1

  if (upper >= sortedArray.length) return sortedArray[sortedArray.length - 1]

  return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight
}

async function backfillPostMetadata(logPosts: any[]) {
  const backfilledPosts: { [postId: string]: any } = {}

  // Get unique author IDs
  const uniqueAuthorIds = [...new Set(logPosts.map(post => post.author.id))]

  // Batch fetch all user documents - fix the async handling
  const userDataMap = new Map<string, any>()

  // Use Promise.all to handle async operations properly
  const userFetchPromises = uniqueAuthorIds.map(async (authorId) => {
    try {
      const userDoc = await db.collection('users').doc(authorId).get()
      if (userDoc.exists) {
        userDataMap.set(authorId, userDoc.data())
      }
    } catch (error) {
      console.warn(`Failed to fetch user data for ${authorId}:`, error)
    }
  })

  // Wait for all user data to be fetched
  await Promise.all(userFetchPromises)

  // Process each post (this part stays the same)
  logPosts.forEach(post => {
    const authorId = post.author.id
    const userData = userDataMap.get(authorId)

    backfilledPosts[post.id] = {
      authorDisplayName: userData?.displayName || post.authorName || 'Unknown User',
      authorTimezone: userData?.timezone || 'UTC',
    }
  })

  return backfilledPosts
}