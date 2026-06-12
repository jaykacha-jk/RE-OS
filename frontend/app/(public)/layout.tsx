import { Suspense } from 'react';

import { PublicFooter } from '../../components/public/public-footer';
import { PublicHeader } from '../../components/public/public-header';
import { PublicChatWidget } from '../../components/public/public-chat-widget';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-reos-bg">
      <Suspense fallback={<div className="h-16 border-b border-slate-200 bg-white" />}>
        <PublicHeader />
      </Suspense>
      <div className="flex-1">{children}</div>
      <Suspense fallback={null}>
        <PublicChatWidget />
      </Suspense>
      <Suspense fallback={<div className="bg-slate-950 py-12" />}>
        <PublicFooter />
      </Suspense>
    </div>
  );
}
