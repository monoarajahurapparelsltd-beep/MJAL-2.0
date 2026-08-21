import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, ChevronDown, Check } from 'lucide-react';
import { useTheme, Theme } from '../../context/ThemeContext';

interface ThemeToggleProps {
  variant?: 'button' | 'dropdown' | 'segmented';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'button',
  size = 'md',
  showLabel = false,
  className = ''
}) => {
  const { theme, resolvedTheme, setTheme, toggleTheme, isDark } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  const sizeClasses = {
    sm: 'h-7 px-2 text-xs gap-1.5',
    md: 'h-8 px-2.5 text-xs gap-2',
    lg: 'h-9 px-3 text-sm gap-2.5'
  };

  const iconSizes = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-4.5 w-4.5'
  };

  // 1. Simple One-Click Toggle Button
  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`relative inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${sizeClasses[size]} ${className}`}
        title={isDark ? 'Switch to Light Mode (Currently Dark)' : 'Switch to Dark Mode (Currently Light)'}
        aria-label="Toggle Theme"
      >
        <div className="relative flex items-center justify-center">
          {isDark ? (
            <Moon className={`${iconSizes[size]} text-indigo-400 transition-transform duration-300 rotate-0`} />
          ) : (
            <Sun className={`${iconSizes[size]} text-amber-500 transition-transform duration-300 rotate-0`} />
          )}
        </div>
        {showLabel && (
          <span className="font-semibold text-xs capitalize font-sans">
            {isDark ? 'Dark Mode' : 'Light Mode'}
          </span>
        )}
      </button>
    );
  }

  // 2. Segmented Pill Switcher (Light / System / Dark)
  if (variant === 'segmented') {
    const options: { id: Theme; label: string; icon: React.ElementType }[] = [
      { id: 'light', label: 'Light', icon: Sun },
      { id: 'system', label: 'Auto', icon: Monitor },
      { id: 'dark', label: 'Dark', icon: Moon }
    ];

    return (
      <div className={`inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 ${className}`}>
        {options.map(opt => {
          const Icon = opt.icon;
          const isActive = theme === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTheme(opt.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs ring-1 ring-black/5 dark:ring-white/10'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {showLabel && <span>{opt.label}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  // 3. Dropdown Selector
  const currentIcon = theme === 'system' ? Monitor : isDark ? Moon : Sun;
  const CurrentIconComp = currentIcon;

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsDropdownOpen(prev => !prev)}
        className={`inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80 shadow-2xs transition-all cursor-pointer ${sizeClasses[size]}`}
        aria-expanded={isDropdownOpen}
      >
        <CurrentIconComp
          className={`${iconSizes[size]} ${
            theme === 'system'
              ? 'text-slate-500 dark:text-slate-400'
              : isDark
              ? 'text-indigo-400'
              : 'text-amber-500'
          }`}
        />
        {showLabel && (
          <span className="font-semibold text-xs capitalize font-sans">
            {theme === 'system' ? 'System' : isDark ? 'Dark' : 'Light'}
          </span>
        )}
        <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500 ml-0.5" />
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 mt-1.5 w-36 rounded-xl border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-slate-900 p-1 shadow-xl z-50 animate-fade-in text-xs">
          <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Display Theme
          </div>

          <button
            type="button"
            onClick={() => {
              setTheme('light');
              setIsDropdownOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
              theme === 'light'
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-bold'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sun className="h-3.5 w-3.5 text-amber-500" />
              <span>Light Mode</span>
            </div>
            {theme === 'light' && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme('dark');
              setIsDropdownOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
              theme === 'dark'
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-bold'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Moon className="h-3.5 w-3.5 text-indigo-400" />
              <span>Dark Mode</span>
            </div>
            {theme === 'dark' && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme('system');
              setIsDropdownOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
              theme === 'system'
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-bold'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Monitor className="h-3.5 w-3.5 text-slate-400" />
              <span>System Auto</span>
            </div>
            {theme === 'system' && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
          </button>
        </div>
      )}
    </div>
  );
};
