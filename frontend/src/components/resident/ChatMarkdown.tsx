"use client";

import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

/**
 * Markdown renderer for assistant replies in the resident chat panel.
 *
 * The hosted model answers with Markdown (bold labels, bullet lists), and the
 * panel previously showed those characters literally to residents. This maps
 * the Markdown elements onto MUI components so the text inherits the theme's
 * typography and stays compact inside a narrow chat bubble.
 *
 * Raw HTML is deliberately NOT enabled (no `rehype-raw`), so any markup the
 * model emits is rendered as inert text. `remark-breaks` keeps single newlines
 * as line breaks, which the no-key fallback's answers rely on — they separate
 * fields with "\n" rather than blank lines.
 */
const components: Components = {
  p: ({ children }) => (
    <Typography
      variant="body2"
      sx={{ my: 0.5, "&:first-of-type": { mt: 0 }, "&:last-child": { mb: 0 } }}
    >
      {children}
    </Typography>
  ),
  strong: ({ children }) => (
    <Box component="strong" sx={{ fontWeight: 700 }}>
      {children}
    </Box>
  ),
  em: ({ children }) => (
    <Box component="em" sx={{ fontStyle: "italic" }}>
      {children}
    </Box>
  ),
  a: ({ children, href }) => (
    <Link href={href} target="_blank" rel="noopener noreferrer" variant="body2">
      {children}
    </Link>
  ),
  ul: ({ children }) => (
    <Box component="ul" sx={{ m: 0, my: 0.5, pl: 2.5 }}>
      {children}
    </Box>
  ),
  ol: ({ children }) => (
    <Box component="ol" sx={{ m: 0, my: 0.5, pl: 2.5 }}>
      {children}
    </Box>
  ),
  li: ({ children }) => (
    <Typography component="li" variant="body2" sx={{ my: 0.25 }}>
      {children}
    </Typography>
  ),
  // Headings are demoted to compact bold body text: a chat bubble has no room
  // for display-sized headings.
  h1: ({ children }) => (
    <Typography variant="body2" sx={{ fontWeight: 700, mt: 1, mb: 0.5 }}>
      {children}
    </Typography>
  ),
  h2: ({ children }) => (
    <Typography variant="body2" sx={{ fontWeight: 700, mt: 1, mb: 0.5 }}>
      {children}
    </Typography>
  ),
  h3: ({ children }) => (
    <Typography variant="body2" sx={{ fontWeight: 700, mt: 1, mb: 0.5 }}>
      {children}
    </Typography>
  ),
  code: ({ children }) => (
    <Box
      component="code"
      sx={{
        px: 0.5,
        py: 0.25,
        borderRadius: 0.5,
        bgcolor: "action.hover",
        fontFamily: "monospace",
        fontSize: "0.85em",
      }}
    >
      {children}
    </Box>
  ),
  pre: ({ children }) => (
    <Box
      component="pre"
      sx={{
        m: 0,
        my: 0.5,
        p: 1,
        borderRadius: 1,
        bgcolor: "action.hover",
        overflowX: "auto",
        fontSize: "0.8em",
        fontFamily: "monospace",
      }}
    >
      {children}
    </Box>
  ),
  // A table can be wider than the bubble, so scroll it rather than stretching
  // the whole panel.
  table: ({ children }) => (
    <Box sx={{ my: 0.5, overflowX: "auto" }}>
      <Box
        component="table"
        sx={{
          borderCollapse: "collapse",
          fontSize: "0.8rem",
          "& td, & th": {
            border: 1,
            borderColor: "divider",
            px: 0.75,
            py: 0.5,
          },
        }}
      >
        {children}
      </Box>
    </Box>
  ),
};

/** Render an assistant reply as Markdown. */
export function ChatMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
}
