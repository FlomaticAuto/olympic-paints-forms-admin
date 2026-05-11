'use client';

import { useState } from 'react';

export default function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that block clipboard API
      prompt('Copy this link:', url);
    }
  }

  return (
    <button
      className="btn btn-ghost"
      onClick={handleCopy}
      aria-label="Copy public form link"
    >
      {copied ? '✓ Copied' : 'Copy link'}
    </button>
  );
}
