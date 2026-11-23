import { renderToStaticMarkup } from "react-dom/server";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { describe, expect, it } from "vite-plus/test";
import Markdown, { withSanitizer } from "../Markdown";

const html = (source: string) => renderToStaticMarkup(<Markdown source={source} />);

describe("Markdown", () => {
  it.each([
    ["iframe srcdoc", `<iframe srcdoc="<script>alert(1)</script>"></iframe>`, /iframe|srcdoc/i],
    ["script tag", `<script>alert(1)</script>`, /<script/i],
    ["markdown javascript: link", `[x](javascript:alert(1))`, /javascript:/i],
    ["html javascript: link", `<a href="javascript:alert(1)">x</a>`, /javascript:/i],
    ["meta refresh", `<meta http-equiv="refresh" content="0;url=https://evil.example">`, /<meta/i],
    ["style tag", `<style>body{display:none}</style>`, /<style/i],
    ["form", `<form action="https://evil.example"><input type=password></form>`, /<form|password/i],
    ["object", `<object data="data:text/html,x"></object>`, /<object/i],
    ["event handler", `<img src="https://x.example/a.png" onerror="alert(1)">`, /onerror/i],
    ["inline style", `<p style="position:fixed;inset:0">x</p>`, /position:fixed/i],
    [
      "rehype-attr comment",
      `[x](https://a.example)<!--rehype:href=javascript:alert(1)-->`,
      /javascript:/i,
    ],
  ])("removes %s", (_label, source, forbidden) => {
    expect(html(source)).not.toMatch(forbidden);
  });

  it("keeps the markdown posts use", () => {
    const out = html(
      [
        "# lunch",
        "**bold** _em_ ~~gone~~ [link](https://example.com)",
        "![receipt](https://firebasestorage.googleapis.com/v0/b/x/o/a.png)",
        "- [x] paid back",
        "| a | b |\n| - | - |\n| 1 | 2 |",
        "```js\nconst a = 1;\n```",
        "line<br>break and <u>underline</u>",
      ].join("\n\n"),
    );
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('src="https://firebasestorage.googleapis.com/v0/b/x/o/a.png"');
    expect(out).toMatch(/<input[^>]*type="checkbox"/);
    expect(out).toContain("<table>");
    expect(out).toContain("<br/>");
    // Tags outside GitHub's allowlist (like <u>) lose the tag but keep their text.
    expect(out).toContain("break and underline");
    // The preview's own additions run after the sanitizer, so they survive.
    expect(out).toMatch(/class="[^"]*language-js/);
    expect(out).toMatch(/class="[^"]*copied/);
    expect(out).toMatch(/<h1 id="lunch"/);
  });
});

describe("withSanitizer", () => {
  const a = () => undefined;
  const b = () => undefined;

  it("sanitizes straight after rehype-raw", () => {
    expect(withSanitizer([a, rehypeRaw, b])).toEqual([a, rehypeRaw, rehypeSanitize, b]);
  });

  it("falls back to sanitizing last", () => {
    expect(withSanitizer([a, b])).toEqual([a, b, rehypeSanitize]);
  });
});
