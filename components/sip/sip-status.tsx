'use client';

import { useSip, SipStatus } from '@/components/sip/sip-provider';
import { Tooltip } from '@/components/ui/tooltip';
import { Phone } from 'lucide-react';

const STATUS_CONFIG: Record<SipStatus, { color: string; label: string }> = {
  registered: { color: 'bg-green-500', label: 'SIP متصل' },
  connecting: { color: 'bg-yellow-500 animate-pulse', label: 'در حال اتصال SIP' },
  disconnected: { color: 'bg-gray-400', label: 'SIP غیرفعال' },
  error: { color: 'bg-red-500', label: 'خطای اتصال SIP' },
};

export function SipStatusIndicator() {
  const { status } = useSip();

  // Don't show anything if disconnected (SIP not configured)
  if (status === 'disconnected') return null;

  const config = STATUS_CONFIG[status];

  return (
    <Tooltip content={config.label} position="bottom">
      <div className="relative flex items-center justify-center rounded-lg p-2 text-gray-500 hover:bg-gray-100">
        <Phone size={18} />
        <span className={`absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full ${config.color} ring-2 ring-white`} />
      </div>
    </Tooltip>
  );
}
