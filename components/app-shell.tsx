'use client';

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Sidebar } from '@/components/ui/sidebar';
import { SipProvider } from '@/components/sip/sip-provider';
import { IncomingCallPopup } from '@/components/sip/incoming-call-popup';
import { MusicPlayer } from '@/components/ui/music-player';

const NO_SIDEBAR_ROUTES = ['/login', '/'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const showSidebar = session && !NO_SIDEBAR_ROUTES.includes(pathname);

  if (!showSidebar) {
    return <>{children}</>;
  }

  return (
    <SipProvider>
      <Sidebar />
      <IncomingCallPopup />
      {/* Desktop: offset by sidebar width. Mobile: offset by top bar height */}
      <div className="pt-14 lg:pt-14 lg:pr-60 transition-all duration-200 min-h-screen sidebar-content">
        {children}
      </div>
      <MusicPlayer />
    </SipProvider>
  );
}
