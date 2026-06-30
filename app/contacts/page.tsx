'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/toast-provider';
import { LoadingButton } from '@/components/ui/loading-button';
import { Pagination } from '@/components/ui/pagination';
import { Phone, Pencil, Trash2, PhoneCall, Plus } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageSkeleton, TableSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { useSip } from '@/components/sip/sip-provider';

const CATEGORY_LABELS: Record<string, string> = {
  COLLEAGUE: 'همکار',
  CLIENT: 'مشتری',
  VENDOR: 'تامین‌کننده',
  PERSONAL: 'شخصی',
  OTHER: 'سایر',
};

const CATEGORY_COLORS: Record<string, string> = {
  COLLEAGUE: 'bg-blue-100 text-blue-800',
  CLIENT: 'bg-green-100 text-green-800',
  VENDOR: 'bg-purple-100 text-purple-800',
  PERSONAL: 'bg-yellow-100 text-yellow-800',
  OTHER: 'bg-gray-100 text-gray-800',
};

export default function ContactsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [callMenuTarget, setCallMenuTarget] = useState<{ id: string; phone?: string | null; mobile?: string | null } | null>(null);

  // Fetch contacts
  const { data: contacts, isLoading, refetch } = trpc.contact.list.useQuery({
    page,
    limit: 20,
    search: search || undefined,
    category: (categoryFilter as any) || undefined,
  });

  // Mutations
  const createMutation = trpc.contact.create.useMutation({
    onSuccess: () => {
      refetch();
      setIsModalOpen(false);
      setEditingContact(null);
      toast.success('مخاطب با موفقیت اضافه شد');
    },
    onError: (error) => {
      toast.error('خطا در افزودن مخاطب', error.message);
    },
  });

  const updateMutation = trpc.contact.update.useMutation({
    onSuccess: () => {
      refetch();
      setIsModalOpen(false);
      setEditingContact(null);
      toast.success('مخاطب با موفقیت ویرایش شد');
    },
    onError: (error) => {
      toast.error('خطا در ویرایش مخاطب', error.message);
    },
  });

  const deleteMutation = trpc.contact.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success('مخاطب با موفقیت حذف شد');
    },
    onError: (error) => {
      toast.error('خطا در حذف مخاطب', error.message);
    },
  });

  const originateMutation = trpc.ami.originate.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    },
    onError: (error) => {
      toast.error('خطا در برقراری تماس', error.message);
    },
  });

  if (status === 'loading') {
    return <PageSkeleton />;
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      company: (formData.get('company') as string) || undefined,
      position: (formData.get('position') as string) || undefined,
      phone: (formData.get('phone') as string) || undefined,
      mobile: (formData.get('mobile') as string) || undefined,
      email: (formData.get('email') as string) || undefined,
      address: (formData.get('address') as string) || undefined,
      notes: (formData.get('notes') as string) || undefined,
      category: (formData.get('category') as string) || 'OTHER',
    };

    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, ...data });
    } else {
      createMutation.mutate(data as any);
    }
  };

  const { setOriginating } = useSip();

  const handleCall = (destination: string) => {
    setCallMenuTarget(null);
    setOriginating(true);
    originateMutation.mutate({ destination });
  };

  const handleCallClick = (contact: { id: string; phone?: string | null; mobile?: string | null }) => {
    const hasPhone = !!contact.phone;
    const hasMobile = !!contact.mobile;

    if (hasPhone && hasMobile) {
      setCallMenuTarget(contact);
    } else if (hasPhone) {
      handleCall(contact.phone!);
    } else if (hasMobile) {
      handleCall(contact.mobile!);
    }
  };

  const role = session.user.role;
  const canDelete = role === 'ADMIN' || role === 'MANAGER';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">مخاطبین</h1>
            <button
              onClick={() => {
                setEditingContact(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              افزودن مخاطب
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Breadcrumb items={[{ label: 'مخاطبین' }]} />

        {/* Search & Filter */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            placeholder="جستجو در مخاطبین (نام، شماره، شرکت)..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
          />
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
          >
            <option value="">همه دسته‌ها</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {search.trim() && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSearch('')}
              className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800"
            >
              جستجو: {search} ✕
            </button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden bg-white shadow sm:rounded-lg">
          {isLoading ? (
            <TableSkeleton columns={7} rows={10} />
          ) : !contacts?.data.length ? (
            <div className="p-8 text-center text-gray-500">
              هیچ مخاطبی یافت نشد
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <table className="hidden md:table min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">کد</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">نام</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">شرکت/سمت</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">تلفن</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">موبایل</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">دسته</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {contacts.data.map((contact) => (
                    <tr key={contact.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        {contact.code}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        {contact.firstName} {contact.lastName}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        <div>{contact.company || '-'}</div>
                        {contact.position && (
                          <div className="text-xs text-gray-400">{contact.position}</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 direction-ltr">
                        {contact.phone || '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 direction-ltr">
                        {contact.mobile || '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[contact.category] || CATEGORY_COLORS.OTHER}`}>
                          {CATEGORY_LABELS[contact.category] || 'سایر'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {(contact.phone || contact.mobile) && (
                            <button
                              onClick={() => handleCallClick(contact)}
                              disabled={originateMutation.isPending}
                              className="rounded-lg p-1.5 text-green-600 hover:bg-green-50 hover:text-green-800 disabled:opacity-50"
                              title="تماس"
                            >
                              <PhoneCall size={18} />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingContact(contact);
                              setIsModalOpen(true);
                            }}
                            className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-800"
                            title="ویرایش"
                          >
                            <Pencil size={18} />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => setDeleteTarget({ id: contact.id, name: `${contact.firstName} ${contact.lastName}` })}
                              className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 hover:text-red-800"
                              title="حذف"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-gray-200">
                {contacts.data.map((contact) => (
                  <div key={contact.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {contact.firstName} {contact.lastName}
                        </h3>
                        <p className="text-sm text-gray-500">{contact.code}</p>
                      </div>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[contact.category] || CATEGORY_COLORS.OTHER}`}>
                        {CATEGORY_LABELS[contact.category] || 'سایر'}
                      </span>
                    </div>

                    {contact.company && (
                      <p className="text-sm text-gray-600 mb-1">{contact.company}{contact.position ? ` - ${contact.position}` : ''}</p>
                    )}

                    <div className="space-y-1 mb-3">
                      {contact.phone && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Phone className="ml-2 h-4 w-4" />
                          <span dir="ltr">{contact.phone}</span>
                        </div>
                      )}
                      {contact.mobile && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Phone className="ml-2 h-4 w-4" />
                          <span dir="ltr">{contact.mobile}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {(contact.phone || contact.mobile) && (
                        <button
                          onClick={() => handleCallClick(contact)}
                          disabled={originateMutation.isPending}
                          className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                        >
                          <PhoneCall size={16} />
                          تماس
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingContact(contact);
                          setIsModalOpen(true);
                        }}
                        className="flex-1 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                      >
                        ویرایش
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => setDeleteTarget({ id: contact.id, name: `${contact.firstName} ${contact.lastName}` })}
                          className="flex-1 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                        >
                          حذف
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Pagination */}
        {contacts && contacts.meta.totalPages > 1 && (
          <div className="mt-4 rounded-lg bg-white shadow">
            <Pagination
              currentPage={page}
              totalPages={contacts.meta.totalPages}
              totalItems={contacts.meta.total}
              itemsPerPage={contacts.meta.limit}
              onPageChange={(newPage) => setPage(newPage)}
            />
          </div>
        )}
      </main>

      {/* Call Menu (when contact has both phone and mobile) */}
      {callMenuTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setCallMenuTarget(null)} />
            <div className="relative z-50 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
              <h3 className="mb-4 text-lg font-bold text-gray-900">انتخاب شماره تماس</h3>
              <div className="space-y-3">
                {callMenuTarget.phone && (
                  <button
                    onClick={() => handleCall(callMenuTarget.phone!)}
                    disabled={originateMutation.isPending}
                    className="flex w-full items-center gap-3 rounded-lg border border-gray-200 p-4 text-right hover:bg-green-50 disabled:opacity-50"
                  >
                    <Phone className="h-5 w-5 text-green-600" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">تلفن ثابت</div>
                      <div className="text-sm text-gray-500" dir="ltr">{callMenuTarget.phone}</div>
                    </div>
                  </button>
                )}
                {callMenuTarget.mobile && (
                  <button
                    onClick={() => handleCall(callMenuTarget.mobile!)}
                    disabled={originateMutation.isPending}
                    className="flex w-full items-center gap-3 rounded-lg border border-gray-200 p-4 text-right hover:bg-green-50 disabled:opacity-50"
                  >
                    <Phone className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">موبایل</div>
                      <div className="text-sm text-gray-500" dir="ltr">{callMenuTarget.mobile}</div>
                    </div>
                  </button>
                )}
              </div>
              <button
                onClick={() => setCallMenuTarget(null)}
                className="mt-4 w-full rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setIsModalOpen(false)} />
            <div className="relative z-50 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <h2 className="mb-4 text-xl font-bold">
                {editingContact ? 'ویرایش مخاطب' : 'افزودن مخاطب جدید'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                {editingContact && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">کد</label>
                    <input
                      type="text"
                      value={editingContact.code}
                      disabled
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-gray-600"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">نام <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      name="firstName"
                      required
                      defaultValue={editingContact?.firstName}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">نام خانوادگی <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      name="lastName"
                      required
                      defaultValue={editingContact?.lastName}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">شرکت/سازمان</label>
                    <input
                      type="text"
                      name="company"
                      defaultValue={editingContact?.company || ''}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">سمت</label>
                    <input
                      type="text"
                      name="position"
                      defaultValue={editingContact?.position || ''}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">تلفن ثابت</label>
                    <input
                      type="text"
                      name="phone"
                      defaultValue={editingContact?.phone || ''}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">موبایل</label>
                    <input
                      type="text"
                      name="mobile"
                      defaultValue={editingContact?.mobile || ''}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">ایمیل</label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={editingContact?.email || ''}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">آدرس</label>
                  <textarea
                    name="address"
                    rows={2}
                    defaultValue={editingContact?.address || ''}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">دسته‌بندی</label>
                  <select
                    name="category"
                    defaultValue={editingContact?.category || 'OTHER'}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">یادداشت</label>
                  <textarea
                    name="notes"
                    rows={2}
                    defaultValue={editingContact?.notes || ''}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
                <div className="flex gap-3">
                  <LoadingButton
                    type="submit"
                    isLoading={createMutation.isPending || updateMutation.isPending}
                    variant="primary"
                    className="flex-1"
                  >
                    {editingContact ? 'ذخیره تغییرات' : 'افزودن'}
                  </LoadingButton>
                  <LoadingButton
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    variant="secondary"
                    className="flex-1"
                  >
                    انصراف
                  </LoadingButton>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate({ id: deleteTarget.id }, {
              onSuccess: () => setDeleteTarget(null),
            });
          }
        }}
        title={`حذف مخاطب ${deleteTarget?.name ?? ''}`}
        message="آیا از حذف این مخاطب اطمینان دارید؟ این عملیات قابل بازگشت نیست."
        confirmText="حذف مخاطب"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
