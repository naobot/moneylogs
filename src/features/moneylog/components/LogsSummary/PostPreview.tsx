import Markdown from "@/components/Markdown";
import { LogPost } from "@/types/user";
import MemberAvatarLink from "@/features/profile/MemberAvatarLink";
import { markdownColorMode, useTheme } from "@/utils/theme";
import { postAmounts } from "@/utils/postAmounts";
import { formatTotals } from "@/utils/ledgerEntries";

interface PostPreviewProps {
  post: LogPost;
  showAuthor?: boolean;
}

// Small read-only card for a single post — used in the expensive-day preview and
// when a chart bar is clicked.
const PostPreview = ({ post, showAuthor = false }: PostPreviewProps) => {
  const theme = useTheme();
  return (
    <div className="PostPreview" data-color-mode={markdownColorMode(theme)}>
      <div className="PostPreview__header">
        <strong>{formatTotals(postAmounts(post))}</strong>
      </div>
      <Markdown source={post.content} />
      {showAuthor && post.authorName && (
        <div className="PostPreview__footer">
          <MemberAvatarLink userDocId={post.author?.id} name={post.authorName} withName />
        </div>
      )}
    </div>
  );
};

export default PostPreview;
