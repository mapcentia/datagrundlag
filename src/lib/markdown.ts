import { Marked } from 'marked';

// STAC tillader CommonMark i description. Rå HTML i teksten escapes, og links tillades kun
// til http(s) og mailto, så beskrivelsen kun kan give almindelig tekstformatering og links.
const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const safeHref = (href: string) => /^(https?:|mailto:)/i.test(href.trim());

const md = new Marked({
  gfm: true,
  renderer: {
    html: ({ text }) => escape(text),
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      if (!safeHref(href)) return text;
      return `<a href="${escape(href)}"${title ? ` title="${escape(title)}"` : ''}>${text}</a>`;
    },
    image: ({ text }) => escape(text),
  },
});

export const renderMarkdown = (text: string) => md.parse(text, { async: false }) as string;

/** Ren tekst til meta-beskrivelser: Markdown-tegn fjernes, og teksten afkortes. */
export function plainText(text: string, max = 200): string {
  const plain = text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}
