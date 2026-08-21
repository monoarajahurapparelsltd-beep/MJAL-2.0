import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Search,
  Bell
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { ThemeToggle } from '../common/ThemeToggle';

interface TopNavProps {
  onToggleMobileSidebar: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({ onToggleMobileSidebar }) => {
  const {
    setIsSearchOpen,
    notifications,
    unreadNotificationCount,
    markNotificationRead
  } = useERP();

  const [isNotifPopoverOpen, setIsNotifPopoverOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close notifications when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <header className="flex-shrink-0 flex h-13 w-full items-center justify-between border-b border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 sm:px-4 shadow-2xs z-30 transition-colors">
      {/* Left side */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={onToggleMobileSidebar}
          className="rounded-lg p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden cursor-pointer transition-colors"
          title="Open Menu"
          aria-label="Open Menu"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>

        {/* Global Search Bar Trigger */}
        <button
          onClick={() => setIsSearchOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800/80 px-3 py-1.5 text-[11px] text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-750 transition-all w-44 sm:w-72 lg:w-80 cursor-pointer shadow-2xs group"
        >
          <Search className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 group-hover:text-blue-500 transition-colors" />
          <span className="truncate">Search Buyers, Styles, POs, Lines...</span>
          <kbd className="hidden sm:inline-flex ml-auto items-center rounded-md bg-white dark:bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 shadow-2xs">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Theme Toggle (One-Click Light / Dark Switcher) */}
        <ThemeToggle size="md" variant="button" />

        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifPopoverOpen(!isNotifPopoverOpen)}
            className="relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-800/90 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer shadow-2xs"
            title="Notifications"
          >
            <Bell className="h-3.5 w-3.5" />
            {unreadNotificationCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-black text-white ring-2 ring-white dark:ring-slate-900 animate-pulse">
                {unreadNotificationCount}
              </span>
            )}
          </button>

          {/* Notifications Popover */}
          {isNotifPopoverOpen && (
            <div 
              id="notifications-popover-panel"
              className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl p-3.5 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 z-[100] animate-fade-in"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  <div className="p-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Factory Alerts & Notifications</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Live operational updates</p>
                  </div>
                </div>
                {unreadNotificationCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    {unreadNotificationCount} new
                  </span>
                )}
              </div>

              <div className="mt-2 max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 pr-0.5">
                {notifications.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                    <p className="font-medium">No active alerts</p>
                    <p className="text-[10px] mt-0.5">All production lines & transfers are running smooth</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => markNotificationRead(n.id)}
                      className={`p-2.5 rounded-xl text-xs cursor-pointer transition-colors ${
                        n.read
                          ? 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          : 'bg-blue-50/70 dark:bg-blue-950/40 text-slate-900 dark:text-slate-100 font-medium hover:bg-blue-50 dark:hover:bg-blue-950/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-[11px]">{n.title}</span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500">{n.timestamp}</span>
                      </div>
                      <p className="mt-1 text-slate-600 dark:text-slate-300 text-[10px] leading-relaxed">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
