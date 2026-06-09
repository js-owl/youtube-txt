"use client";

import { AuthButton } from "@/components/auth-button";

type HeaderProps = {
  onAuthChange?: () => void;
};

export function Header({ onAuthChange }: HeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-20 border-b border-border/50 glass">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <span className="font-heading text-lg font-bold uppercase tracking-wide text-foreground">
          Смысл
        </span>
        <AuthButton onAuthChange={onAuthChange} />
      </div>
    </header>
  );
}
