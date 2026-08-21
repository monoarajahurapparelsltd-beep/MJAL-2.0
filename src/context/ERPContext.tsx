import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabaseDataService } from '../services/supabaseDataService';
import { OrderStyle, SewingProduction, Employee, NotificationItem, InterDeptTransfer } from '../types';

interface ERPContextType {
  activeModule: string;
  setActiveModule: (module: string) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  isAuditOpen: boolean;
  setIsAuditOpen: (open: boolean) => void;
  isSetupOpen: boolean;
  setIsSetupOpen: (open: boolean) => void;
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  markNotificationRead: (id: string) => void;
  transfers: InterDeptTransfer[];
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;
  searchResults: {
    orders: OrderStyle[];
    sewing: SewingProduction[];
    employees: Employee[];
  };
  refreshData: () => void;
}

const ERPContext = createContext<ERPContextType | undefined>(undefined);

export const ERPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeModule, setActiveModule] = useState<string>('dashboard');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isAuditOpen, setIsAuditOpen] = useState<boolean>(false);
  const [isSetupOpen, setIsSetupOpen] = useState<boolean>(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [notifications, setNotifications] = useState<NotificationItem[]>(supabaseDataService.getNotifications());
  const [transfers, setTransfers] = useState<InterDeptTransfer[]>(supabaseDataService.getTransfers());
  const [, setDataVersion] = useState<number>(0);

  useEffect(() => {
    const unsub = supabaseDataService.subscribe(() => {
      setNotifications([...supabaseDataService.getNotifications()]);
      setTransfers([...supabaseDataService.getTransfers()]);
      setDataVersion(prev => prev + 1);
    });
    return unsub;
  }, []);

  const refreshData = () => {
    supabaseDataService.initializeFromSupabase();
    setDataVersion(prev => prev + 1);
  };

  const markNotificationRead = (id: string) => {
    supabaseDataService.markNotificationRead(id);
    setNotifications([...supabaseDataService.getNotifications()]);
  };

  const unreadNotificationCount = notifications.filter(n => !n.read).length;

  // Perform global search on Supabase records
  const query = (globalSearchQuery || '').trim().toLowerCase();
  const searchResults = {
    orders: query
      ? supabaseDataService.getOrders().filter(o =>
          (o.styleNo || '').toLowerCase().includes(query) ||
          (o.styleName || '').toLowerCase().includes(query) ||
          (o.buyer || '').toLowerCase().includes(query) ||
          (o.purchaseOrders || []).some(p => (p.poNo || '').toLowerCase().includes(query))
        )
      : [],
    sewing: query
      ? supabaseDataService.getSewingProduction().filter(s =>
          (s.styleNo || '').toLowerCase().includes(query) ||
          (s.poNo || '').toLowerCase().includes(query) ||
          (s.lineNo || '').toLowerCase().includes(query) ||
          (s.colour || '').toLowerCase().includes(query)
        )
      : [],
    employees: query
      ? supabaseDataService.getEmployees().filter(e =>
          (e.name || '').toLowerCase().includes(query) ||
          (e.empId || '').toLowerCase().includes(query) ||
          (e.department || '').toLowerCase().includes(query)
        )
      : []
  };

  return (
    <ERPContext.Provider
      value={{
        activeModule,
        setActiveModule,
        isSearchOpen,
        setIsSearchOpen,
        isAuditOpen,
        setIsAuditOpen,
        isSetupOpen,
        setIsSetupOpen,
        notifications,
        unreadNotificationCount,
        markNotificationRead,
        transfers,
        globalSearchQuery,
        setGlobalSearchQuery,
        searchResults,
        refreshData
      }}
    >
      {children}
    </ERPContext.Provider>
  );
};

export const useERP = () => {
  const context = useContext(ERPContext);
  if (!context) throw new Error('useERP must be used within an ERPProvider');
  return context;
};
