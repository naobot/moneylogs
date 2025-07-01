import { Dispatch, useMemo } from "react"
import { LogPost } from "@/types/user"
import { FullUserData } from "@/hooks/useGetGroupUsers"

import { LogPostItem } from "../LogPosts/LogPosts"

interface HotPostsProps {
  logPosts: Array<LogPost>
  groupMembers: FullUserData[]
  groupId: string
  onOpenComments: (post: LogPost, hasUnreadComments: boolean) => void
  setSelectedPost: Dispatch<React.SetStateAction<LogPost|null>>
  selectedPostId: string | null
}

const HotPosts = ({ logPosts, groupMembers, groupId, onOpenComments, selectedPostId, setSelectedPost }: HotPostsProps) => {
  const hotPosts = useMemo(() => {
    // Find the maximum number of comments
    const maxComments = Math.max(...logPosts.map(post => post.commentCount || 0))

    // If no posts have comments, return empty array
    if (maxComments === 0) {
      return []
    }

    // Get posts within 5 comments of the maximum
    const threshold = Math.max(0, maxComments - 5)

    return logPosts
      .filter(post => (post.commentCount || 0) >= threshold)
      .sort((a, b) => (b.commentCount || 0) - (a.commentCount || 0))
  }, [logPosts])

  const getUserForPost = (post: LogPost) => {
    return groupMembers.find(member => member.id === post.author.id)
  }

  if (hotPosts.length === 0) return

  return (
    <div className="Window">
      <h3>🔥 Hot Posts</h3>
      <p className="HotPosts__description">
        These posts got a lot of attention! ({hotPosts.length} post{hotPosts.length !== 1 ? 's' : ''} shown)
      </p>
      <div className="HotPosts">
        {hotPosts.map((post) => {
          const postAuthor = getUserForPost(post)

          return (
            <div key={post.id} className="HotPosts__item">
              <LogPostItem
                user={postAuthor}
                groupId={groupId}
                post={post}
                selectedPostId={selectedPostId}
                setSelectedPost={setSelectedPost}
                setCurrentlyEditingPostId={() => {}} // No-op since we're in read-only mode
                isMyLog={false}
                isDigestMode={true} // Show in digest mode for better layout
                onOpenComments={onOpenComments}
                isReadOnly={true}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default HotPosts