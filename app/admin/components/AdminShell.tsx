'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  Airplay,
  BarChart3,
  BookOpen,
  HelpCircle,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';

export type AdminSection = 'courses' | 'export' | 'rooms' | 'account' | 'faq';

export interface AdminShellPlanInfo {
  subscription: {
    plan: 'free' | 'paid' | 'enterprise';
    status: 'active' | 'cancelled' | 'past_due' | 'incomplete';
    currentPeriodEnd?: string;
  };
  usage: { formCount: number; roomCount: number };
  limits: { maxForms: number; maxRooms: number };
}

const ADMIN_SHELL_PLAN_INFO_STORAGE_KEY = 'admin-shell-plan-info';

export function readCachedAdminShellPlanInfo(): AdminShellPlanInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(ADMIN_SHELL_PLAN_INFO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminShellPlanInfo;
    if (!parsed?.subscription || !parsed?.usage || !parsed?.limits) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedAdminShellPlanInfo(planInfo: AdminShellPlanInfo | null | undefined) {
  if (typeof window === 'undefined' || !planInfo) return;
  try {
    window.sessionStorage.setItem(ADMIN_SHELL_PLAN_INFO_STORAGE_KEY, JSON.stringify(planInfo));
  } catch {
    // ignore
  }
}

interface AdminShellProps {
  activeSection: AdminSection;
  planInfo?: AdminShellPlanInfo | null;
  formCount?: number;
  roomCount?: number;
  onSelectInPageSection?: (section: 'courses' | 'export' | 'rooms') => void;
  children: React.ReactNode;
}

const MENU_ITEMS: Array<{
  key: AdminSection;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  activeBg: string;
  inPage: boolean;
  href?: string;
  external?: boolean;
}> = [
  {
    key: 'courses',
    label: 'フォーム管理',
    description: 'フォーム作成・管理',
    icon: BookOpen,
    iconBg: 'bg-[#ebf3ff]',
    iconColor: 'text-[#2864f0]',
    activeBg: 'bg-[#dce8ff] text-[#23418c]',
    inPage: true,
  },
  {
    key: 'rooms',
    label: 'ルーム管理',
    description: 'Q&A / ワーク機能',
    icon: Airplay,
    iconBg: 'bg-[#ebf3ff]',
    iconColor: 'text-[#2864f0]',
    activeBg: 'bg-[#dce8ff] text-[#23418c]',
    inPage: true,
  },
  {
    key: 'export',
    label: 'データ出力',
    description: 'CSV / JSON エクスポート',
    icon: BarChart3,
    iconBg: 'bg-[#ebf3ff]',
    iconColor: 'text-[#2864f0]',
    activeBg: 'bg-[#dce8ff] text-[#23418c]',
    inPage: true,
  },
  {
    key: 'account',
    label: 'アカウント設定',
    description: 'プラン・請求情報',
    icon: Settings,
    iconBg: 'bg-[#ebf3ff]',
    iconColor: 'text-[#2864f0]',
    activeBg: 'bg-[#dce8ff] text-[#23418c]',
    inPage: false,
  },
  {
    key: 'faq',
    label: 'FAQ',
    description: 'よくある質問',
    icon: HelpCircle,
    iconBg: 'bg-[#ebf3ff]',
    iconColor: 'text-[#2864f0]',
    activeBg: 'bg-[#dce8ff] text-[#23418c]',
    inPage: false,
    href: '/admin/faq',
  },
];

const planLabel = (plan?: 'free' | 'paid' | 'enterprise') =>
  plan === 'enterprise' ? 'Enterprise' : plan === 'paid' ? 'Pro' : 'Free';

const formatLimit = (limit?: number | null) => {
  if (limit === undefined || limit === null) return '∞';
  return limit === Infinity ? '∞' : String(limit);
};

interface SidebarContentProps extends AdminShellProps {
  onAfterNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  showCollapseToggle?: boolean;
}

function SidebarContent({
  activeSection,
  planInfo,
  formCount,
  roomCount,
  onSelectInPageSection,
  onAfterNavigate,
  collapsed = false,
  onToggleCollapsed,
  showCollapseToggle = false,
}: SidebarContentProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [cachedPlanInfo, setCachedPlanInfo] = useState<AdminShellPlanInfo | null>(null);

  useEffect(() => {
    setCachedPlanInfo(readCachedAdminShellPlanInfo());
  }, []);

  useEffect(() => {
    if (!planInfo) return;
    writeCachedAdminShellPlanInfo(planInfo);
    setCachedPlanInfo(planInfo);
  }, [planInfo]);

  const handleSelect = (item: typeof MENU_ITEMS[number]) => {
    const { key, inPage, href } = item;
    if (key === activeSection) {
      onAfterNavigate?.();
      return;
    }
    if (inPage) {
      if (onSelectInPageSection && (key === 'courses' || key === 'export' || key === 'rooms')) {
        onSelectInPageSection(key);
      } else {
        router.push(`/admin?section=${key}`);
      }
    } else if (href) {
      router.push(href);
    } else if (key === 'account') {
      router.push('/admin/account');
    }
    onAfterNavigate?.();
  };

  const displayPlanInfo = planInfo ?? cachedPlanInfo;
  const subscription = displayPlanInfo?.subscription;
  const usage = displayPlanInfo?.usage;
  const limits = displayPlanInfo?.limits;
  const displayPlan = planLabel(subscription?.plan);
  const planClasses =
    subscription?.plan === 'enterprise'
      ? 'bg-slate-900 text-white ring-slate-900/40'
      : subscription?.plan === 'paid'
      ? 'bg-gradient-to-br from-indigo-600 to-blue-700 text-white ring-indigo-700/30'
      : 'bg-white text-slate-900 ring-black/5';

  const isUnlimited = (limit?: number | null) =>
    limit === undefined || limit === null || limit === Infinity;
  const showFormLimit = !isUnlimited(limits?.maxForms);
  const showRoomLimit = !isUnlimited(limits?.maxRooms);

  return (
    <div className="flex h-full flex-col bg-[#f3f7ff]">
      {/* Brand + collapse toggle */}
      <div
        className={`flex items-center border-b border-[#dce8ff] ${
          collapsed ? 'justify-center px-2 py-3' : 'justify-between px-4 py-3 gap-2'
        }`}
      >
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity min-w-0">
            <Image
              src="https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png"
              alt="ざせきくん"
              width={32}
              height={32}
              className="rounded-lg shrink-0"
            />
            <span className="text-sm font-bold text-[#323232] tracking-tight truncate">ざせきくん</span>
          </Link>
        )}
        {collapsed && (
          <Link href="/" className="hover:opacity-80 transition-opacity" aria-label="ホームへ">
            <Image
              src="https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png"
              alt="ざせきくん"
              width={28}
              height={28}
              className="rounded-md"
            />
          </Link>
        )}
        {showCollapseToggle && onToggleCollapsed && !collapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="h-8 w-8 rounded-md inline-flex items-center justify-center text-[#2864f0] hover:bg-[#dce8ff] transition-colors shrink-0"
            aria-label="サイドバーを閉じる"
            title="サイドバーを閉じる"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {showCollapseToggle && onToggleCollapsed && collapsed && (
        <div className="px-2 py-2 border-b border-[#dce8ff] flex justify-center">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="h-8 w-8 rounded-md inline-flex items-center justify-center text-[#2864f0] hover:bg-[#dce8ff] transition-colors"
            aria-label="サイドバーを開く"
            title="サイドバーを開く"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI */}
      {!collapsed ? (
        <div className="px-4 py-4 space-y-2 border-b border-[#dce8ff]">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-lg ring-1 ring-[#dce8ff] p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#8c8989]">
                <BookOpen className="h-4 w-4 text-[#2864f0]" />
                フォーム
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-base font-extrabold text-[#323232] tabular-nums">
                  {formCount ?? usage?.formCount ?? 0}
                </span>
                {showFormLimit && (
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    / {formatLimit(limits?.maxForms)}
                  </span>
                )}
              </div>
            </div>
            <div className="bg-white rounded-lg ring-1 ring-[#dce8ff] p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#8c8989]">
                <Airplay className="h-4 w-4 text-[#2864f0]" />
                ルーム
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-base font-extrabold text-[#323232] tabular-nums">
                  {roomCount ?? usage?.roomCount ?? 0}
                </span>
                {showRoomLimit && (
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    / {formatLimit(limits?.maxRooms)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className={`rounded-lg ring-1 p-2.5 ${planClasses}`}>
            <div
              className={`flex items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase ${
                subscription?.plan === 'paid' || subscription?.plan === 'enterprise'
                  ? 'text-white/70'
                  : 'text-slate-400'
              }`}
            >
              <Sparkles
                className={`h-3 w-3 ${
                  subscription?.plan === 'paid' || subscription?.plan === 'enterprise'
                    ? 'text-white'
                    : 'text-emerald-500'
                }`}
              />
              プラン
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-extrabold tabular-nums">{displayPlan}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-2 py-3 space-y-2 border-b border-slate-100 flex flex-col items-center">
          <div
            className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex flex-col items-center justify-center"
            title={
              showFormLimit
                ? `フォーム: ${formCount ?? usage?.formCount ?? 0} / ${formatLimit(limits?.maxForms)}`
                : `フォーム: ${formCount ?? usage?.formCount ?? 0}`
            }
          >
            <span className="text-[9px] font-semibold leading-none">フォーム</span>
            <span className="text-xs font-extrabold leading-none mt-0.5 tabular-nums">
              {formCount ?? usage?.formCount ?? 0}
            </span>
          </div>
          <div
            className="w-10 h-10 rounded-lg bg-[#e8f7ee] text-[#00963c] flex flex-col items-center justify-center"
            title={
              showRoomLimit
                ? `ルーム: ${roomCount ?? usage?.roomCount ?? 0} / ${formatLimit(limits?.maxRooms)}`
                : `ルーム: ${roomCount ?? usage?.roomCount ?? 0}`
            }
          >
            <span className="text-[9px] font-semibold leading-none">ルーム</span>
            <span className="text-xs font-extrabold leading-none mt-0.5 tabular-nums">
              {roomCount ?? usage?.roomCount ?? 0}
            </span>
          </div>
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              subscription?.plan === 'enterprise'
                ? 'bg-slate-900 text-white'
                : subscription?.plan === 'paid'
                ? 'bg-gradient-to-br from-indigo-600 to-blue-700 text-white'
                : 'bg-emerald-50 text-emerald-600'
            }`}
            title={`プラン: ${displayPlan}`}
          >
            <Sparkles className="h-4 w-4" />
          </div>
        </div>
      )}

      {/* Menu */}
      <nav className={`flex-1 overflow-y-auto py-4 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === activeSection;
          if (collapsed) {
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleSelect(item)}
                title={item.label}
                aria-label={item.label}
                className={`w-full flex items-center justify-center p-2 rounded-xl transition-colors ${
                  isActive ? `${item.activeBg}` : 'text-[#323232] hover:bg-[#dce8ff]/60'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    isActive ? 'bg-white text-[#2864f0]' : `${item.iconBg} ${item.iconColor}`
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
              </button>
            );
          }
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleSelect(item)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                isActive
                  ? `${item.activeBg}`
                  : 'text-[#323232] hover:bg-[#dce8ff]/60'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-white text-[#2864f0]' : `${item.iconBg} ${item.iconColor}`
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-none">{item.label}</p>
                <p
                  className={`mt-1 text-[11px] leading-none truncate ${
                    isActive ? 'text-[#595959]' : 'text-[#8c8989]'
                  }`}
                >
                  {item.description}
                </p>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Footer: user + logout */}
      <div
        className={`border-t border-[#dce8ff] py-3 space-y-2 ${
          collapsed ? 'px-2 flex flex-col items-center' : 'px-4'
        }`}
      >
        {session?.user && !collapsed && (
          <div className="flex items-center gap-2 px-1">
            <div className="w-8 h-8 rounded-full bg-[#2864f0] flex items-center justify-center text-white text-xs font-medium shrink-0">
              {session.user.name?.charAt(0) || session.user.email?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#323232] truncate">{session.user.name}</p>
              <p className="text-[10px] text-[#595959] truncate">{session.user.email}</p>
            </div>
          </div>
        )}
        {session?.user && collapsed && (
          <div
            className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-xs font-medium"
            title={session.user.email || ''}
          >
            {session.user.name?.charAt(0) || session.user.email?.charAt(0) || 'U'}
          </div>
        )}
        {collapsed ? (
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/admin/login' })}
            title="ログアウト"
            aria-label="ログアウト"
            className="h-9 w-9 inline-flex items-center justify-center rounded-md text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => signOut({ callbackUrl: '/admin/login' })}
            className="w-full h-9 text-sm border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5 text-red-600" />
            ログアウト
          </Button>
        )}
      </div>
    </div>
  );
}

const SIDEBAR_COLLAPSED_KEY = 'admin-sidebar-collapsed';

export default function AdminShell(props: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (saved === '1') setCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex shrink-0 border-r border-[#dce8ff] bg-[#f3f7ff] sticky top-0 h-screen transition-[width] duration-200 ease-out ${
          collapsed ? 'w-16' : 'w-72'
        }`}
      >
        <div className="w-full">
          <SidebarContent
            {...props}
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
            showCollapseToggle
          />
        </div>
      </aside>

      {/* Mobile header + drawer */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200/60">
        <div className="px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Image
              src="https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png"
              alt="ざせきくん"
              width={28}
              height={28}
              className="rounded-md"
            />
            <span className="text-sm font-semibold text-slate-900 tracking-tight">ざせきくん</span>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileOpen(true)}
            className="h-9 w-9 p-0"
            aria-label="メニューを開く"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-80 sm:max-w-sm">
          <div className="h-full flex flex-col">
            <SidebarContent {...props} onAfterNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {props.children}
        </motion.div>
        <footer className="max-w-6xl mx-auto px-4 sm:px-6 py-6 mt-2">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
            <span>Powered by Supabase</span>
            <Link href="/legal/tokusho" target="_blank" className="hover:text-slate-600 transition-colors">
              特定商取引法に基づく表記
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
