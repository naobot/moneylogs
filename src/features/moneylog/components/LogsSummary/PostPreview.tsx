import MDEditor from "@uiw/react-md-editor";
import { LogPost } from "@/types/user";
import Icon from "@/components/Icon";
import { markdownColorMode, useTheme } from "@/utils/theme";

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
        <strong>
          {post.amount.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          })}{" "}
          {post.currency}
        </strong>
      </div>
      <MDEditor.Markdown source={post.content} />
      {showAuthor && post.authorName && (
        <div className="PostPreview__footer">
          <Icon type={"user"} />
          {post.authorName}
        </div>
      )}
    </div>
  );
};

export default PostPreview;
