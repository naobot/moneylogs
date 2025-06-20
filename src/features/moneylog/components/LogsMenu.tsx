import { useMemo } from "react"

import { LogPost } from "@/types/user"
import { useCurrentUser } from "@/contexts"
import { UserData } from "@/hooks/useGetUserInfo"

import Icon from "@/components/Icon"

import cx from "classnames"

interface LogsMenuProps {
  displayAll: boolean
  displayUser: UserData
  logMembers: any[]
  logPosts: Array<LogPost>
  onChangeUser: Function
  groupId: string
}

const LogsMenu = ({ displayAll = false, displayUser, logMembers, logPosts, onChangeUser, groupId }: LogsMenuProps) => {
  const { user } = useCurrentUser()

  const serializedMembers = useMemo(() => {
    if (!logMembers) return []

    return logMembers.map(member => {
      // Skip checking own posts
      if (!logMembers || !user?.id || user?.viewTracking === undefined) {
        return { ...member, hasUnreadPosts: false }
      }
      const memberLastUpdated = member.lastUpdated?.[groupId]
      const userLastViewed = user?.viewTracking?.[groupId]?.[member.id]?.lastViewedAt

      // if (member.id === 'HM0YyRDKeDRmuBxB8V2N') {
      //   console.log("checking log member maddie!")
      //   console.log("maddie's memberLastUpdated:", memberLastUpdated)
      //   console.log("i last viewed maddie:", userLastViewed)
      // }

      // If member has never posted or user has never viewed, no unread
      if (!memberLastUpdated) {
        return { ...member, hasUnreadPosts: false }
      }
      // If user has never viewed this member's posts, they have unread
      if (!userLastViewed) {
        return { ...member, hasUnreadPosts: true }
      }
      // Compare timestamps (Firebase timestamps have seconds property)
      const hasUnreadPosts = memberLastUpdated.seconds > userLastViewed.seconds

      // if (member.id === 'HM0YyRDKeDRmuBxB8V2N') {
      //   console.log("i have unread maddie posts?", hasUnreadPosts)
      // }

      return { ...member, hasUnreadPosts }
    })
  }, [user?.viewTracking, logMembers, groupId, user?.id])

  return (
    <>
      <div className="LogsMenu">
        <div
          className={cx("LogsMenu__item LogsMenu__item--zeroeth", {
            "LogsMenu__item--active": displayAll,
          })}
          onClick={() => onChangeUser()}
        >
          <div className="LogsMenu__item__content">
            <div className="LogsMenu__item__title">
              Daily Digest
            </div>
          </div>
        </div>
        {serializedMembers?.map((member) => {
          return (
            <LogsMenuItemWithComments
              displayAll={displayAll}
              key={member.id}
              logPosts={logPosts.filter((post) => post.author.id == member.id)}
              member={member}
              displayUser={displayUser}
              user={user}
              groupId={groupId}
              onChangeUser={onChangeUser}
            />
          )
        })}
      </div>
    </>
  )
}

// Separate component to handle individual member's comment checking
const LogsMenuItemWithComments = ({ displayAll, member, logPosts, displayUser, user, groupId, onChangeUser }) => {
  const hasUnreadComments = useMemo(() => {
    // Skip checking own posts for comments
    if (member.id === user?.id) return false

    // if (member.id === 'HM0YyRDKeDRmuBxB8V2N') {
    //   console.log("checking log member maddie!")
    // }

    const memberPosts = logPosts || []
    return memberPosts.some(post => {
      // if (post.id === 'zKBFd9Lv8bl4rcdKxKuh') {
      //   console.log("looking at maddie's popular post")
      //   console.log("post.commentSubscribers:", post.commentSubscribers?.map(x => x?.id))
      // }

      if (!post.commentSubscribers || !user?.id) return false

      // First check: Is the current user subscribed to this post's comments?
      const isSubscribed = post.commentSubscribers.some(subscriber =>
        subscriber.id === user.id
      )

      // if (post.id === 'zKBFd9Lv8bl4rcdKxKuh') {
      //   console.log("it's me:", user.id)
      //   console.log("am I subscribed to maddie's popular post?", isSubscribed)
      // }

      // If not subscribed, no unread indicator
      if (!isSubscribed) return false

      // If subscribed, check if there are unread comments
      const userLastViewed = user?.commentSubscriptions?.[post.id]?.lastViewedAt
      return post.latestCommentAt && (!userLastViewed || post.latestCommentAt.seconds > userLastViewed.seconds)
    })
  }, [logPosts, user, member.id])

  return (
    <div
      className={cx("LogsMenu__item", {
        'LogsMenu__item--active': !displayAll && displayUser?.id === member?.id,
        'LogsMenu__item--first': member?.id === user?.id,
        // 'LogsMenu__item--new': member.hasUnreadPosts && displayUser?.id !== member?.id,
      })}
      onClick={() => onChangeUser(member)}
    >
      {member?.id !== user?.id && displayUser?.id !== member?.id && member.hasUnreadPosts && <Icon type="notification" />}
      {displayUser?.id !== member?.id && (!member.hasUnreadPosts || member?.id === user?.id) && hasUnreadComments && <Icon type={"speech"} size={18} />}
      <div className="LogsMenu__item__content">
        <div className="LogsMenu__item__title">
          {member?.displayName}
        </div>
        {member?.displayLocation && (
          <div className="LogsMenu__item__subtitle">
            ({member?.displayLocation})
          </div>
        )}
      </div>
    </div>
  )
}

export default LogsMenu