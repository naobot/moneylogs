import { useEffect, useMemo } from "react"
import { useCurrentUser } from "../../../utils/auth"
import cx from "classnames"
import Icon from "../../../components/Icon"
import { useGetLogPosts } from "../../../hooks/useGetLogPosts"
import { UserData } from "../../../hooks/useGetUserInfo"

interface LogsMenuProps {
  displayUser: UserData
  logMembers: any[]
  setter: (member: any) => void
  groupId: string
}

const LogsMenu = ({ displayUser, logMembers, setter, groupId }: LogsMenuProps) => {
  const { user } = useCurrentUser()

  const serializedMembers = useMemo(() => {
    if (!logMembers) return []
    return logMembers.map(member => {
      // Skip checking own posts
      if (member.id === user?.id) {
        return { ...member, hasUnread: false }
      }
      const memberLastUpdated = member.lastUpdated?.[groupId]
      const userLastViewed = user?.viewTracking?.[groupId]?.[member.id]?.lastViewedAt
      // If member has never posted or user has never viewed, no unread
      if (!memberLastUpdated) {
        return { ...member, hasUnread: false }
      }
      // If user has never viewed this member's posts, they have unread
      if (!userLastViewed) {
        return { ...member, hasUnread: true }
      }
      // Compare timestamps (Firebase timestamps have seconds property)
      const hasUnread = memberLastUpdated.seconds > userLastViewed.seconds
      return { ...member, hasUnread }
    })
  }, [user?.viewTracking, logMembers, groupId, user?.id])

  return (
    <>
      <div className="LogsMenu">
        {serializedMembers?.map((member) => {
          return (
            <LogsMenuItemWithComments
              key={member.id}
              member={member}
              displayUser={displayUser}
              user={user}
              groupId={groupId}
              setter={setter}
            />
          )
        })}
      </div>
    </>
  )
}

// Separate component to handle individual member's comment checking
const LogsMenuItemWithComments = ({ member, displayUser, user, groupId, setter }) => {
  const logPostRes = useGetLogPosts({ groupId, userId: member.userId })

  const hasUnreadComments = useMemo(() => {
    // Skip checking own posts for comments
    if (member.id === user?.id) return false

    const memberPosts = logPostRes?.data || []
    return memberPosts.some(post => {
      const userLastViewed = user?.commentSubscriptions?.[post.id]?.lastViewedAt
      return post.latestCommentAt && (!userLastViewed || post.latestCommentAt.seconds > userLastViewed.seconds)
    })
  }, [logPostRes?.data, user, member.id])

  return (
    <div
      className={cx("LogsMenu__item", {
        'LogsMenu__item--active': displayUser?.id === member?.id,
        'LogsMenu__item--first': member?.id === user?.id,
        'LogsMenu__item--new': member.hasUnreadPosts,
      })}
      onClick={() => setter(member)}
    >
      {member.hasUnreadPosts && <Icon type="notification" />}
      {displayUser?.id !== member?.id && hasUnreadComments && <Icon type={"speech"} size={18} />}
      <div>
        {member?.displayName}
      </div>
    </div>
  )
}

export default LogsMenu