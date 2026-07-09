// Pure visibility rules for the nav item badges, extracted so they can be unit
// tested (this logic has been subtly wrong before — e.g. the comment badge not
// showing on your own item in the Daily Digest).

type NavBadgeInput = {
  isSpectator: boolean;
  isOwnItem: boolean; // this nav item is the current user's own log
  isViewingThisMember: boolean; // actively viewing this member's single log (not digest/summary)
  memberHasUnreadPosts: boolean;
  hasUnreadComments: boolean;
};

// The post "bell": another member posted something you haven't seen. Never shows for
// your own item, and not while you're actively viewing that member's log.
export const shouldShowPostBell = ({
  isSpectator,
  isOwnItem,
  isViewingThisMember,
  memberHasUnreadPosts,
}: Omit<NavBadgeInput, "hasUnreadComments">): boolean =>
  !isSpectator && !isOwnItem && !isViewingThisMember && memberHasUnreadPosts;

// The comment "speech" badge: unseen comments — including on your own posts (you're
// auto-subscribed). Suppressed while actively viewing that member's log, and yields to
// the post bell for other members so a single item never shows two icons.
export const shouldShowCommentBadge = ({
  isSpectator,
  isOwnItem,
  isViewingThisMember,
  memberHasUnreadPosts,
  hasUnreadComments,
}: NavBadgeInput): boolean =>
  !isSpectator && !isViewingThisMember && (!memberHasUnreadPosts || isOwnItem) && hasUnreadComments;
