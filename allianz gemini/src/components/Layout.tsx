import { type ReactNode, useState, useEffect, useCallback } from 'react';
import type { NavSection } from '@/types';
import { cn } from '@/utils/cn';
import {
  LayoutDashboard,
  Calculator,
  GitCompareArrows,
  BarChart3,
  FileText,
  Settings,
  Leaf,
  Menu,
  X,
  FlaskConical,
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
}

const NAV_ITEMS: { id: NavSection; label: string; shortLabel: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Dashboard', icon: LayoutDashboard },
  { id: 'calculator', label: 'Footprint Calculator', shortLabel: 'Calculator', icon: Calculator },
  { id: 'comparison', label: 'Model Comparison', shortLabel: 'Compare', icon: GitCompareArrows },
  { id: 'scenarios', label: 'Scenario Simulator', shortLabel: 'Scenarios', icon: FlaskConical },
  { id: 'analytics', label: 'Analytics', shortLabel: 'Analytics', icon: BarChart3 },
  { id: 'reports', label: 'ESG Reports', shortLabel: 'Reports', icon: FileText },
  { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
];

const BOTTOM_NAV_IDS: NavSection[] = ['dashboard', 'calculator', 'scenarios', 'analytics'];
const DRAWER_ONLY_IDS: NavSection[] = ['comparison', 'reports', 'settings'];

export function Layout({ children, activeSection, onNavigate }: LayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleNav = useCallback((section: NavSection) => {
    onNavigate(section);
    setDrawerOpen(false);
  }, [onNavigate]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-slate-200 bg-white flex-shrink-0">
        <div className="flex h-14 items-center gap-2.5 border-b border-slate-200 px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 flex-shrink-0">
            <Leaf className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[13px] font-semibold text-slate-800 truncate leading-tight">Green-AI Footprint</h1>
            <p className="text-[10px] text-slate-400 leading-tight">ESG Platform</p>
          </div>
        </div>

        <nav className="flex-1 py-2 px-2">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleNav(id)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors',
                activeSection === id
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        <div className="border-t border-slate-200 px-4 py-3">
          <p className="text-[10px] text-slate-400 text-center">
            v1.0.0-poc · Calculations auditable
          </p>
        </div>
      </aside>

      {/* Mobile Header + Content */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex lg:hidden h-12 items-center justify-between border-b border-slate-200 bg-white px-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-800 flex-shrink-0">
              <Leaf className="h-3 w-3 text-white" />
            </div>
            <h1 className="text-[13px] font-semibold text-slate-800">Green-AI Footprint</h1>
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 active:bg-slate-200"
            aria-label="Open menu"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="mx-auto max-w-7xl p-4 sm:p-5 lg:p-6">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex lg:hidden border-t border-slate-200 bg-white safe-area-bottom">
          {BOTTOM_NAV_IDS.map((id) => {
            const item = NAV_ITEMS.find((n) => n.id === id)!;
            const Icon = item.icon;
            return (
              <button
                key={id}
                onClick={() => handleNav(id)}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center py-2 pt-2.5 gap-0.5 transition-colors min-h-[52px]',
                  activeSection === id
                    ? 'text-slate-900'
                    : 'text-slate-400'
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="text-[10px] font-medium">{item.shortLabel}</span>
              </button>
            );
          })}
          <button
            onClick={() => setDrawerOpen(true)}
            className={cn(
              'flex flex-1 flex-col items-center justify-center py-2 pt-2.5 gap-0.5 transition-colors min-h-[52px]',
              DRAWER_ONLY_IDS.includes(activeSection)
                ? 'text-slate-900'
                : 'text-slate-400'
            )}
          >
            <Menu className="h-[18px] w-[18px]" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </nav>
      </div>

      {/* Mobile Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-64 max-w-[80vw] bg-white shadow-lg flex flex-col animate-slide-in">
            <div className="flex h-12 items-center justify-between border-b border-slate-200 px-4">
              <span className="text-[13px] font-semibold text-slate-800">Menu</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                aria-label="Close menu"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <nav className="flex-1 py-2 px-2 overflow-y-auto">
              {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => handleNav(id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-medium transition-colors',
                    activeSection === id
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {label}
                </button>
              ))}
            </nav>
            <div className="border-t border-slate-200 px-4 py-3">
              <p className="text-[10px] text-slate-400 text-center">
                v1.0.0-poc · Calculations auditable
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
