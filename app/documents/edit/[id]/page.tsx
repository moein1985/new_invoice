'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import moment from 'moment-jalaali';
import { useToast } from '@/components/ui/toast-provider';
import { DisplaySettingsPanel, DEFAULT_DISPLAY_SETTINGS, parseDisplaySettings, type DisplaySettings } from '@/components/ui/display-settings';
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

export default function EditDocumentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
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
  const [discountAmount, setDiscountAmount] = useState(0);
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
  const [isLoaded, setIsLoaded] = useState(false);

  // Fetch document data
  const { data: docData, isLoading: documentLoading } = trpc.document.getById.useQuery(
    { id },
    { enabled: !!id }
  );

  // Fetch customers for dropdown
  const { data: customersData } = trpc.customer.list.useQuery({
    page: 1,
    limit: 100,
    search: debouncedCustomerSearch || undefined,
  });

  // Fetch suppliers for dropdown
  const { data: suppliersData } = trpc.supplier.getAll.useQuery();

  // Update mutation
  const updateMutation = trpc.document.update.useMutation({
    onSuccess: () => {
      toast.success('سند با موفقیت ویرایش شد');
      router.push(`/documents/${id}`);
    },
    onError: (error) => {
      toast.error('خطا در ویرایش سند', error.message);
    },
  });

  // تبدیل تاریخ میلادی به شمسی
  useEffect(() => {
    const jalali = moment(docDate).format('jYYYY/jM/jD');
    setPersianDate(jalali);
  }, [docDate]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedCustomerSearch(customerSearch);
    }, 350);

    return () => clearTimeout(t);
  }, [customerSearch]);

  useEffect(() => {
    if (!focusNewItemId) return;
    const input = window.document.querySelector(
      `input[data-item-id="${focusNewItemId}"][data-focus="productName"]`
    ) as HTMLInputElement | null;
    if (input) {
      input.focus();
      setFocusNewItemId(null);
    }
  }, [focusNewItemId, items]);
  // Load document data into form
  useEffect(() => {
    if (docData && !isLoaded) {
      setCustomerId(docData.customer.id);
      setProjectName(docData.projectName || '');
      setDocType(docData.documentType);
      setDocDate(new Date(docData.issueDate).toISOString().split('T')[0]);
      setNotes(docData.notes || '');
      setDiscountAmount(docData.discountAmount || 0);
      setDisplaySettings(parseDisplaySettings((docData as any).displaySettings));
      
      setItems(
        docData.items.map((item: any) => ({
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
  }, [docData, isLoaded]);

  if (status === 'loading' || documentLoading) {
    return <PageSkeleton />;
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  if (!docData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl text-red-600">سند یافت نشد!</div>
      </div>
    );
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
    setShowValidation(true);
    
    if (!customerId) {
      toast.warning('لطفاً مشتری را انتخاب کنید');
      return;
    }

    if (items.some((item) => !item.productName || item.quantity <= 0 || item.sellPrice < 0 || !item.unit || !item.supplier)) {
      toast.warning('لطفاً تمام اطلاعات اقلام را به درستی وارد کنید');
      return;
    }

    updateMutation.mutate({
      id,
      customerId,
      projectName: projectName || undefined,
      issueDate: new Date(docDate),
      notes: notes || undefined,
      discountAmount: discountAmount || 0,
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

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold" style={{ color: '#1a1a1a' }}>
            ویرایش سند
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Breadcrumb items={[
          { label: 'اسناد', href: '/documents' },
          { label: docData?.documentNumber || '', href: `/documents/${id}` },
          { label: 'ویرایش' },
        ]} />
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Document Info */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold" style={{ color: '#1a1a1a' }}>
              اطلاعات سند
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium" style={{ color: '#1a1a1a' }}>
                  نوع سند <span className="text-red-500">*</span>
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
                  مشتری <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="جستجوی مشتری (نام یا کد)..."
                  className="mt-1 mb-2 w-full rounded-lg border border-gray-300 px-3 py-2"
                  style={{ color: '#2a2a2a' }}
                />
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  onBlur={() => markTouched('customerId')}
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
                {(showValidation || touchedFields.has('customerId')) && !customerId && (
                  <p className="mt-1 text-xs text-red-600">انتخاب مشتری الزامی است</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium" style={{ color: '#1a1a1a' }}>
                  نام مسیر / پروژه
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="مثال: تکمیل دیتا سنتر"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  style={{ color: '#2a2a2a', fontFamily: 'Vazir, Tahoma, sans-serif' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium" style={{ color: '#1a1a1a' }}>
                  تاریخ سند <span className="text-red-500">*</span>
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
                <div key={item.id}>
                <div className="rounded-lg border border-gray-200 p-4">
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
                        نام محصول <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        data-item-id={item.id}
                        data-focus="productName"
                        value={item.productName}
                        onChange={(e) => updateItem(item.id, 'productName', e.target.value)}
                        onBlur={() => markTouched(`${item.id}.productName`)}
                        onKeyDown={(e) => handleItemFieldKeyDown(e, index)}
                        required
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                        style={{ color: '#2a2a2a' }}
                      />
                      {isFieldError(`${item.id}.productName`, getItemErrors(item).productName) && (
                        <p className="mt-1 text-xs text-red-600">{getItemErrors(item).productName}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium" style={{ color: '#1a1a1a' }}>
                        تأمین‌کننده <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={item.supplier}
                        onChange={(e) => updateItem(item.id, 'supplier', e.target.value)}
                        onBlur={() => markTouched(`${item.id}.supplier`)}
                        required
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 bg-white"
                        style={{ color: '#2a2a2a' }}
                      >
                        <option value="">انتخاب کنید...</option>
                        {suppliersData?.map((s) => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                        {item.supplier && !suppliersData?.some(s => s.name === item.supplier) && (
                          <option value={item.supplier}>{item.supplier}</option>
                        )}
                      </select>
                      {isFieldError(`${item.id}.supplier`, getItemErrors(item).supplier) && (
                        <p className="mt-1 text-xs text-red-600">{getItemErrors(item).supplier}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium" style={{ color: '#1a1a1a' }}>
                        واحد <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                        onBlur={() => markTouched(`${item.id}.unit`)}
                        onKeyDown={(e) => handleItemFieldKeyDown(e, index)}
                        required
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                        style={{ color: '#2a2a2a' }}
                      />
                      {isFieldError(`${item.id}.unit`, getItemErrors(item).unit) && (
                        <p className="mt-1 text-xs text-red-600">{getItemErrors(item).unit}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    <div>
                      <label className="block text-sm font-medium" style={{ color: '#1a1a1a' }}>
                        تعداد <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        onBlur={() => markTouched(`${item.id}.quantity`)}
                        onKeyDown={(e) => handleItemFieldKeyDown(e, index)}
                        required
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                        style={{ color: '#2a2a2a' }}
                      />
                      {isFieldError(`${item.id}.quantity`, getItemErrors(item).quantity) && (
                        <p className="mt-1 text-xs text-red-600">{getItemErrors(item).quantity}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium" style={{ color: '#1a1a1a' }}>
                        قیمت خرید <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.purchasePrice}
                        onChange={(e) => updateItem(item.id, 'purchasePrice', parseFloat(e.target.value) || 0)}
                        onBlur={() => markTouched(`${item.id}.purchasePrice`)}
                        onKeyDown={(e) => handleItemFieldKeyDown(e, index)}
                        required
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                        style={{ color: '#2a2a2a' }}
                      />
                      {isFieldError(`${item.id}.purchasePrice`, getItemErrors(item).purchasePrice) && (
                        <p className="mt-1 text-xs text-red-600">{getItemErrors(item).purchasePrice}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium" style={{ color: '#1a1a1a' }}>
                        قیمت فروش <span className="text-red-500">*</span>
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
                        onBlur={() => markTouched(`${item.id}.sellPrice`)}
                        onKeyDown={(e) => handleItemFieldKeyDown(e, index)}
                        required
                        disabled={!item.isManualPrice}
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500"
                        style={{ color: '#2a2a2a' }}
                      />
                      {isFieldError(`${item.id}.sellPrice`, getItemErrors(item).sellPrice) && (
                        <p className="mt-1 text-xs text-red-600">{getItemErrors(item).sellPrice}</p>
                      )}
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
                        onKeyDown={(e) => handleItemFieldKeyDown(e, index)}
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
                      onKeyDown={(e) => handleItemFieldKeyDown(e, index)}
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

          <div className="sticky top-20 rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-blue-900">خلاصه سند</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between" style={{ color: '#2a2a2a' }}>
                <span>تعداد اقلام:</span>
                <span className="font-semibold">{items.length}</span>
              </div>
              <div className="flex items-center justify-between" style={{ color: '#2a2a2a' }}>
                <span>مجموع تعداد:</span>
                <span className="font-semibold">{items.reduce((sum, item) => sum + item.quantity, 0)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-blue-200 pt-2 text-base font-bold text-blue-700">
                <span>مبلغ قابل پرداخت:</span>
                <span>{formatCurrency(calculateGrandTotal() - discountAmount)}</span>
              </div>
            </div>
          </div>

          {/* Display Settings */}
          <DisplaySettingsPanel settings={displaySettings} onChange={setDisplaySettings} />

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
