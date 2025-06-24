import cx from "classnames"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import MDEditor from "@uiw/react-md-editor"

import { useCurrentUser } from "@/contexts"
import { Comment } from "@/types/user"

import { useLogPostQuery } from "@/hooks/useLogPostQuery"
import { useReadTracking } from "@/hooks/useReadTracking"

import Button from "@/components/Button"


type LogPostCommentsProps = {
  currentLogAuthorId: string
  postId: string
  comments: Comment[]
  isLoadingComments?: boolean
  isSuccessComments?: boolean
  refreshComments: (string) => Promise<void>
}

const LogPostComments = ({ currentLogAuthorId, postId, comments, isLoadingComments, isSuccessComments, refreshComments }: LogPostCommentsProps) => {
  // const { data: comments, isLoading: isLoadingComments, isSuccess: isSuccessComments, refreshComments } = useGetComments({ logPostId: postId })
  const [newCommentContent, newCommentContentSet] = useState<string|null>()
  const { user } = useCurrentUser()
  const { trackUserAction } = useReadTracking()

  const commentRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const { addComment } = useLogPostQuery()

  const handleAddComment = async () => {
    if (!newCommentContent?.trim()) return

    try {
      await addComment.mutate({
        logPostId: postId,
        userId: user?.userId,
        content: newCommentContent,
      })

      refreshComments(postId)

      trackUserAction('new_comment', {
        user_id: user?.id,
        post_id: postId,
      })

      newCommentContentSet('')
    } catch (err) {
      console.error('Failed to add comment:', err)
    }
  }

  useEffect(() => {
    commentRefs.current = new Map();
  }, [postId])

  useLayoutEffect(() => {
    const delay = setTimeout(() => {
      commentRefs.current?.get('newComment')?.scrollIntoView({ behavior: 'smooth' })
    }, 1000)
    return () => clearTimeout(delay)
  }, [postId, comments])

  useLayoutEffect(() => {
    if (commentRefs) {
      const delay = setTimeout(() => {
        commentRefs.current.forEach((ref) => {
          if (ref) {
            const commentBoxHeight = ref.offsetHeight
            const itemBodyContainer = ref.firstChild as HTMLElement
            const heightDiff = itemBodyContainer?.offsetHeight - commentBoxHeight

            if (heightDiff > 0) {
              if (heightDiff > 40) {
                ref?.classList?.add('LogPostComments__item--grow-xl')
              } else {
                ref?.classList?.add('LogPostComments__item--grow')
              }
            }

            ref?.classList?.remove('LogPostComments__item--hidden')
          }
        })
      }, 500)
      return () => clearTimeout(delay)
    }
  }, [postId, comments])

  return (<>
    <div className="LogPostComments__wrapper">
      {isLoadingComments && <>...</>}
      {!isLoadingComments && isSuccessComments && comments?.map((comment, i) => {
        return (
          <div
            ref={(el) => {
              if (el) {
                commentRefs.current.set(comment.id, el);
              } else {
                commentRefs.current.delete(comment.id);
              }
            }}
            key={comment.id}
            className={cx("LogPostComments__item LogPostComments__item--hidden", {
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
      <div
        className="LogPostComments__item LogPostComments__item--hidden"
        ref={(elm) => {
          if (elm) {
            commentRefs.current.set('newComment', elm)
          }
        }}
      >
        <div className="LogPostComments__item__container">
          <div className="LogPostComments__item__body container" data-color-mode="light">
            {!addComment?.isLoading && (
              <MDEditor
                value={newCommentContent ?? ''}
                onChange={newCommentContentSet}
                preview='edit'
                hideToolbar
                height={110}
                textareaProps={{
                  maxLength: 400,
                }}
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