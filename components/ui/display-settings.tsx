'use client';

import { useState } from 'react';
import { Settings, ChevronDown } from 'lucide-react';

export interface DisplaySettings {
  showDate: boolean;
  showDueDate: boolean;
  showOperator: boolean;
  showCustomerName: boolean;
  showCustomerCode: boolean;
  showCustomerPhone: boolean;
  showCustomerCompany: boolean;
  showPurchasePrice: boolean;
  showProfit: boolean;
  showItemDescription: boolean;
  showNotes: boolean;
  showApprovals: boolean;
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  showDate: true,
  showDueDate: true,
  showOperator: true,
  showCustomerName: true,
  showCustomerCode: true,
  showCustomerPhone: true,
  showCustomerCompany: true,
  showPurchasePrice: true,
  showProfit: true,
  showItemDescription: true,
  showNotes: true,
  showApprovals: true,
};

const SETTING_LABELS: Record<keyof DisplaySettings, string> = {
  showDate: 'تاریخ سند',
  showDueDate: 'سررسید',
  showOperator: 'تهیه‌کننده',
  showCustomerName: 'نام مشتری',
  showCustomerCode: 'کد مشتری',
  showCustomerPhone: 'تلفن مشتری',
  showCustomerCompany: 'شرکت مشتری',
  showPurchasePrice: 'قیمت خرید',
  showProfit: 'سود',
  showItemDescription: 'توضیحات آیتم',
  showNotes: 'یادداشت‌ها',
  showApprovals: 'تاریخچه تاییدیه‌ها',
};

const SETTING_GROUPS: { title: string; keys: (keyof DisplaySettings)[] }[] = [
  {
    title: 'اطلاعات سند',
    keys: ['showDate', 'showDueDate', 'showOperator'],
  },
  {
    title: 'اطلاعات مشتری',
    keys: ['showCustomerName', 'showCustomerCode', 'showCustomerPhone', 'showCustomerCompany'],
  },
  {
    title: 'جزئیات اقلام',
    keys: ['showPurchasePrice', 'showProfit', 'showItemDescription'],
  },
  {
    title: 'سایر',
    keys: ['showNotes', 'showApprovals'],
  },
];

interface DisplaySettingsPanelProps {
  settings: DisplaySettings;
  onChange: (settings: DisplaySettings) => void;
}

export function DisplaySettingsPanel({ settings, onChange }: DisplaySettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleSetting = (key: keyof DisplaySettings) => {
    onChange({ ...settings, [key]: !settings[key] });
  };

  const disabledCount = Object.values(settings).filter((v) => !v).length;

  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-right hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-gray-600" />
          <span className="font-bold text-gray-800">تنظیمات نمایش</span>
          {disabledCount > 0 && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">
              {disabledCount} مورد مخفی
            </span>
          )}
        </div>
        <span className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDown className="h-5 w-5" />
        </span>
      </button>

      {isOpen && (
        <div className="border-t px-4 py-4">
          <p className="mb-4 text-sm text-gray-500">
            مشخص کنید کدام اطلاعات در نمای وب و PDF نمایش داده شوند.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {SETTING_GROUPS.map((group) => (
              <div key={group.title} className="rounded-lg border bg-gray-50 p-3">
                <h4 className="mb-2 text-sm font-bold text-gray-700">{group.title}</h4>
                <div className="space-y-2">
                  {group.keys.map((key) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
                    >
                      <input
                        type="checkbox"
                        checked={settings[key]}
                        onChange={() => toggleSetting(key)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {SETTING_LABELS[key]}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function parseDisplaySettings(raw: any): DisplaySettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_DISPLAY_SETTINGS };
  return {
    ...DEFAULT_DISPLAY_SETTINGS,
    ...Object.fromEntries(
      Object.entries(raw).filter(
        ([key, val]) => key in DEFAULT_DISPLAY_SETTINGS && typeof val === 'boolean'
      )
    ),
  } as DisplaySettings;
}
