"use client";

// A finding's question for a pharmacist (the fixed template from checks/questions.ts), ready to copy.
import { CheckIcon, CopyIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyQuestion({ question }: { question: string }) {
  const [copied, setCopied] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(question);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard (permissions, an old browser): select the question so it can be copied by hand.
      const node = textRef.current;
      if (!node) return;
      const range = document.createRange();
      range.selectNodeContents(node);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }
  }

  return (
    <div className="space-y-2.5 rounded-xl border bg-card p-3.5">
      <p className="text-sm font-semibold text-muted-foreground">Ask a pharmacist</p>
      <p ref={textRef} className="leading-relaxed text-pretty">
        {question}
      </p>
      <Button variant="outline" className="h-11 px-4" onClick={copy}>
        {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
        {copied ? "Copied" : "Copy question"}
      </Button>
      <span role="status" className="sr-only">
        {copied ? "Question copied" : ""}
      </span>
    </div>
  );
}
