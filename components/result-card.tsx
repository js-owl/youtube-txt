'use client'

import { Check, Copy, RotateCcw, Sparkles } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import type { Summary } from '@/lib/mock-summary'

type ResultCardProps = {
  summary: Summary
  thumbnailUrl: string | null
  onReset: () => void
}

export function ResultCard({
  summary,
  thumbnailUrl,
  onReset,
}: ResultCardProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const text = [
      summary.title,
      '',
      'Главная мысль:',
      summary.mainIdea,
      '',
      'Ключевые тезисы:',
      ...summary.keyPoints.map((p) => `• ${p}`),
    ].join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable — silently ignore
    }
  }

  return (
    <div className="glass animate-fade-up w-full overflow-hidden rounded-3xl border border-border">
      <div className="flex flex-col gap-4 border-b border-border p-6 sm:flex-row sm:items-center sm:p-8">
        {thumbnailUrl && (
          <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl border border-border sm:w-44">
            <Image
              src={thumbnailUrl || '/placeholder.svg'}
              alt={`Превью видео: ${summary.title}`}
              fill
              sizes="(max-width: 640px) 100vw, 176px"
              className="object-cover"
              crossOrigin="anonymous"
              unoptimized
            />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-balance text-lg font-semibold leading-snug text-foreground sm:text-xl">
            {summary.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.channel} · {summary.duration}
          </p>
        </div>
      </div>

      <div className="max-h-[50vh] overflow-y-auto p-6 sm:p-8">
        <section>
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="size-4 text-accent" aria-hidden="true" />
            <h3 className="text-xs font-semibold uppercase tracking-widest text-accent">
              Главная мысль
            </h3>
          </div>
          <p className="text-pretty text-base leading-relaxed text-foreground sm:text-lg">
            {summary.mainIdea}
          </p>
        </section>

        <section className="mt-7">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Ключевые тезисы
          </h3>
          <ul className="space-y-3">
            {summary.keyPoints.map((point, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className="mt-2 size-1.5 shrink-0 rounded-full gradient-accent"
                  aria-hidden="true"
                />
                <span className="text-pretty leading-relaxed text-foreground/90">
                  {point}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="flex flex-col gap-3 border-t border-border p-6 sm:flex-row sm:p-8">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-border bg-secondary px-5 py-3 font-medium text-secondary-foreground transition-colors hover:bg-secondary/70"
        >
          {copied ? (
            <>
              <Check className="size-4 text-accent" aria-hidden="true" />
              Скопировано
            </>
          ) : (
            <>
              <Copy className="size-4" aria-hidden="true" />
              Скопировать текст
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold text-primary-foreground gradient-accent transition-transform hover:scale-[1.02]"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Сделать ещё одно
        </button>
      </div>
    </div>
  )
}
