'use client';

import { useState } from 'react';

export default function CopyLinkButton({ formId }: { formId: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    // Build URL from the current origin so it always points to the right domain.
    const url = `${window.location.origin}/f/${formId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
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
