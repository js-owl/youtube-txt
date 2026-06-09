"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { Summarizer } from "@/components/summarizer";

export function HomeShell() {
  const [authVersion, setAuthVersion] = useState(0);

  return (
    <>
      <Header onAuthChange={() => setAuthVersion((v) => v + 1)} />
      <Summarizer authVersion={authVersion} />
    </>
  );
}