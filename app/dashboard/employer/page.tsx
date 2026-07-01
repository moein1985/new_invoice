'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Ticket as TicketIcon, Plus, FolderKanban } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { PageSkeleton } from '@/components/ui/skeleton';
import moment from 'moment-jalaali';

const statusLabels: Record<string, string> = {
  OPEN: 'باز',
  IN_PROGRESS: 'در حال بررسی',
  RESOLVED: 'حل‌شده',
  CLOSED: 'بسته‌شده',
};

const statusColors: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-500',
};

const priorityLabels: Record<string, string> = {
  LOW: 'کم',
  MEDIUM: 'متوسط',
  HIGH: 'زیاد',
  URGENT: 'فوری',
};

export default function EmployerDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const { data: stats, isLoading } = trpc.ticket.stats.useQuery(undefined, {
    enabled: !!session,
  });

  const { data: myProjects } = trpc.ticket.myProjects.useQuery(undefined, {
    enabled: !!session && session.user.role === 'EMPLOYER',
  });

  if (status === 'loading' || isLoading) return <PageSkeleton />;
  if (!session) { router.push('/login'); return null; }

  const statusCounts: Record<string, number> = {};
  stats?.byStatus?.forEach((s: any) => {
    statusCounts[s.status] = s._count?._all ?? 0;
  });

  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-800">داشبورد کارفرما</h1>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs text-blue-700">باز</p>
          <p className="mt-1 text-2xl font-bold text-blue-800">{statusCounts.OPEN ?? 0}</p>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-xs text-yellow-700">در حال بررسی</p>
          <p className="mt-1 text-2xl font-bold text-yellow-800">{statusCounts.IN_PROGRESS ?? 0}</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-xs text-green-700">حل‌شده</p>
          <p className="mt-1 text-2xl font-bold text-green-800">{statusCounts.RESOLVED ?? 0}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-700">بسته‌شده</p>
          <p className="mt-1 text-2xl font-bold text-gray-800">{statusCounts.CLOSED ?? 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tickets */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <TicketIcon size={20} />
              تیکت‌های اخیر
            </h2>
            <Link
              href="/tickets/new"
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={14} />
              تیکت جدید
            </Link>
          </div>

          {!stats?.recent?.length ? (
            <p className="py-4 text-sm text-gray-500 text-center">هنوز تیکتی ثبت نشده است.</p>
          ) : (
            <div className="space-y-2">
              {stats.recent.map((ticket: any) => (
                <Link
                  key={ticket.id}
                  href={`/tickets/${ticket.id}`}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 hover:bg-gray-100 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">{ticket.title}</p>
                    <p className="text-xs text-gray-500 font-mono">{ticket.ticketNumber}</p>
                  </div>
                  <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[ticket.status]}`}>
                    {statusLabels[ticket.status]}
                  </span>
                </Link>
              ))}
            </div>
          )}

          <div className="mt-4 text-center">
            <Link href="/tickets" className="text-sm text-blue-600 hover:text-blue-700">
              مشاهده همه تیکت‌ها ←
            </Link>
          </div>
        </div>

        {/* My Projects */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-bold text-gray-800 flex items-center gap-2">
            <FolderKanban size={20} />
            پروژه‌های من
          </h2>

          {!myProjects?.length ? (
            <p className="py-4 text-sm text-gray-500 text-center">پروژه‌ای به شما اختصاص نیافته است.</p>
          ) : (
            <div className="space-y-2">
              {myProjects.map((project: any) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{project.name}</p>
                    <p className="text-xs text-gray-500 font-mono">{project.code}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
