'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { trpc } from '@/lib/trpc';

export type SipStatus = 'disconnected' | 'connecting' | 'registered' | 'error';

interface SipContextType {
  status: SipStatus;
  incomingCall: IncomingCallInfo | null;
  dismissCall: () => void;
  setOriginating: (value: boolean) => void;
}

export interface IncomingCallInfo {
  callerNumber: string;
  timestamp: Date;
}

const SipContext = createContext<SipContextType>({
  status: 'disconnected',
  incomingCall: null,
  dismissCall: () => {},
  setOriginating: () => {},
});

export const useSip = () => useContext(SipContext);

export function SipProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [status, setStatus] = useState<SipStatus>('disconnected');
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);
  const originatingRef = useRef<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const registererRef = useRef<any>(null);
  const uaRef = useRef<any>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { data: sipSettings } = trpc.user.getSipSettings.useQuery(undefined, {
    enabled: !!session,
    refetchOnWindowFocus: false,
  });

  const dismissCall = useCallback(() => {
    setIncomingCall(null);
  }, []);

  const setOriginating = useCallback((value: boolean) => {
    originatingRef.current = value;
    // Auto-reset after 15 seconds
    if (value) {
      setTimeout(() => { originatingRef.current = false; }, 15000);
    }
  }, []);

  // Auto-dismiss after 30 seconds
  useEffect(() => {
    if (!incomingCall) return;
    const timer = setTimeout(() => {
      setIncomingCall(null);
    }, 30000);
    return () => clearTimeout(timer);
  }, [incomingCall]);

  // Connect to SIP server
  useEffect(() => {
    if (!sipSettings?.sipEnabled || !sipSettings.sipServer || !sipSettings.sipUsername || !sipSettings.sipPassword) {
      setStatus('disconnected');
      return;
    }

    let cleanup = false;

    const connectSip = async () => {
      try {
        setStatus('connecting');

        // Dynamic import of sip.js
        const SIPjs = await import('sip.js').catch(() => null);
        if (!SIPjs || cleanup) {
          if (!cleanup) setStatus('error');
          return;
        }

        const { UserAgent, Registerer } = SIPjs;

        const transportOptions = {
          server: `${sipSettings.sipTransport || 'ws'}://${sipSettings.sipServer}:${sipSettings.sipPort || 8089}/ws`,
          traceSip: false,
        };

        const uri = UserAgent.makeURI(`sip:${sipSettings.sipUsername}@${sipSettings.sipServer}`);
        if (!uri) {
          setStatus('error');
          return;
        }

        const userAgent = new UserAgent({
          uri,
          transportOptions,
          authorizationUsername: sipSettings.sipUsername ?? undefined,
          authorizationPassword: sipSettings.sipPassword ?? undefined,
          displayName: sipSettings.sipExtension || sipSettings.sipUsername || undefined,
          noAnswerTimeout: 60,
          delegate: {
            onInvite: (invitation: any) => {
              // If user just initiated an outgoing call via AMI Originate,
              // don't show popup and don't reject (let physical phone ring)
              if (originatingRef.current) {
                originatingRef.current = false;
                return;
              }

              // Extract caller ID from the INVITE
              const remoteIdentity = invitation.remoteIdentity;
              let callerNumber = 'ناشناس';

              if (remoteIdentity) {
                callerNumber = remoteIdentity.uri?.user || remoteIdentity.displayName || 'ناشناس';
              }

              setIncomingCall({
                callerNumber,
                timestamp: new Date(),
              });

              // Auto-reject the call (we're only monitoring, not answering)
              // The physical phone will ring and answer
              try {
                invitation.reject();
              } catch {
                // Ignore rejection errors
              }
            },
          },
        });

        uaRef.current = userAgent;

        await userAgent.start();

        if (cleanup) {
          await userAgent.stop();
          return;
        }

        const registerer = new Registerer(userAgent, {
          expires: 300,
        });

        registererRef.current = registerer;

        registerer.stateChange.addListener((state: any) => {
          if (cleanup) return;
          const RegistererState = SIPjs.RegistererState;
          switch (state) {
            case RegistererState.Registered:
              setStatus('registered');
              break;
            case RegistererState.Unregistered:
              setStatus('disconnected');
              break;
            case RegistererState.Terminated:
              setStatus('disconnected');
              break;
          }
        });

        await registerer.register();
      } catch (err) {
        console.error('SIP connection error:', err);
        if (!cleanup) {
          setStatus('error');
          // Retry after 10 seconds
          reconnectTimerRef.current = setTimeout(() => {
            if (!cleanup) connectSip();
          }, 10000);
        }
      }
    };

    connectSip();

    return () => {
      cleanup = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (registererRef.current) {
        try {
          registererRef.current.unregister();
        } catch {}
      }
      if (uaRef.current) {
        try {
          uaRef.current.stop();
        } catch {}
      }
      registererRef.current = null;
      uaRef.current = null;
    };
  }, [sipSettings?.sipEnabled, sipSettings?.sipServer, sipSettings?.sipPort, sipSettings?.sipUsername, sipSettings?.sipPassword, sipSettings?.sipTransport, sipSettings?.sipExtension]);

  return (
    <SipContext.Provider value={{ status, incomingCall, dismissCall, setOriginating }}>
      {children}
    </SipContext.Provider>
  );
}
