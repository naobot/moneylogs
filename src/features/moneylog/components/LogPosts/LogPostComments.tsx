import cx from "classnames"
import { useState } from "react"
import MDEditor from "@uiw/react-md-editor"

import { useCurrentUser } from "@/utils/auth"
import { useLogPostQuery } from "@/hooks/useLogPostQuery"
import { useGetComments } from "@/hooks/useGetLogPostComments"

import Button from "@/components/Button"

type LogPostCommentsProps = {
  currentLogAuthorId: string
  postId: string
}

const LogPostComments = ({ currentLogAuthorId, postId }: LogPostCommentsProps) => {
  const { data: comments, isLoading: isLoadingComments, isSuccess: isSuccessComments } = useGetComments({ logPostId: postId })
  const [newCommentContent, newCommentContentSet] = useState<string|null>()
  const { user } = useCurrentUser()

  const { addComment } = useLogPostQuery()

  const handleAddComment = async () => {
    if (!newCommentContent?.trim()) return

    try {
      await addComment.mutate({
        logPostId: postId,
        userId: user?.userId,
        content: newCommentContent,
      })
      newCommentContentSet('')
    } catch (err) {
      console.error('Failed to add comment:', err)
    }
  }

  return (<>
    <div className="LogPostComments__wrapper">
      {isLoadingComments && <>...</>}
      {/*{!isLoadingComments && isSuccessComments && comments?.length === 0 && (
        <div className="LogPostComments__notice">No comments</div>
      )}*/}
      {!isLoadingComments && isSuccessComments && comments?.map(comment => {
        return (
          <div
            key={comment.id}
            className={cx("LogPostComments__item", {
              "LogPostComments__item--highlight" : comment?.authorId?.id === currentLogAuthorId,
            })}
          >
            <div className="LogPostComments__item__container">
              <div className="LogPostComments__item__body" data-color-mode="light">
                <MDEditor.Markdown source={comment.content} />
              </div>
              <div className="LogPostComments__item__footer">
                <div className="LogPostComments__item__footer__right">
                  - {comment.authorName}
                </div>
              </div>
            </div>
          </div>
        )
      })}
      <div className="LogPostComments__item">
        <div className="LogPostComments__item__container">
          <div className="LogPostComments__item__body container" data-color-mode="light">
            {!addComment?.isLoading && (
              <MDEditor
                value={newCommentContent ?? ''}
                onChange={newCommentContentSet}
                preview='edit'
                hideToolbar
                height={110}
              />
            )}
            {addComment?.isLoading && <>...</>}
          </div>
        </div>
        <div className="LogPostComments__item__footer">
          <Button
            size="xs"
            buttonStyle="primary-border-lite"
            text="Comment"
            onClick={handleAddComment}
            disabled={!newCommentContent || addComment?.isLoading}
          />
        </div>
      </div>
    </div>
  </>)
}

export default LogPostComments