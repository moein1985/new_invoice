'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Search, X, FileText, Users, Package, User } from 'lucide-react';

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Fetch search results
  const { data: results, isLoading } = trpc.search.globalSearch.useQuery(
    { query, limit: 10 },
    { 
      enabled: isOpen && query.length >= 2,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    }
  );

  // Keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleResultClick = (link: string) => {
    router.push(link);
    setIsOpen(false);
    setQuery('');
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'customer':
        return <Users className="h-4 w-4 text-blue-600" />;
      case 'document':
        return <FileText className="h-4 w-4 text-green-600" />;
      case 'item':
        return <Package className="h-4 w-4 text-purple-600" />;
      case 'user':
        return <User className="h-4 w-4 text-orange-600" />;
      default:
        return <Search className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'customer':
        return 'مشتری';
      case 'document':
        return 'سند';
      case 'item':
        return 'کالا';
      case 'user':
        return 'کاربر';
      default:
        return '';
    }
  };

  return (
    <>
      {/* Search Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-white border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:border-gray-400 transition-colors"
      >
        <Search className="h-4 w-4" />
        <span>جستجو...</span>
        <kbd className="hidden sm:inline-block rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-800">
          Ctrl+K
        </kbd>
      </button>

      {/* Search Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-50 pt-20">
          <div
            ref={modalRef}
            className="w-full max-w-2xl bg-white rounded-lg shadow-2xl"
          >
            {/* Search Input */}
            <div className="flex items-center border-b border-gray-200 px-4 py-3">
              <Search className="h-5 w-5 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جستجو در مشتریان، اسناد، کالاها..."
                className="flex-1 px-3 py-1 text-gray-900 placeholder-gray-500 focus:outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="mr-2 text-gray-400 hover:text-gray-600"
              >
                <kbd className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800">
                  ESC
                </kbd>
              </button>
            </div>

            {/* Search Results */}
            <div className="max-h-96 overflow-y-auto p-2">
              {query.length < 2 ? (
                <div className="p-8 text-center text-gray-500">
                  حداقل 2 حرف برای جستجو وارد کنید
                </div>
              ) : isLoading ? (
                <div className="p-8 text-center text-gray-500">
                  در حال جستجو...
                </div>
              ) : results && results.totalResults === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  نتیجه‌ای یافت نشد
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Customers */}
                  {results?.customers.map((item: any) => (
                    <button
                      key={item.id}
                      onClick={() => handleResultClick(item.link)}
                      className="w-full flex items-start gap-3 rounded-lg px-3 py-2 text-right hover:bg-gray-100 transition-colors"
                    >
                      <div className="mt-1">{getIcon(item.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{item.title}</span>
                          <span className="text-xs text-gray-500">{getTypeLabel(item.type)}</span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">{item.subtitle}</p>
                      </div>
                    </button>
                  ))}

                  {/* Documents */}
                  {results?.documents.map((item: any) => (
                    <button
                      key={item.id}
                      onClick={() => handleResultClick(item.link)}
                      className="w-full flex items-start gap-3 rounded-lg px-3 py-2 text-right hover:bg-gray-100 transition-colors"
                    >
                      <div className="mt-1">{getIcon(item.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{item.title}</span>
                          <span className="text-xs text-gray-500">{getTypeLabel(item.type)}</span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">{item.subtitle}</p>
                      </div>
                    </button>
                  ))}

                  {/* Document Items */}
                  {results?.documentItems.map((item: any) => (
                    <button
                      key={item.id}
                      onClick={() => handleResultClick(item.link)}
                      className="w-full flex items-start gap-3 rounded-lg px-3 py-2 text-right hover:bg-gray-100 transition-colors"
                    >
                      <div className="mt-1">{getIcon(item.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{item.title}</span>
                          <span className="text-xs text-gray-500">{getTypeLabel(item.type)}</span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">{item.subtitle}</p>
                      </div>
                    </button>
                  ))}

                  {/* Users */}
                  {results?.users.map((item: any) => (
                    <button
                      key={item.id}
                      onClick={() => handleResultClick(item.link)}
                      className="w-full flex items-start gap-3 rounded-lg px-3 py-2 text-right hover:bg-gray-100 transition-colors"
                    >
                      <div className="mt-1">{getIcon(item.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{item.title}</span>
                          <span className="text-xs text-gray-500">{getTypeLabel(item.type)}</span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">{item.subtitle}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {results && results.totalResults > 0 && (
              <div className="border-t border-gray-200 px-4 py-2 text-xs text-gray-500 text-center">
                {results.totalResults} نتیجه یافت شد
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
