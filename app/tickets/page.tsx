'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Ticket as TicketIcon } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';
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

const priorityColors: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
};

export default function TicketsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const role = session?.user?.role;
  const isManager = role === 'ADMIN' || role === 'MANAGER';

  const { data: tickets, isLoading } = trpc.ticket.list.useQuery({
    page,
    limit: 20,
    search: search || undefined,
    status: statusFilter || undefined,
  });

  if (status === 'loading') return <PageSkeleton />;
  if (!session) { router.push('/login'); return null; }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <TicketIcon size={24} />
          تیکت‌ها
        </h1>
        <Link
          href="/tickets/new"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          تیکت جدید
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="جستجوی تیکت..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 py-2 pr-10 pl-4 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          <option value="">همه وضعیت‌ها</option>
          <option value="OPEN">باز</option>
          <option value="IN_PROGRESS">در حال بررسی</option>
          <option value="RESOLVED">حل‌شده</option>
          <option value="CLOSED">بسته‌شده</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-8 text-center text-gray-400">در حال بارگذاری...</div>
      ) : !tickets?.data?.length ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          تیکتی یافت نشد
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-right font-medium">شماره</th>
                <th className="px-4 py-3 text-right font-medium">عنوان</th>
                {isManager && <th className="px-4 py-3 text-right font-medium">پروژه</th>}
                <th className="px-4 py-3 text-right font-medium">ثبت‌کننده</th>
                <th className="px-4 py-3 text-center font-medium">اولویت</th>
                <th className="px-4 py-3 text-center font-medium">وضعیت</th>
                <th className="px-4 py-3 text-right font-medium">تاریخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tickets.data.map((ticket: any) => (
                <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{ticket.ticketNumber}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    <Link href={`/tickets/${ticket.id}`} className="hover:text-blue-600">
                      {ticket.title}
                    </Link>
                  </td>
                  {isManager && (
                    <td className="px-4 py-3 text-gray-600">{ticket.project?.name}</td>
                  )}
                  <td className="px-4 py-3 text-gray-600">{ticket.createdBy?.fullName}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${priorityColors[ticket.priority]}`}>
                      {priorityLabels[ticket.priority]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[ticket.status]}`}>
                      {statusLabels[ticket.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {moment(ticket.createdAt).format('jYYYY/jMM/jDD')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tickets?.meta && (
        <div className="mt-4">
          <Pagination
            currentPage={tickets.meta.page}
            totalPages={tickets.meta.totalPages}
            totalItems={tickets.meta.total}
            itemsPerPage={tickets.meta.limit}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
