// scripts/seed-emulator.ts
import { initializeApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator, collection, addDoc, doc, setDoc, Timestamp } from 'firebase/firestore'

// Mock Firebase config for emulator
const mockConfig = {
  apiKey: "mock-api-key",
  authDomain: "mock-auth-domain",
  projectId: "moneylogs-89ebf",
  storageBucket: "mock-storage-bucket",
  messagingSenderId: "mock-sender-id",
  appId: "mock-app-id"
}

const app = initializeApp(mockConfig)
const auth = getAuth(app)
const db = getFirestore(app)

// Connect to emulators
try {
  connectAuthEmulator(auth, 'http://localhost:9099')
  connectFirestoreEmulator(db, 'localhost', 8888)
} catch (error) {
  console.log('Emulators already connected or not running')
}

// Test users representing different timezones
const testUsers = [
  { email: 'alice.vancouver@test.com', password: 'test123', displayName: 'Alice Chen', timezone: 'America/Vancouver' },
  { email: 'bob.nyc@test.com', password: 'test123', displayName: 'Bob Rodriguez', timezone: 'America/New_York' },
  { email: 'charlie.london@test.com', password: 'test123', displayName: 'Charlie Williams', timezone: 'Europe/London' },
  { email: 'diana.berlin@test.com', password: 'test123', displayName: 'Diana Mueller', timezone: 'Europe/Berlin' },
  { email: 'erik.tokyo@test.com', password: 'test123', displayName: 'Erik Tanaka', timezone: 'Asia/Tokyo' },
  { email: 'fiona.singapore@test.com', password: 'test123', displayName: 'Fiona Lim', timezone: 'Asia/Singapore' }
]

// Test groups
const testGroups = [
  {
    title: 'Roommates - Vancouver House',
    members: ['alice.vancouver@test.com', 'bob.nyc@test.com', 'charlie.london@test.com', 'diana.berlin@test.com'],
    max_participants: 10,
  },
  {
    title: 'Asia Trip 2025',
    members: ['charlie.london@test.com', 'diana.berlin@test.com', 'erik.tokyo@test.com', 'fiona.singapore@test.com'],
    max_participants: 10,
  }
]

// Sample expenses with different currencies and timezones
const sampleExpenses = [
  { content: 'Groceries for the week', amount: 85.50, currency: 'CAD', authorEmail: 'alice.vancouver@test.com', groupIndex: 0, daysAgo: 2 },
  { content: 'Utilities bill - electricity', amount: 120.00, currency: 'USD', authorEmail: 'bob.nyc@test.com', groupIndex: 0, daysAgo: 5 },
  { content: 'Internet bill', amount: 45.99, currency: 'GBP', authorEmail: 'charlie.london@test.com', groupIndex: 0, daysAgo: 7 },
  { content: 'Cleaning supplies', amount: 32.75, currency: 'EUR', authorEmail: 'diana.berlin@test.com', groupIndex: 0, daysAgo: 1 },

  { content: 'Tokyo hotel booking', amount: 15000, currency: 'JPY', authorEmail: 'erik.tokyo@test.com', groupIndex: 1, daysAgo: 10 },
  { content: 'Flight to Singapore', amount: 450.00, currency: 'SGD', authorEmail: 'fiona.singapore@test.com', groupIndex: 1, daysAgo: 15 },
  { content: 'Train tickets in Europe', amount: 89.50, currency: 'EUR', authorEmail: 'diana.berlin@test.com', groupIndex: 1, daysAgo: 8 },
  { content: 'Restaurant dinner in London', amount: 125.80, currency: 'GBP', authorEmail: 'charlie.london@test.com', groupIndex: 1, daysAgo: 3 }
]

// Comments for posts
const sampleComments = [
  { content: 'Thanks for getting these! 🛒', authorEmail: 'bob.nyc@test.com' },
  { content: 'Can we split this evenly?', authorEmail: 'charlie.london@test.com' },
  { content: 'Perfect timing on the hotel booking!', authorEmail: 'fiona.singapore@test.com' },
  { content: 'Great choice of restaurant 👍', authorEmail: 'erik.tokyo@test.com' }
]

async function createUser(userInfo: typeof testUsers[0]) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, userInfo.email, userInfo.password)
    const user = userCredential.user

    // Create user document in Firestore
    const userDoc = {
      userId: user.uid,
      email: userInfo.email,
      displayName: userInfo.displayName,
      createdAt: Timestamp.now(),
      groups: [] // Will be populated when we create groups
    }

    await setDoc(doc(db, 'users', user.uid), userDoc)
    console.log(`✅ Created user: ${userInfo.displayName}`)

    return { uid: user.uid, ...userInfo }
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      // User already exists, sign in to get UID
      const userCredential = await signInWithEmailAndPassword(auth, userInfo.email, userInfo.password)
      console.log(`🔄 User already exists: ${userInfo.displayName}`)
      return { uid: userCredential.user.uid, ...userInfo }
    }
    throw error
  }
}

async function createLogGroup(groupInfo: typeof testGroups[0], createdUsers: any[]) {
  const memberUids = createdUsers
    .filter(user => groupInfo.members.includes(user.email))
    .map(user => doc(db, 'users', user.uid))

  const groupData = {
    title: groupInfo.title,
    members: memberUids,
    max_participants: groupInfo.max_participants,
    createdAt: Timestamp.now(),
    start: Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)), // 30 days ago
    end: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) // 30 days from now
  }

  const groupDocRef = await addDoc(collection(db, 'log_groups'), groupData)
  console.log(`✅ Created group: ${groupInfo.title}`)

  // Update user documents to include this group
  for (const memberUid of memberUids) {
    const userRef = doc(db, 'users', memberUid.id)
    // Note: In a real scenario, you'd use arrayUnion to add the group ID
    // For seeding, we'll just update the groups array directly
  }

  return groupDocRef.id
}

async function createLogPost(expense: typeof sampleExpenses[0], createdUsers: any[], groupId: string) {
  const author = createdUsers.find(user => user.email === expense.authorEmail)
  if (!author) return

  const postDate = new Date(Date.now() - expense.daysAgo * 24 * 60 * 60 * 1000)

  const postData = {
    content: expense.content,
    amount: expense.amount,
    currency: expense.currency,
    author: doc(db, 'users', author.uid),
    authorName: author.displayName,
    group: doc(db, 'log_groups', groupId),
    groupName: testGroups[expense.groupIndex].title,
    postDate: Timestamp.fromDate(postDate),
    createdAt: Timestamp.fromDate(postDate),
    commentSubscribers: [doc(db, 'users', author.uid)]
  }

  const postDocRef = await addDoc(collection(db, 'log_posts'), postData)
  console.log(`✅ Created post: ${expense.content} (${expense.currency} ${expense.amount})`)

  return postDocRef.id
}

async function addComment(postId: string, comment: typeof sampleComments[0], createdUsers: any[]) {
  const author = createdUsers.find(user => user.email === comment.authorEmail)
  if (!author) return

  const commentData = {
    content: comment.content,
    authorId: doc(db, 'users', author.uid),
    authorName: author.displayName,
    createdAt: Timestamp.now()
  }

  await addDoc(collection(db, 'log_posts', postId, 'comments'), commentData)
  console.log(`💬 Added comment: "${comment.content}" by ${author.displayName}`)
}

async function seedEmulator() {
  console.log('🌱 Starting emulator seeding...')

  try {
    // Create users
    console.log('\n👥 Creating users...')
    const createdUsers = []
    for (const userInfo of testUsers) {
      const user = await createUser(userInfo)
      createdUsers.push(user)
    }

    // Create groups
    console.log('\n📁 Creating log groups...')
    const groupIds = []
    for (const groupInfo of testGroups) {
      const groupId = await createLogGroup(groupInfo, createdUsers)
      groupIds.push(groupId)
    }

    // Create posts
    console.log('\n📝 Creating log posts...')
    const postIds = []
    for (const expense of sampleExpenses) {
      const groupId = groupIds[expense.groupIndex]
      const postId = await createLogPost(expense, createdUsers, groupId)
      if (postId) postIds.push(postId)
    }

    // Add some comments
    console.log('\n💬 Adding comments...')
    if (postIds.length > 0) {
      await addComment(postIds[0], sampleComments[0], createdUsers)
      await addComment(postIds[1], sampleComments[1], createdUsers)
      if (postIds.length > 4) {
        await addComment(postIds[4], sampleComments[2], createdUsers)
        await addComment(postIds[7], sampleComments[3], createdUsers)
      }
    }

    console.log('\n🎉 Emulator seeding completed successfully!')
    console.log('\n📊 Summary:')
    console.log(`- ${createdUsers.length} users created`)
    console.log(`- ${groupIds.length} groups created`)
    console.log(`- ${postIds.length} posts created`)
    console.log('- Several comments added')
    console.log('\n🔗 Open Emulator UI: http://127.0.0.1:1331/')

  } catch (error) {
    console.error('❌ Error seeding emulator:', error)
    process.exit(1)
  }

  process.exit(0)
}

// Run the seeding
seedEmulator()