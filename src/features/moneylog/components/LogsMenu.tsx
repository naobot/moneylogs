import { useEffect, useMemo } from "react"
import { useCurrentUser } from "../../../utils/auth"
import cx from "classnames"
import Icon from "../../../components/Icon"

interface LogsMenuProps {
  displayUser: any
  logMembers: any[]
  setter: (member: any) => void
  groupId: string
}

const LogsMenu = ({ displayUser, logMembers, setter, groupId }: LogsMenuProps) => {
  const { user } = useCurrentUser()

  const membersWithUnreadStatus = useMemo(() => {
    if (!logMembers) return []

    return logMembers.map(member => {
      // Skip checking own posts
      if (member.id === user?.id) {
        return { ...member, hasUnread: false }
      }

      // console.log('current user viewTracking:', user?.viewTracking)
      // console.log('groupId we are looking for:', groupId)
      // console.log('member.id we are checking:', member.id)

      const memberLastUpdated = member.lastUpdated?.[groupId]
      const userLastViewed = user?.viewTracking?.[groupId]?.[member.id]?.lastViewedAt

      // console.log('memberLastUpdated', memberLastUpdated)
      // console.log('userLastViewed', userLastViewed)

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
        {membersWithUnreadStatus?.map((member) => {
          return (
            <div
              className={cx("LogsMenu__item", {
                'LogsMenu__item--active': displayUser?.id === member?.id,
                'LogsMenu__item--first': member?.id === user?.id,
                'LogsMenu__item--new': member.hasUnread
              })}
              key={member.id}
              onClick={() => setter(member)}
            >
              {member.hasUnread && <Icon type="notification" />}
              <div>
                {member?.displayName}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

export default LogsMenu