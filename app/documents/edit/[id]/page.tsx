'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import moment from 'moment-jalaali';

const DOC_TYPES = {
  TEMP_PROFORMA: 'پیش فاکتور موقت',
  PROFORMA: 'پیش فاکتور',
  INVOICE: 'فاکتور',
  RETURN_INVOICE: 'فاکتور برگشتی',
  RECEIPT: 'رسید',
  OTHER: 'سایر',
};

type DocumentItem = {
  id: string;
  productName: string;
  description: string;
  quantity: number;
  unit: string;
  purchasePrice: number;
  sellPrice: number;
  supplier: string;
  profitPercentage: number;
  isManualPrice: boolean;
};

export default function EditDocumentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [customerId, setCustomerId] = useState('');
  const [docType, setDocType] = useState('TEMP_PROFORMA');
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [persianDate, setPersianDate] = useState('');
  const [notes, setNotes] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [items, setItems] = useState<DocumentItem[]>([
    { 
      id: '1', 
      productName: '', 
      description: '', 
      quantity: 1, 
      unit: 'عدد',
      purchasePrice: 0, 
      sellPrice: 0, 
      supplier: '',
      profitPercentage: 20,
      isManualPrice: false,
    },
  ]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Fetch document data
  const { data: document, isLoading: documentLoading } = trpc.document.getById.useQuery(
    { id },
    { enabled: !!id }
  );

  // Fetch customers for dropdown
  const { data: customersData } = trpc.customer.list.useQuery({
    page: 1,
    limit: 100,
  });

  // Update mutation
  const updateMutation = trpc.document.update.useMutation({
    onSuccess: () => {
      router.push(`/documents/${id}`);
    },
  });

  // تبدیل تاریخ میلادی به شمسی
  useEffect(() => {
    const jalali = moment(docDate).format('jYYYY/jM/jD');
    setPersianDate(jalali);
  }, [docDate]);

  // Load document data into form
  useEffect(() => {
    if (document && !isLoaded) {
      setCustomerId(document.customer.id);
      setDocType(document.documentType);
      setDocDate(new Date(document.issueDate).toISOString().split('T')[0]);
      setNotes(document.notes || '');
      setDiscountAmount(document.discountAmount || 0);
      
      setItems(
        document.items.map((item: any) => ({
          id: item.id,
          productName: item.productName,
          description: item.description || '',
          quantity: item.quantity,
          unit: item.unit,
          purchasePrice: item.purchasePrice,
          sellPrice: item.sellPrice,
          supplier: item.supplier,
          profitPercentage: item.profitPercentage || 20,
          isManualPrice: item.isManualPrice || false,
        }))
      );
      
      setIsLoaded(true);
    }
  }, [document, isLoaded]);

  if (status === 'loading' || documentLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl">در حال بارگذاری...</div>
      </div>
    );
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  if (!document) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl text-red-600">سند یافت نشد!</div>
      </div>
    );
  }

  const addItem = () => {
    setItems([
      ...items,
      {
        id: Date.now().toString(),
        productName: '',
        description: '',
        quantity: 1,
        unit: 'عدد',
        purchasePrice: 0,
        sellPrice: 0,
        supplier: '',
        profitPercentage: 20,
        isManualPrice: false,
      },
    ]);
  };

  const removeItem = (itemId: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== itemId));
    }
  };

  const updateItem = (itemId: string, field: keyof DocumentItem, value: any) => {
    setItems(
      items.map((item) => {
        if (item.id === itemId) {
          const updated = { ...item, [field]: value };
          
          // محاسبه خودکار قیمت فروش اگر isManualPrice=false
          if (!updated.isManualPrice && (field === 'purchasePrice' || field === 'profitPercentage')) {
            updated.sellPrice = updated.purchasePrice * (1 + updated.profitPercentage / 100);
          }
          
          // اگر isManualPrice تغییر کرد
          if (field === 'isManualPrice') {
            if (!value) {
              // اگر چک‌باکس خاموش شد، قیمت فروش رو محاسبه کن
              updated.sellPrice = updated.purchasePrice * (1 + updated.profitPercentage / 100);
            }
          }
          
          return updated;
        }
        return item;
      })
    );
  };

  const calculateItemTotal = (item: DocumentItem) => {
    return item.quantity * item.sellPrice;
  };

  const calculateGrandTotal = () => {
    return items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerId) {
      alert('لطفاً مشتری را انتخاب کنید');
      return;
    }

    if (items.some((item) => !item.productName || item.quantity <= 0 || item.sellPrice < 0 || !item.unit || !item.supplier)) {
      alert('لطفاً تمام اطلاعات اقلام را به درستی وارد کنید');
      return;
    }

    updateMutation.mutate({
      id,
      customerId,
      issueDate: new Date(docDate),
      notes: notes || undefined,
      discountAmount: discountAmount || 0,
      items: items.map((item) => ({
        productName: item.productName,
        description: item.description || undefined,
        quantity: item.quantity,
        unit: item.unit,
        purchasePrice: item.purchasePrice,
        sellPrice: item.sellPrice,
        supplier: item.supplier,
        profitPercentage: item.profitPercentage,
        isManualPrice: item.isManualPrice,
      })),
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fa-IR').format(amount) + ' ریال';
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold" style={{ color: '#1a1a1a' }}>
              ویرایش سند
            </h1>
            <Link href={`/documents/${id}`} className="text-gray-500 hover:text-gray-700">
              بازگشت ←
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Document Info */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold" style={{ color: '#1a1a1a' }}>
              اطلاعات سند
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium" style={{ color: '#1a1a1a' }}>
                  نوع سند *
                </label>
                <select
                  value={docType}
                  disabled
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2"
                  style={{ color: '#666' }}
                >
                  {Object.entries(DOC_TYPES).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">نوع سند قابل تغییر نیست</p>
              </div>
              <div>
                <label className="block text-sm font-medium" style={{ color: '#1a1a1a' }}>
                  مشتری *
                </label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  style={{ color: '#2a2a2a' }}
                >
                  <option value="">انتخاب مشتری</option>
                  {customersData?.data.map((customer: any) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} ({customer.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium" style={{ color: '#1a1a1a' }}>
                  تاریخ سند *
                </label>
                <input
                  type="date"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  style={{ color: '#2a2a2a' }}
                />
                <p className="mt-1 text-xs text-gray-600">تاریخ شمسی: {persianDate}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium" style={{ color: '#1a1a1a' }}>
                  تخفیف (ریال)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  style={{ color: '#2a2a2a' }}
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium" style={{ color: '#1a1a1a' }}>
                یادداشت
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                style={{ color: '#2a2a2a' }}
                placeholder="یادداشت‌های اضافی..."
              />
            </div>
          </div>

          {/* Items */}
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: '#1a1a1a' }}>
                اقلام سند
              </h2>
              <button
                type="button"
                onClick={addItem}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
              >
                + افزودن قلم
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={item.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium" style={{ color: '#1a1a1a' }}>
                      قلم {index + 1}
                    </span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        حذف
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium" style={{ color: '#1a1a1a' }}>
                        نام محصول *
                      </label>
                      <input
                        type="text"
                        value={item.productName}
                        onChange={(e) => updateItem(item.id, 'productName', e.target.value)}
                        required
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                        style={{ color: '#2a2a2a' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium" style={{ color: '#1a1a1a' }}>
                        تأمین‌کننده *
                      </label>
                      <input
                        type="text"
                        value={item.supplier}
                        onChange={(e) => updateItem(item.id, 'supplier', e.target.value)}
                        required
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                        style={{ color: '#2a2a2a' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium" style={{ color: '#1a1a1a' }}>
                        واحد *
                      </label>
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                        required
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                        style={{ color: '#2a2a2a' }}
                      />
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    <div>
                      <label className="block text-sm font-medium" style={{ color: '#1a1a1a' }}>
                        تعداد *
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        required
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                        style={{ color: '#2a2a2a' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium" style={{ color: '#1a1a1a' }}>
                        قیمت خرید *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.purchasePrice}
                        onChange={(e) => updateItem(item.id, 'purchasePrice', parseFloat(e.target.value) || 0)}
                        required
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                        style={{ color: '#2a2a2a' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium" style={{ color: '#1a1a1a' }}>
                        قیمت فروش *
                        <label className="mr-2 inline-flex items-center text-xs font-normal">
                          <input
                            type="checkbox"
                            checked={item.isManualPrice}
                            onChange={(e) => updateItem(item.id, 'isManualPrice', e.target.checked)}
                            className="ml-1"
                          />
                          <span className="text-gray-600">دستی</span>
                        </label>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.sellPrice}
                        onChange={(e) => updateItem(item.id, 'sellPrice', parseFloat(e.target.value) || 0)}
                        required
                        disabled={!item.isManualPrice}
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500"
                        style={{ color: '#2a2a2a' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium" style={{ color: '#1a1a1a' }}>
                        درصد سود
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={item.profitPercentage}
                        onChange={(e) => updateItem(item.id, 'profitPercentage', parseFloat(e.target.value) || 0)}
                        disabled={item.isManualPrice}
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500"
                        style={{ color: '#2a2a2a' }}
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-sm font-medium" style={{ color: '#1a1a1a' }}>
                      توضیحات
                    </label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                      style={{ color: '#2a2a2a' }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm font-medium">
                    <div style={{ color: '#1a1a1a' }}>
                      سود: {formatCurrency((item.sellPrice - item.purchasePrice) * item.quantity)}
                    </div>
                    <div className="text-blue-600">
                      جمع: {formatCurrency(calculateItemTotal(item))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="mt-6 rounded-lg bg-blue-50 p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium" style={{ color: '#2a2a2a' }}>جمع کل:</span>
                  <span className="font-bold text-blue-600">{formatCurrency(calculateGrandTotal())}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-red-600">تخفیف:</span>
                    <span className="font-bold text-red-600">{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t-2 pt-2">
                  <span className="text-lg font-bold text-blue-700">مبلغ قابل پرداخت:</span>
                  <span className="text-lg font-bold text-blue-700">
                    {formatCurrency(calculateGrandTotal() - discountAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex-1 rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {updateMutation.isPending ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
            </button>
            <Link
              href={`/documents/${id}`}
              className="flex-1 rounded-lg bg-gray-300 px-6 py-3 text-center text-gray-700 hover:bg-gray-400"
            >
              انصراف
            </Link>
          </div>

          {updateMutation.isError && (
            <div className="rounded-lg bg-red-50 p-4 text-red-800">
              خطا در ذخیره سند: {updateMutation.error.message}
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
