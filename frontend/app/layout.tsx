import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RE-OS | Real Estate Operating System',
  description: 'Premium real estate SaaS for properties, CRM, chat, billing, and analytics.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-reos-bg text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}

