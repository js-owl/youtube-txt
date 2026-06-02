"use client";

import { useState } from "react";
import { Clipboard, Check } from "lucide-react";

type Props = {
  text: string;
};

export default function CopyButton({ text }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback для старых браузеров / небезопасного контекста
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Не удалось скопировать текст", e);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Скопировано" : "Скопировать саммари"}
      title={copied ? "Скопировано" : "Скопировать"}
      className={[
        "inline-flex items-center gap-1.5",
        "h-8 px-2.5",
        "rounded-md",
        "text-[13px] font-medium",
        "transition-all duration-200",
        copied
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "text-muted hover:text-foreground hover:bg-border/50 ring-1 ring-transparent hover:ring-border",
      ].join(" ")}
    >
      {copied ? (
        <>
          <Check size={15} strokeWidth={2.2} />
          <span>Скопировано</span>
        </>
      ) : (
        <>
          <Clipboard size={15} strokeWidth={1.8} />
          <span>Скопировать</span>
        </>
      )}
    </button>
  );
}
