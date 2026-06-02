"use client";

import ReactMarkdown from "react-markdown";
import { Youtube } from "lucide-react";
import CopyButton from "./CopyButton";

export type SummaryResult = {
  title: string;
  thumbnailUrl?: string;
  videoId?: string;
  summary: string; // markdown
};

type Props = {
  data: SummaryResult;
};

export default function ResultBlock({ data }: Props) {
  const { title, thumbnailUrl, videoId, summary } = data;

  const thumb =
    thumbnailUrl ||
    (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null);

  return (
    <article
      className="w-full bg-card rounded-2xl ring-1 ring-border shadow-soft overflow-hidden animate-fade-in"
      aria-label="Результат саммари"
    >
      {/* Шапка с превью видео */}
      <header className="flex items-start sm:items-center gap-3 p-4 sm:p-5 border-b border-border">
        <div className="shrink-0 w-28 sm:w-32 aspect-video rounded-md overflow-hidden bg-border relative">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt={title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted">
              <Youtube size={22} strokeWidth={1.5} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wider text-muted font-medium mb-1">
            Видео распознано
          </p>
          <h2
            className="text-sm sm:text-[15px] font-semibold text-foreground leading-snug line-clamp-2"
            title={title}
          >
            {title}
          </h2>
        </div>

        <div className="shrink-0 -mr-1">
          <CopyButton text={summary} />
        </div>
      </header>

      {/* Тело с саммари */}
      <div className="p-4 sm:p-6">
        <div
          className="prose-summary text-[16px] sm:text-[17px] text-foreground"
          aria-live="polite"
        >
          <ReactMarkdown
            components={{
              a: ({ node: _node, ...props }) => (
                <a
                  {...props}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:opacity-80 transition-opacity"
                />
              ),
            }}
          >
            {summary}
          </ReactMarkdown>
        </div>
      </div>
    </article>
  );
}
