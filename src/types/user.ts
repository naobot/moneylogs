import { DocumentReference, Timestamp } from "firebase/firestore"

export type Datetime = {
  seconds: number
  nanoseconds: number
}

export type Currency =
  'USD' |
  'JPY' |
  'CAD' |
  'MYR' |
  'KRW' |
  'CNY' |
  'GBP' |
  'AUD' |
  'NTD' |
  'EUR' |
  'NTD'

export type AuthUser = {
  userId: string
  nickname?: string | null
  email: string | null
  isAuth: boolean
}

export type User = {
  userId: string // this is the auth id NOT the doc id
  groups: Array<string>
  email: string
  displayName: string
  currentLog: string
  hasUnreadComments?: {
    [groupId: string]: boolean
  }
  commentSubscriptions?: {
    [logPostId: string]: {
      [lastViewedAt: string]: Timestamp
    }
  }
}

export type Group = {
  [x: string]: any
  id: string
  title: string
  max_participants: number
  members: Array<string>
  start: Timestamp
  end: Timestamp
  createdAt: Timestamp
  logs: Array<Log>
  analytics?: GroupAnalytics
}

export type GroupAnalytics = {
  isCalculated: boolean
  posts: {
    [postId: string]: {
      authorDisplayName: string
      authorTimezone: string
    }
  }
  processedAt: Timestamp
  raw: {
    activeHours: {
      [hour: number]: number  // 0-23 hours -> post count
    }
    currencyPercentiles: {
      [currency: string]: {
        p25: number
        p50: number
        p75: number
      }
    }
    hotPosts: Array<{
      postId: string
      score: number
    }>
    memberRankings: Array<{
      userId: string
      totals: {
        [currency: string]: number  // Currency -> total amount spent
      }
    }>
    totalSpent: {
      [currency: string]: number  // Currency -> total amount across all members
    }
  }
}

export type Log = {
  id: string
  ownerId: string // user by userId
  createdAt: Timestamp
  posts: Array<LogPost>
}

export type LogPost = {
  timezone?: string
  id: string
  createdAt: Timestamp
  postDate: Timestamp // editable date
  content: string // formatted rich text
  amount: number // amount spent in the day
  currency: Currency
  commentCount?: number
  author: DocumentReference
  authorName?: string
  groupId: string
  groupName?: string
  commentSubscribers?: Array<DocumentReference>
  latestCommentAt?: Timestamp
}

export type Comment = {
  id: string
  authorId: DocumentReference
  authorName: string
  content: string
  createdAt: Timestamp
}