import { Dispatch, useMemo, useRef, useEffect } from "react";
import { LogPost } from "@/types/user";
import { FullUserData } from "@/hooks/useGetGroupUsers";
import { UserData } from "@/hooks/useGetUserInfo";
import { LogPostItem } from "@/features/moneylog/components/LogPosts/LogPosts";

interface HotPostsProps {
  logPosts: Array<LogPost>;
  groupMembers: FullUserData[];
  groupId: string;
  onOpenComments: (post: LogPost, hasUnreadComments: boolean) => void;
  setSelectedPost: Dispatch<React.SetStateAction<LogPost | null>>;
  selectedPostId: string | null;
}

const HotPosts = ({
  logPosts,
  groupMembers,
  groupId,
  onOpenComments,
  selectedPostId,
  setSelectedPost,
}: HotPostsProps) => {
  const hotPostsRef = useRef<HTMLDivElement>(null);

  const hotPosts = useMemo(() => {
    // Find the maximum number of comments
    const maxComments = Math.max(...logPosts.map((post) => post.commentCount || 0));
    // If no posts have comments, return empty array
    if (maxComments === 0) {
      return [];
    }
    // Get posts within 5 comments of the maximum
    const threshold = Math.max(0, maxComments - 5);
    return logPosts
      .filter((post) => (post.commentCount || 0) >= threshold)
      .sort((a, b) => (b.commentCount || 0) - (a.commentCount || 0));
  }, [logPosts]);

  const getUserForPost = (post: LogPost) => {
    return groupMembers.find((member) => member.id === post.author.id);
  };

  // Auto-scroll effect when component comes into view
  useEffect(() => {
    const hotPostsElement = hotPostsRef.current;
    if (!hotPostsElement) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Find the LogsSummary container
            const logsSummaryContainer = hotPostsElement.closest(".LogsSummary");

            if (logsSummaryContainer) {
              // Calculate the position of the HotPosts component relative to LogsSummary
              const containerRect = logsSummaryContainer.getBoundingClientRect();
              const hotPostsRect = hotPostsElement.getBoundingClientRect();

              // Calculate scroll position to bring HotPosts to the top of LogsSummary
              const scrollTop =
                logsSummaryContainer.scrollTop + (hotPostsRect.top - containerRect.top);

              logsSummaryContainer.scrollTo({
                top: scrollTop,
                behavior: "smooth",
              });
            }
          }
        });
      },
      {
        threshold: 0.1, // Trigger when 10% of the component is visible
        rootMargin: "0px 0px -50% 0px", // Only trigger when component is in upper half of viewport
      },
    );

    observer.observe(hotPostsElement);

    return () => {
      observer.disconnect();
    };
  }, [hotPosts.length]); // Re-run when hot posts change

  if (hotPosts.length === 0) return;

  return (
    <div className="HotPostsWindow Window" ref={hotPostsRef}>
      <h3>🔥 hot posts</h3>
      <p className="HotPosts__description">
        These posts got a lot of attention! ({hotPosts.length} post
        {hotPosts.length !== 1 ? "s" : ""} shown)
      </p>
      <div className="HotPosts LogPosts__posts">
        {hotPosts.map((post) => {
          const postAuthor = getUserForPost(post);
          return (
            <LogPostItem
              key={post.id}
              user={postAuthor as unknown as UserData}
              groupId={groupId}
              post={post}
              selectedPostId={selectedPostId}
              setSelectedPost={setSelectedPost}
              setCurrentlyEditingPostId={() => {}} // No-op since we're in read-only mode
              isMyLog={false}
              isDigestMode={true} // Show in digest mode for better layout
              onOpenComments={onOpenComments}
              isReadOnly={true}
              isSummaryView={true}
            />
          );
        })}
      </div>
    </div>
  );
};

export default HotPosts;
