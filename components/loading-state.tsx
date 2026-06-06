'use client'

import { useEffect, useState } from 'react'

const MESSAGES = [
  'Извлекаем аудио из видео…',
  'Нейросеть внимательно слушает…',
  'Выделяем главные мысли…',
  'Формируем краткое содержание…',
]

export function LoadingState() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % MESSAGES.length)
    }, 1400)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="glass animate-fade-up w-full rounded-3xl border border-border p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span
          className="size-2.5 animate-pulse rounded-full bg-primary shadow-[0_0_16px] shadow-primary"
          aria-hidden="true"
        />
        <p
          key={index}
          className="animate-fade-in text-pretty text-base font-medium text-foreground sm:text-lg"
          aria-live="polite"
        >
          {MESSAGES[index]}
        </p>
      </div>

      <div className="mt-6 space-y-3" aria-hidden="true">
        <div className="skeleton h-3 w-2/3 rounded-full" />
        <div className="skeleton h-3 w-full rounded-full" />
        <div className="skeleton h-3 w-11/12 rounded-full" />
        <div className="skeleton h-3 w-4/5 rounded-full" />
      </div>

      <span className="sr-only">Идёт создание краткого содержания</span>
    </div>
  )
}
