import { DocumentReference, Timestamp } from "firebase/firestore";

export type Datetime = {
  seconds: number;
  nanoseconds: number;
};

export type Currency =
  | "USD"
  | "JPY"
  | "CAD"
  | "MYR"
  | "KRW"
  | "CNY"
  | "SGD"
  | "GBP"
  | "AUD"
  | "NTD"
  | "EUR";

export type AuthUser = {
  userId: string;
  nickname?: string | null;
  email: string | null;
  isAuth: boolean;
};

export type User = {
  userId: string; // this is the auth id NOT the doc id
  groups: Array<string>;
  email: string;
  displayName: string;
  currentLog: string;
  hasUnreadComments?: {
    [groupId: string]: boolean;
  };
  commentSubscriptions?: {
    [logPostId: string]: {
      [lastViewedAt: string]: Timestamp;
    };
  };
};

export type Group = {
  [x: string]: unknown;
  id: string;
  title: string;
  max_participants: number;
  members: Array<DocumentReference>;
  start: Timestamp;
  end: Timestamp;
  startWallClock?: string; // "YYYY-MM-DDTHH:mm" — timezone-agnostic wall-clock time
  endWallClock?: string; // "YYYY-MM-DDTHH:mm" — timezone-agnostic wall-clock time
  createdAt: Timestamp;
  /** Auth uid of the creator (only they can delete). Missing on groups created before this. */
  createdBy?: string;
  logs: Array<Log>;
  analytics?: GroupAnalytics;
};

export type GroupAnalytics = {
  isCalculated: boolean;
  posts: {
    [postId: string]: {
      authorDisplayName: string;
      postTimezone: string;
    };
  };
  processedAt: Timestamp;
  raw: {
    activeHours: {
      [hour: number]: number; // 0-23 hours -> post count
    };
    currencyPercentiles: {
      [currency: string]: {
        p25: number;
        p50: number;
        p75: number;
      };
    };
    hotPosts: Array<{
      postId: string;
      score: number;
    }>;
    memberRankings: Array<{
      userId: string;
      totals: {
        [currency: string]: number; // Currency -> total amount spent
      };
    }>;
    totalSpent: {
      [currency: string]: number; // Currency -> total amount across all members
    };
  };
};

export type Log = {
  id: string;
  ownerId: string; // user by userId
  createdAt: Timestamp;
  posts: Array<LogPost>;
};

export type LogPost = {
  timezone?: string;
  /** The city picked for a travelling post's zone ("Kyoto"); else the zone's own city shows. */
  timezonePlace?: string;
  id: string;
  createdAt: Timestamp;
  postDate: Timestamp; // editable date
  content: string; // formatted rich text
  /** The primary currency's amount; read every post's spending through postAmounts(). */
  amount: number;
  currency: Currency;
  /** Spending per currency for multi-currency posts; absent on older posts. */
  amounts?: Partial<Record<Currency, number>>;
  /**
   * Pull keys (hashed ledger + entry ids, see `pullKey`) of the financial-log entries
   * the author pulled into this post, only to mark them as already pulled. Never raw
   * ledger ids: posts are public.
   */
  pulledEntryIds?: string[];
  /**
   * The primary currency of `amounts` (what amount/currency held when last written by a
   * multi-currency client). Firestore sorts map keys, so the map can't say on its own.
   */
  amountsPrimary?: Currency;
  commentCount?: number;
  author: DocumentReference;
  authorName?: string;
  groupId: string;
  groupName?: string;
  commentSubscribers?: Array<DocumentReference>;
  latestCommentAt?: Timestamp;
  images?: string[];
  imagesProcessing?: boolean;
  pendingImageCount?: number;
  /** Emoji reactions: users-collection doc id → the distinct emoji that user added. */
  reactions?: Record<string, string[]>;
};

export type Comment = {
  id: string;
  authorId: DocumentReference;
  authorName: string;
  content: string;
  createdAt: Timestamp;
};
