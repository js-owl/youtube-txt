import Image from "next/image";
import { Summarizer } from "@/components/summarizer";

export default function Page() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-16">
      {/* Фоновое изображение */}
      <Image
        src="/images/mountain-bg.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
        aria-hidden="true"
      />
      {/* Затемняющий оверлей */}
      <div className="absolute inset-0 bg-background/70" aria-hidden="true" />
      <div
        className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/80"
        aria-hidden="true"
      />

      <div className="relative z-10 flex w-full justify-center">
        <Summarizer />
      </div>
    </main>
  );
}
