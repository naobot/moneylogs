import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

vi.mock("@/contexts", () => ({
  useCurrentUser: () => ({ user: { id: "u1", userId: "auth1" } }),
}));
vi.mock("@/hooks/useLogPostQuery", () => ({
  useLogPostQuery: () => ({ addComment: { mutate: vi.fn(), isLoading: false } }),
}));
vi.mock("@/hooks/useReadTracking", () => ({
  useReadTracking: () => ({ trackUserAction: vi.fn() }),
}));
vi.mock("@uiw/react-md-editor", () => ({
  default: Object.assign(() => null, { Markdown: () => null }),
}));

import LogPostComments from "@/features/moneylog/components/LogPosts/LogPostComments";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const baseProps = {
  currentLogAuthorId: "author1",
  postId: "post1",
  comments: [],
  isLoadingComments: false,
  isSuccessComments: true,
  refreshComments: vi.fn(),
};

describe("LogPostComments — commenting affordance", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const buttonLabels = () =>
    Array.from(container.querySelectorAll("button")).map((b) => b.textContent);

  it("shows an explanatory notice for a spectator on an ongoing log", () => {
    act(() =>
      root.render(<LogPostComments {...baseProps} isReadOnly={false} isSpectator={true} />),
    );
    expect(container.querySelector(".LogPostComments__item--notice")).not.toBeNull();
    expect(container.textContent).toContain("Only logged in participants can comment");
    expect(buttonLabels()).not.toContain("Comment");
  });

  it("shows the add-comment box for a participant on an ongoing log", () => {
    act(() =>
      root.render(<LogPostComments {...baseProps} isReadOnly={false} isSpectator={false} />),
    );
    expect(container.querySelector(".LogPostComments__item--notice")).toBeNull();
    expect(buttonLabels()).toContain("Comment");
  });

  it("shows neither the box nor the notice on a completed (read-only) log", () => {
    act(() => root.render(<LogPostComments {...baseProps} isReadOnly={true} isSpectator={true} />));
    expect(container.querySelector(".LogPostComments__item--notice")).toBeNull();
    expect(buttonLabels()).not.toContain("Comment");
  });
});
