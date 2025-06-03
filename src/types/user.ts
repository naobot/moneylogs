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
}

export type Group = {
  id: string
  title: string
  max_participants: number
  members: Array<string>
  start: Datetime
  end: Datetime
  createdAt: Datetime
  logs: Array<Log>
}

export type Log = {
  id: string
  ownerId: string // user by userId
  createdAt: Datetime
  posts: Array<LogPost>
}

export type LogPost = {
  id: string
  createdAt: Datetime
  postDate: Datetime // editable date
  content: string // formatted rich text
  amount: number // amount spent in the day
  currency: Currency
  commentCount?: number
  authorId: string
  authorName?: string
  groupId: string
  groupName?: string
}

export type Comment = {
  id: string
  authorId: string // user by userId
  authorName: string
  content: string
  createdAt: Datetime
}