import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GitHub Evaluator | Hiring-Ready Portfolio Analysis',
  description:
    'Analyze GitHub portfolios with a polished review dashboard that scores code quality, complexity, documentation, consistency, and tech relevance.',
  keywords: [
    'GitHub portfolio evaluator',
    'AI code review',
    'portfolio analysis',
    'developer hiring',
    'Next.js',
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
