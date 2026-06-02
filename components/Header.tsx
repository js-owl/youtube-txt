import Link from "next/link";
import { Github } from "lucide-react";

export default function Header() {
  return (
    <header className="w-full border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="mx-auto max-w-prose px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="text-base font-semibold tracking-tight text-foreground hover:opacity-80 transition-opacity"
        >
          <span className="text-foreground">Tube</span>
          <span className="text-accent">Sum</span>
        </Link>

        <a
          href="https://github.com/js-owl/youtube-txt"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub проекта"
          className="text-muted hover:text-foreground transition-colors p-2 -mr-2 rounded-md hover:bg-border/40"
        >
          <Github size={20} strokeWidth={1.8} />
        </a>
      </div>
    </header>
  );
}
