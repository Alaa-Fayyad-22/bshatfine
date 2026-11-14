import ReactMarkdown, { type Components } from "react-markdown";

// Renders editor-written Markdown (page bodies). Locked down on purpose:
//  - raw HTML is dropped entirely (`skipHtml`, and no rehype-raw plugin), and
//    there is no dangerouslySetInnerHTML: everything becomes React elements;
//  - only the elements below are allowed; anything else keeps just its text
//    (`unwrapDisallowed`), so images and tables never render;
//  - links are kept only for https:, mailto: and tel:; any other address
//    (javascript:, http:, data:, relative...) is shown as plain text;
//  - external links open in a new tab with rel="noopener noreferrer";
//  - the page title is the only h1, so Markdown headings start at h2.
//
// Two looks, same rules: the admin preview (Tailwind classes, the default) and
// the public site (`site`: plain elements styled by `.prose` in globals.css).

const ALLOWED = [
  "p", "br", "hr", "strong", "em", "del", "code", "pre", "blockquote",
  "ul", "ol", "li", "a", "h1", "h2", "h3", "h4", "h5", "h6",
];

const SAFE_PROTOCOL = /^(https:|mailto:|tel:)/i;

// An empty result removes the URL; the `a` component then renders plain text.
function safeUrl(url: string): string {
  const clean = url.trim();
  // Control characters / whitespace inside a scheme are a classic way around a
  // protocol check, so refuse any URL that has them.
  if (/[\u0000- \u007f]/.test(clean)) return "";
  return SAFE_PROTOCOL.test(clean) ? clean : "";
}

const heading = (Tag: "h2" | "h3" | "h4" | "h5" | "h6", className?: string) =>
  function Heading({ children }: { children?: React.ReactNode }) {
    return <Tag className={className}>{children}</Tag>;
  };

const link = (className?: string): Components["a"] =>
  function SafeLink({ href, children }) {
    if (!href) return <span>{children}</span>;
    const external = href.toLowerCase().startsWith("https:");
    return (
      <a
        href={href}
        {...(external && { target: "_blank", rel: "noopener noreferrer" })}
        className={className}
      >
        {children}
      </a>
    );
  };

const adminComponents: Components = {
  h1: heading("h2", "mt-10 text-xl font-bold leading-snug md:text-2xl"),
  h2: heading("h3", "mt-8 text-lg font-bold leading-snug md:text-xl"),
  h3: heading("h4", "mt-6 text-md font-semibold"),
  h4: heading("h5", "mt-6 text-md font-semibold"),
  h5: heading("h6", "mt-6 text-base font-semibold"),
  h6: heading("h6", "mt-6 text-base font-semibold"),
  p: ({ children }) => <p className="mt-5 first:mt-0">{children}</p>,
  ul: ({ children }) => <ul className="mt-5 list-disc space-y-2 ps-6 marker:text-pine">{children}</ul>,
  ol: ({ children }) => <ol className="mt-5 list-decimal space-y-2 ps-6 marker:text-pine">{children}</ol>,
  li: ({ children }) => <li className="ps-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mt-5 border-s-4 border-gold bg-stone px-5 py-1 text-ink/90">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-line" />,
  code: ({ children }) => (
    <code dir="ltr" className="rounded-control bg-stone px-1.5 py-0.5 font-mono text-[0.9em]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre dir="ltr" className="mt-5 overflow-x-auto rounded-card bg-stone p-4 text-sm">
      {children}
    </pre>
  ),
  a: link("font-medium text-pine underline underline-offset-4 hover:text-ink"),
};

const siteComponents: Components = {
  h1: heading("h2"),
  h2: heading("h3"),
  h3: heading("h4"),
  h4: heading("h5"),
  h5: heading("h6"),
  h6: heading("h6"),
  code: ({ children }) => <code dir="ltr">{children}</code>,
  pre: ({ children }) => <pre dir="ltr">{children}</pre>,
  a: link(),
};

export function Markdown({
  children,
  className = "",
  site = false,
}: {
  children: string;
  className?: string;
  site?: boolean;
}) {
  return (
    <div className={site ? `prose ${className}` : `max-w-prose break-words ${className}`}>
      <ReactMarkdown
        skipHtml
        allowedElements={ALLOWED}
        unwrapDisallowed
        urlTransform={safeUrl}
        components={site ? siteComponents : adminComponents}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
