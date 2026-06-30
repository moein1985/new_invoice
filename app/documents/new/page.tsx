'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import moment from 'moment-jalaali';
import { useToast } from '@/components/ui/toast-provider';
import { LoadingButton } from '@/components/ui/loading-button';
import { DisplaySettingsPanel, DEFAULT_DISPLAY_SETTINGS, type DisplaySettings } from '@/components/ui/display-settings';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';

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

export default function NewDocumentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');
  const [showValidation, setShowValidation] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [focusNewItemId, setFocusNewItemId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [docType, setDocType] = useState('TEMP_PROFORMA');
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [persianDate, setPersianDate] = useState('');
  const [notes, setNotes] = useState('');
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>({ ...DEFAULT_DISPLAY_SETTINGS });
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

  // تبدیل تاریخ میلادی به شمسی
  const persianDateComputed = moment(docDate).format('jYYYY/jM/jD');
  useEffect(() => {
    setPersianDate(persianDateComputed);
  }, [persianDateComputed]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedCustomerSearch(customerSearch);
    }, 350);

    return () => clearTimeout(t);
  }, [customerSearch]);

  useEffect(() => {
    if (!focusNewItemId) return;
    const input = document.querySelector(
      `input[data-item-id="${focusNewItemId}"][data-focus="productName"]`
    ) as HTMLInputElement | null;
    if (input) {
      input.focus();
      setFocusNewItemId(null);
    }
  }, [focusNewItemId, items]);

  // Fetch customers for dropdown
  const { data: customersData } = trpc.customer.list.useQuery({
    page: 1,
    limit: 100,
    search: debouncedCustomerSearch || undefined,
  });

  // Fetch suppliers for dropdown
  const { data: suppliersData } = trpc.supplier.getAll.useQuery();

  const createMutation = trpc.document.create.useMutation({
    onSuccess: () => {
      toast.success('سند با موفقیت ایجاد شد');
      setTimeout(() => router.push('/documents'), 500);
    },
    onError: (error) => {
      toast.error('خطا در ایجاد سند', error.message);
    },
  });

  if (status === 'loading') {
    return <PageSkeleton />;
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  const addItem = () => {
    const id = Date.now().toString();
    setItems([
      ...items,
      {
        id,
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
    setFocusNewItemId(id);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof DocumentItem, value: any) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
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
    setShowValidation(true);
    
    if (!customerId) {
      toast.warning('لطفاً مشتری را انتخاب کنید');
      return;
    }

    if (items.some((item) => !item.productName || item.quantity <= 0 || item.sellPrice < 0 || !item.unit || !item.supplier)) {
      toast.warning('لطفاً تمام اطلاعات اقلام را به درستی وارد کنید');
      return;
    }

    createMutation.mutate({
      documentType: docType as any,
      customerId,
      projectName: projectName || undefined,
      issueDate: new Date(docDate),
      notes: notes || undefined,
      discountAmount: 0,
      defaultProfitPercentage: 20,
      displaySettings,
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

  const getItemErrors = (item: DocumentItem) => {
    return {
      productName: !item.productName.trim() ? 'نام محصول الزامی است' : '',
      supplier: !item.supplier.trim() ? 'تامین‌کننده الزامی است' : '',
      unit: !item.unit.trim() ? 'واحد الزامی است' : '',
      quantity: item.quantity <= 0 ? 'تعداد باید بیشتر از صفر باشد' : '',
      purchasePrice: item.purchasePrice < 0 ? 'قیمت خرید نمی‌تواند منفی باشد' : '',
      sellPrice: item.sellPrice < 0 ? 'قیمت فروش نمی‌تواند منفی باشد' : '',
    };
  };

  const markTouched = (field: string) => {
    setTouchedFields((prev) => new Set(prev).add(field));
  };

  const isFieldError = (field: string, error: string) => {
    return error && (showValidation || touchedFields.has(field));
  };

  const handleItemFieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter' && !e.shiftKey && index === items.length - 1) {
      e.preventDefault();
      addItem();
    }
  };

  const toPersianNumber = (num: number | string) => {
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return num.toString().replace(/\d/g, (digit) => persianDigits[parseInt(digit)]);
  };

  const formatNumberWithCommas = (num: number | string): string => {
    if (!num && num !== 0) return '';
    const formatted = new Intl.NumberFormat('en-US').format(Number(num));
    return toPersianNumber(formatted);
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">ایجاد سند جدید</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Breadcrumb items={[
          { label: 'اسناد', href: '/documents' },
          { label: 'سند جدید' },
        ]} />
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Document Info */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">اطلاعات سند</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-900">نوع سند <span className="text-red-500">*</span></label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                >
                  {Object.entries(DOC_TYPES).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900">مشتری <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="جستجوی مشتری (نام یا کد)..."
                  className="mt-1 mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                />
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  onBlur={() => markTouched('customerId')}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                >
                  <option value="">انتخاب مشتری</option>
                  {customersData?.data.map((customer: any) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} ({customer.code})
                    </option>
                  ))}
                </select>
                {(showValidation || touchedFields.has('customerId')) && !customerId && (
                  <p className="mt-1 text-xs text-red-600">انتخاب مشتری الزامی است</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900">نام مسیر / پروژه</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="مثال: تکمیل دیتا سنتر"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                  style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900">تاریخ سند <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                />
                <p className="mt-1 text-xs text-gray-600">تاریخ شمسی: {persianDate}</p>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-900">یادداشت</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                placeholder="یادداشت‌های اضافی..."
              />
            </div>
          </div>

          {/* Items */}
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">اقلام سند</h2>
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
                <div key={item.id}>
                <div className="rounded-lg border border-gray-200 p-4">
                  {(() => {
                    const errors = getItemErrors(item);
                    return (
                      <>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium text-gray-900">قلم {index + 1}</span>
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
                      <label className="block text-sm font-medium text-gray-900">نام محصول <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        data-item-id={item.id}
                        data-focus="productName"
                        value={item.productName}
                        onChange={(e) => updateItem(item.id, 'productName', e.target.value)}
                        onBlur={() => markTouched(`${item.id}.productName`)}
                        onKeyDown={(e) => handleItemFieldKeyDown(e, index)}
                        required
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                      />
                      {isFieldError(`${item.id}.productName`, errors.productName) && (
                        <p className="mt-1 text-xs text-red-600">{errors.productName}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900">تأمین‌کننده <span className="text-red-500">*</span></label>
                      <select
                        value={item.supplier}
                        onChange={(e) => updateItem(item.id, 'supplier', e.target.value)}
                        onBlur={() => markTouched(`${item.id}.supplier`)}
                        required
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-gray-900 bg-white"
                      >
                        <option value="">انتخاب کنید...</option>
                        {suppliersData?.map((s) => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                      {isFieldError(`${item.id}.supplier`, errors.supplier) && (
                        <p className="mt-1 text-xs text-red-600">{errors.supplier}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900">واحد <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                        onBlur={() => markTouched(`${item.id}.unit`)}
                        onKeyDown={(e) => handleItemFieldKeyDown(e, index)}
                        required
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                      />
                      {isFieldError(`${item.id}.unit`, errors.unit) && (
                        <p className="mt-1 text-xs text-red-600">{errors.unit}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900">تعداد <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        value={item.quantity || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          updateItem(item.id, 'quantity', parseFloat(value) || 0);
                        }}
                        onBlur={() => markTouched(`${item.id}.quantity`)}
                        onKeyDown={(e) => handleItemFieldKeyDown(e, index)}
                        required
                        min="0"
                        step="1"
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                        style={{ fontFamily: 'Vazir, Tahoma, sans-serif', direction: 'ltr', textAlign: 'right' }}
                      />
                      {isFieldError(`${item.id}.quantity`, errors.quantity) && (
                        <p className="mt-1 text-xs text-red-600">{errors.quantity}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900">قیمت خرید (ریال) <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        value={item.purchasePrice || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          updateItem(item.id, 'purchasePrice', parseFloat(value) || 0);
                        }}
                        onBlur={() => markTouched(`${item.id}.purchasePrice`)}
                        onKeyDown={(e) => handleItemFieldKeyDown(e, index)}
                        required
                        min="0"
                        step="1"
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                        style={{ fontFamily: 'Vazir, Tahoma, sans-serif', direction: 'ltr', textAlign: 'right' }}
                      />
                      {isFieldError(`${item.id}.purchasePrice`, errors.purchasePrice) && (
                        <p className="mt-1 text-xs text-red-600">{errors.purchasePrice}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900">
                        قیمت فروش (ریال) <span className="text-red-500">*</span>
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
                        value={item.sellPrice || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          updateItem(item.id, 'sellPrice', parseFloat(value) || 0);
                        }}
                        onBlur={() => markTouched(`${item.id}.sellPrice`)}
                        onKeyDown={(e) => handleItemFieldKeyDown(e, index)}
                        required
                        disabled={!item.isManualPrice}
                        min="0"
                        step="1"
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
                        style={{ fontFamily: 'Vazir, Tahoma, sans-serif', direction: 'ltr', textAlign: 'right' }}
                      />
                      {isFieldError(`${item.id}.sellPrice`, errors.sellPrice) && (
                        <p className="mt-1 text-xs text-red-600">{errors.sellPrice}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900">درصد سود (%)</label>
                      <input
                        type="number"
                        value={item.profitPercentage || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          updateItem(item.id, 'profitPercentage', parseFloat(value) || 0);
                        }}
                        onKeyDown={(e) => handleItemFieldKeyDown(e, index)}
                        disabled={item.isManualPrice}
                        min="0"
                        step="0.01"
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
                        style={{ fontFamily: 'Vazir, Tahoma, sans-serif', direction: 'ltr', textAlign: 'right' }}
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-900">توضیحات</label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      onKeyDown={(e) => handleItemFieldKeyDown(e, index)}
                      className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm font-medium">
                    <div className="text-gray-900">
                      سود: {formatCurrency((item.sellPrice - item.purchasePrice) * item.quantity)}
                    </div>
                    <div className="text-blue-600">
                      جمع: {formatCurrency(calculateItemTotal(item))}
                    </div>
                  </div>
                      </>
                    );
                  })()}
                </div>
                <div className="flex justify-center py-1">
                  <button
                    type="button"
                    onClick={() => {
                      const newId = Date.now().toString();
                      setItems([
                        ...items.slice(0, index + 1),
                        { id: newId, productName: '', description: '', quantity: 1, unit: 'عدد', purchasePrice: 0, sellPrice: 0, supplier: '', profitPercentage: 20, isManualPrice: false },
                        ...items.slice(index + 1),
                      ]);
                      setFocusNewItemId(newId);
                    }}
                    className="flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 py-1 text-xs text-gray-500 hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                  >
                    + افزودن قلم
                  </button>
                </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="mt-6 rounded-lg bg-blue-50 p-4">
              <div className="flex items-center justify-between text-lg font-bold">
                <span className="text-gray-900">جمع کل:</span>
                <span className="text-blue-600">{formatCurrency(calculateGrandTotal())}</span>
              </div>
            </div>
          </div>

          <div className="sticky top-20 rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-blue-900">خلاصه سند</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between text-gray-700">
                <span>تعداد اقلام:</span>
                <span className="font-semibold">{toPersianNumber(items.length)}</span>
              </div>
              <div className="flex items-center justify-between text-gray-700">
                <span>مجموع تعداد:</span>
                <span className="font-semibold">{toPersianNumber(items.reduce((sum, item) => sum + item.quantity, 0))}</span>
              </div>
              <div className="flex items-center justify-between border-t border-blue-200 pt-2 text-base font-bold text-blue-700">
                <span>جمع کل:</span>
                <span>{formatCurrency(calculateGrandTotal())}</span>
              </div>
            </div>
          </div>

          {/* Display Settings */}
          <DisplaySettingsPanel settings={displaySettings} onChange={setDisplaySettings} />

          {/* Actions */}
          <div className="flex gap-3">
            <LoadingButton
              type="submit"
              isLoading={createMutation.isPending}
              variant="primary"
              size="lg"
              className="flex-1"
            >
              ذخیره سند
            </LoadingButton>
            <Link
              href="/documents"
              className="flex-1 rounded-lg bg-gray-300 px-6 py-3 text-center text-gray-700 hover:bg-gray-400"
            >
              انصراف
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
