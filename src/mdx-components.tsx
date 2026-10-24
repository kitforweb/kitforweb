import type { MDXComponents } from "mdx/types";

const components: MDXComponents = {
  // Content headings start at h2: the page h1 is the tool title.
  h1: (props) => <h2 {...props} />,
  a: ({ href = "", ...props }) =>
    href.startsWith("http") ? (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props} />
    ) : (
      <a href={href} {...props} />
    ),
};

export function useMDXComponents(): MDXComponents {
  return components;
}
