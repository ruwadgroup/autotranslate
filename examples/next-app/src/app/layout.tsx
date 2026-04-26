import type { ReactNode } from 'react';
import './globals.css';

// Root layout — minimal because the per-locale `<html>` (with the right
// `lang=`) lives at app/[lang]/layout.tsx. Next requires this file to exist
// even when the meaningful work happens in a nested route group.
export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return children;
}
