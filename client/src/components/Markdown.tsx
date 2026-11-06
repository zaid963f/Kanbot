import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// AI answers are Markdown. react-markdown never renders raw HTML, so model output can't inject markup.
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: text }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {text}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
