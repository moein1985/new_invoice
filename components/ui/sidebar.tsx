'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import {
  LayoutDashboard,
  FileText,
  Users,
  CheckSquare,
  UserCog,
  Database,
  Phone,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  AlertTriangle,
  FolderKanban,
  ClipboardList,
  Calendar,
  ShoppingCart,
  Truck,
  BookUser,
  FileImage,
  Ticket as TicketIcon,
  Building2,
} from 'lucide-react';
import { GlobalSearch } from '@/components/ui/global-search';
import { NotificationBell } from '@/components/ui/notification-bell';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { SipStatusIndicator } from '@/components/sip/sip-status';
import { Tooltip } from '@/components/ui/tooltip';
import { trpc } from '@/lib/trpc';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const isManagerOrAdmin = !!session && (session.user.role === 'ADMIN' || session.user.role === 'MANAGER' || session.user.role === 'TECHNICAL');

  const { data: pendingCount } = trpc.document.pendingApprovals.useQuery(undefined, {
    enabled: isManagerOrAdmin,
    select: (data) => data?.length ?? 0,
  });

  const { data: staleCount } = trpc.document.staleDocuments.useQuery(undefined, {
    enabled: isManagerOrAdmin,
    select: (data) => data?.length ?? 0,
  });

  const { data: pendingWorkReports } = trpc.workReport.pendingCount.useQuery(undefined, {
    enabled: isManagerOrAdmin,
  });

  const { data: pendingPurchases } = trpc.purchase.pendingCount.useQuery(undefined, {
    enabled: isManagerOrAdmin,
  });

  const { data: pendingContractorDocs } = trpc.contractorDoc.pendingCount.useQuery(undefined, {
    enabled: isManagerOrAdmin,
  });

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close mobile menu on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  if (!session) return null;

  const role = session.user.role;

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const navGroups: NavGroup[] = role === 'CONTRACTOR' ? [
    {
      label: '',
      items: [
        { href: '/dashboard/contractor', label: 'داشبورد', icon: <LayoutDashboard size={20} /> },
        { href: '/projects', label: 'پروژه‌ها', icon: <FolderKanban size={20} /> },
        { href: '/my-reports', label: 'گزارش‌های من', icon: <ClipboardList size={20} /> },
        { href: '/my-docs', label: 'مستندات من', icon: <FileImage size={20} /> },
        { href: '/calendar', label: 'تقویم', icon: <Calendar size={20} /> },
      ],
    },
  ] : role === 'EMPLOYER' ? [
    {
      label: '',
      items: [
        { href: '/dashboard/employer', label: 'داشبورد', icon: <LayoutDashboard size={20} /> },
        { href: '/calendar', label: 'تقویم', icon: <Calendar size={20} /> },
        { href: '/tickets', label: 'تیکت‌ها', icon: <TicketIcon size={20} /> },
      ],
    },
  ] : role === 'TECHNICAL' ? [
    {
      label: '',
      items: [
        { href: '/dashboard/technical', label: 'داشبورد', icon: <LayoutDashboard size={20} /> },
        { href: '/projects', label: 'پروژه‌ها', icon: <FolderKanban size={20} /> },
        { href: '/my-reports', label: 'گزارش‌های من', icon: <ClipboardList size={20} /> },
        { href: '/my-docs', label: 'مستندات من', icon: <FileImage size={20} /> },
        { href: '/calendar', label: 'تقویم', icon: <Calendar size={20} /> },
      ],
    },
    {
      label: 'افراد و پروژه‌ها',
      items: [
        {
          href: '/work-reports',
          label: 'گزارش کار',
          icon: <ClipboardList size={20} />,
          badge: pendingWorkReports && pendingWorkReports > 0 ? pendingWorkReports : undefined,
        },
        {
          href: '/contractor-docs',
          label: 'مستندات پیمانکار',
          icon: <FileImage size={20} />,
          badge: pendingContractorDocs && pendingContractorDocs > 0 ? pendingContractorDocs : undefined,
        },
      ],
    },
  ] : [
    {
      label: '',
      items: [
        { href: '/dashboard', label: 'داشبورد', icon: <LayoutDashboard size={20} /> },
        { href: '/calendar', label: 'تقویم', icon: <Calendar size={20} /> },
        { href: '/contacts', label: 'مخاطبین', icon: <BookUser size={20} /> },
      ],
    },
    {
      label: 'مدیریت اسناد',
      items: [
        { href: '/documents', label: 'اسناد', icon: <FileText size={20} /> },
        {
          href: '/approvals',
          label: 'تاییدیه‌ها',
          icon: <CheckSquare size={20} />,
          roles: ['ADMIN', 'MANAGER'],
          badge: pendingCount && pendingCount > 0 ? pendingCount : undefined,
        },
        {
          href: '/stale-documents',
          label: 'اسناد بلاتکلیف',
          icon: <AlertTriangle size={20} />,
          roles: ['ADMIN', 'MANAGER'],
          badge: staleCount && staleCount > 0 ? staleCount : undefined,
        },
      ],
    },
    {
      label: 'افراد و پروژه‌ها',
      items: [
        { href: '/customers', label: 'مشتریان', icon: <Users size={20} /> },
        { href: '/suppliers', label: 'تامین‌کنندگان', icon: <Truck size={20} /> },
        {
          href: '/projects',
          label: 'پروژه‌ها',
          icon: <FolderKanban size={20} />,
          roles: ['ADMIN', 'MANAGER', 'USER'],
        },
        {
          href: '/work-reports',
          label: 'گزارش کار',
          icon: <ClipboardList size={20} />,
          roles: ['ADMIN', 'MANAGER', 'USER'],
          badge: pendingWorkReports && pendingWorkReports > 0 ? pendingWorkReports : undefined,
        },
        {
          href: '/contractor-docs',
          label: 'مستندات پیمانکار',
          icon: <FileImage size={20} />,
          roles: ['ADMIN', 'MANAGER', 'USER'],
          badge: pendingContractorDocs && pendingContractorDocs > 0 ? pendingContractorDocs : undefined,
        },
      ],
    },
    {
      label: 'سامانه خرید',
      items: [
        { href: '/purchases', label: 'درخواست‌های خرید', icon: <ShoppingCart size={20} />,
          badge: pendingPurchases && pendingPurchases > 0 ? pendingPurchases : undefined,
        },
      ],
    },
    {
      label: 'کارفرمایان',
      items: [
        { href: '/employers', label: 'مدیریت تیکت‌ها', icon: <Building2 size={20} /> },
      ],
    },
    {
      label: 'تنظیمات و سیستم',
      items: [
        { href: '/users', label: 'کاربران', icon: <UserCog size={20} />, roles: ['MANAGER'] },
        { href: '/settings/sip', label: 'تنظیمات SIP', icon: <Phone size={20} /> },
        { href: '/backup', label: 'بکاپ', icon: <Database size={20} /> },
      ],
    },
  ];

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.roles || item.roles.includes(role)),
    }))
    .filter((group) => group.items.length > 0);

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <>
      {/* Logo / Header */}
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
        {!collapsed && (
          <Link href="/dashboard" className="text-lg font-bold text-gray-800 truncate">
            مدیریت فاکتور
          </Link>
        )}
        <Tooltip content={collapsed ? 'باز کردن منو' : 'بستن منو'} position="left">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label={collapsed ? 'باز کردن منو' : 'بستن منو'}
          >
            {collapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </Tooltip>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {visibleGroups.map((group, groupIndex) => {
          const isCollapsible = group.label !== '';
          const isGroupExpanded = !isCollapsible || expandedGroups[group.label] || group.items.some((item) => isActive(item.href));
          return (
            <div key={group.label || `group-${groupIndex}`} className={groupIndex > 0 ? 'mt-2' : ''}>
              {isCollapsible && !collapsed && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="flex w-full items-center justify-between mb-1 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${isGroupExpanded ? 'rotate-0' : '-rotate-90'}`}
                  />
                </button>
              )}
              {collapsed && groupIndex > 0 && (
                <div className="mb-2 border-t border-gray-200" />
              )}
              <div
                className={`space-y-1 overflow-hidden transition-all duration-200 ${
                  isGroupExpanded ? 'max-h-96 opacity-100' : collapsed ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
                        ${active
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }
                        ${collapsed ? 'justify-center' : ''}
                      `}
                      title={collapsed ? item.label : undefined}
                    >
                      <span className={`shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`}>
                        {item.icon}
                      </span>
                      {!collapsed && <span>{item.label}</span>}
                      {!collapsed && item.badge && (
                        <span className="mr-auto rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                          {item.badge > 9 ? '۹+' : item.badge}
                        </span>
                      )}
                      {collapsed && item.badge && (
                        <span className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-red-500" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User & Logout */}
      <div className="border-t border-gray-200 px-3 py-3">
        {!collapsed && (
          <div className="mb-2 px-3">
            <p className="truncate text-sm font-medium text-gray-800">{session.user.name}</p>
            <p className="text-xs text-gray-500">
              {role === 'ADMIN' ? 'مدیر پروژه' : role === 'MANAGER' ? 'مسئول' : role === 'CONTRACTOR' ? 'پیمانکار' : role === 'TECHNICAL' ? 'فنی' : role === 'EMPLOYER' ? 'کارفرما' : 'کاربر'}
            </p>
          </div>
        )}
        <button
          onClick={async () => { await signOut({ redirect: false }); window.location.href = '/login'; }}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors
            ${collapsed ? 'justify-center' : ''}
          `}
          title={collapsed ? 'خروج' : undefined}
        >
          <LogOut size={20} />
          {!collapsed && <span>خروج</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed top-0 right-0 left-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
          aria-label="باز کردن منو"
        >
          <Menu size={22} />
        </button>
        <span className="text-sm font-bold text-gray-800">مدیریت فاکتور</span>
        <div className="flex items-center gap-2">
          <GlobalSearch />
          <SipStatusIndicator />
          <NotificationBell />
          <ThemeToggle />
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed top-0 right-0 z-50 flex h-full w-64 flex-col bg-white shadow-xl transition-transform duration-200 lg:hidden
          ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="flex h-14 items-center justify-between border-b border-gray-200 px-4">
          <span className="text-lg font-bold text-gray-800">منو</span>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="بستن منو"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {visibleGroups.map((group, groupIndex) => {
            const isCollapsible = group.label !== '';
            const isGroupExpanded = !isCollapsible || expandedGroups[group.label] || group.items.some((item) => isActive(item.href));
            return (
              <div key={group.label || `group-${groupIndex}`} className={groupIndex > 0 ? 'mt-2' : ''}>
                {isCollapsible && (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="flex w-full items-center justify-between mb-1 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <span>{group.label}</span>
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-200 ${isGroupExpanded ? 'rotate-0' : '-rotate-90'}`}
                    />
                  </button>
                )}
                <div
                  className={`space-y-1 overflow-hidden transition-all duration-200 ${
                    isGroupExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  {group.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
                          ${active
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                          }
                        `}
                      >
                        <span className={`shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`}>
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                        {item.badge && (
                          <span className="mr-auto rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                            {item.badge > 9 ? '۹+' : item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="border-t border-gray-200 px-3 py-3">
          <div className="mb-2 px-3">
            <p className="truncate text-sm font-medium text-gray-800">{session.user.name}</p>
            <p className="text-xs text-gray-500">
              {role === 'ADMIN' ? 'مدیر پروژه' : role === 'MANAGER' ? 'مسئول' : role === 'CONTRACTOR' ? 'پیمانکار' : role === 'TECHNICAL' ? 'فنی' : role === 'EMPLOYER' ? 'کارفرما' : 'کاربر'}
            </p>
          </div>
          <button
            onClick={async () => { await signOut({ redirect: false }); window.location.href = '/login'; }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut size={20} />
            <span>خروج</span>
          </button>
        </div>
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={`fixed top-0 right-0 z-30 hidden h-screen flex-col border-l border-gray-200 bg-white transition-all duration-200 lg:flex
          ${collapsed ? 'w-[68px]' : 'w-60'}
        `}
      >
        {sidebarContent}
      </aside>

      {/* Desktop top bar (search, notifications, theme) */}
      <div
        className={`fixed top-0 z-20 hidden h-14 items-center justify-end gap-3 border-b border-gray-200 bg-white px-6 lg:flex transition-all duration-200
          ${collapsed ? 'right-[68px] left-0' : 'right-60 left-0'}
        `}
      >
        <GlobalSearch />
        <SipStatusIndicator />
        <NotificationBell />
        <ThemeToggle />
      </div>
    </>
  );
}
