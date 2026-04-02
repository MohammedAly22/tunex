import type { Metadata } from 'next';
import { Geist, JetBrains_Mono, Fira_Code } from 'next/font/google';
import Sidebar from '@/components/layout/Sidebar';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
});

const firaCode = Fira_Code({
  variable: '--font-fira-code',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'TuneX — Agentic Fine-Tuning Platform',
  description: 'From prompt to checkpoint. Let AI agents handle your fine-tuning pipeline.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${jetbrainsMono.variable} ${firaCode.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-bg text-text-primary">
        <ThemeProvider>
          <Sidebar />
          <main className="ml-60 min-h-screen transition-all duration-300">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
