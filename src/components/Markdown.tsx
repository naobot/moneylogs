import MDEditor from "@uiw/react-md-editor";
import type { ComponentProps } from "react";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

type MarkdownProps = ComponentProps<typeof MDEditor.Markdown>;
type PluggableList = Parameters<NonNullable<MarkdownProps["pluginsFilter"]>>[1];

/**
 * Renders user-written markdown (posts, comments, previews). Always use this instead of
 * `MDEditor.Markdown`, which renders raw HTML unfiltered: `<iframe srcdoc>`, forms and
 * `javascript:` links in a post would otherwise run as the app.
 *
 * Raw HTML in existing posts still renders, cleaned with GitHub's allowlist right after
 * `rehype-raw` parses it (tags outside it, like `<u>`, keep only their text). The preview's own plugins
 * (heading anchors, code copy buttons, syntax highlighting) run after that, so their
 * trusted markup is kept. Cleaning before `rehype-attr` also drops the
 * `<!--rehype:...-->` comments it would otherwise turn into attributes.
 */
export const withSanitizer = (plugins: PluggableList): PluggableList => {
  const rawAt = plugins.findIndex(
    (plugin) => plugin === rehypeRaw || (Array.isArray(plugin) && plugin[0] === rehypeRaw),
  );
  // Not found (the library changed its plugin list): sanitize last, which is still safe
  // but strips the copy buttons and anchors the preview adds.
  if (rawAt === -1) return [...plugins, rehypeSanitize];
  return [...plugins.slice(0, rawAt + 1), rehypeSanitize, ...plugins.slice(rawAt + 1)];
};

const pluginsFilter = (type: "rehype" | "remark", plugins: PluggableList): PluggableList =>
  type === "rehype" ? withSanitizer(plugins) : plugins;

type Props = Omit<MarkdownProps, "pluginsFilter">;

const Markdown = (props: Props) => <MDEditor.Markdown {...props} pluginsFilter={pluginsFilter} />;

export default Markdown;
