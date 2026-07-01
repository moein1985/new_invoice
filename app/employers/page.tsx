'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Ticket as TicketIcon, Search } from 'lucide-react';
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

export default function EmployersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');

  const { data: tickets, isLoading } = trpc.ticket.list.useQuery({
    page,
    limit: 20,
    search: search || undefined,
    status: statusFilter || undefined,
    projectId: projectFilter || undefined,
  });

  const { data: projects } = trpc.project.list.useQuery(
    { page: 1, limit: 100, activeOnly: true }
  );

  if (status === 'loading') return <PageSkeleton />;
  if (!session) { router.push('/login'); return null; }

  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'MANAGER') {
    router.push('/dashboard');
    return null;
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-800 flex items-center gap-2">
        <Building2 size={24} />
        مدیریت تیکت‌های کارفرمایان
      </h1>

      {/* Filters */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="جستجو..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 py-2 pr-10 pl-4 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select
          value={projectFilter}
          onChange={(e) => { setProjectFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          <option value="">همه پروژه‌ها</option>
          {projects?.data?.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
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
                <th className="px-4 py-3 text-right font-medium">پروژه</th>
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
                  <td className="px-4 py-3 text-gray-600">{ticket.project?.name}</td>
                  <td className="px-4 py-3 text-gray-600">{ticket.createdBy?.fullName}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{priorityLabels[ticket.priority]}</td>
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
