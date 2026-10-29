import './globals.css';
import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Virtualan — Photobooth Virtual & LDR Strip Photo',
  description: 'Ambil strip foto empat potongan — sendiri, atau foto bareng teman secara langsung jarak jauh.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
