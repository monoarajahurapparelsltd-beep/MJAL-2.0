import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  User,
  OrderStyle,
  PurchaseOrder,
  ColourQty,
  BOMItem,
  TACalendarTask,
  SampleRecord,
  StoreStockItem,
  StoreTransaction,
  CuttingEntry,
  SewingLine,
  SewingTarget,
  SewingProduction,
  WashingRecord,
  FinishingRecord,
  QCInspection,
  PackingRecord,
  ShipmentRecord,
  ReadyShipmentBatch,
  ReadyShipmentSizeItem,
  SizeProgressItem,
  Employee,
  AttendanceRecord,
  PayrollRecord,
  AuditLog,
  NotificationItem,
  MasterDataItem,
  InterDeptTransfer,
  Department,
  Permission,
  Role,
  OrderStatus
} from '../types';
import { getDepartmentReceivedSizeMap, splitMultipleValues, matchesCandidateOrList, normalizeSizeName } from '../utils/sewingCalculationUtils';
import { calculateSizeWiseAllowance } from '../utils/allowanceUtils';
import { defaultMasterData, parseSizeMatrixDescription } from './defaultMasterData';
import { globalToast } from '../context/ToastContext';
import { supabaseLogger } from '../utils/supabaseLogger';
import { validateDepartmentTransfer } from '../utils/transferValidationUtils';

// Helper to generate a standard RFC4122 UUID v4
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function ensureValidUUID(id?: string): string {
  if (!id) return generateUUID();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id;
  return generateUUID();
}

export function toIsoDateString(val?: string | null): string {
  if (!val) return new Date().toISOString().substring(0, 10);
  const trimmed = String(val).trim();
  if (!trimmed) return new Date().toISOString().substring(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString().substring(0, 10);
  }
  return new Date().toISOString().substring(0, 10);
}

// Full default permissions
export const fullPermissions: Record<Department, Permission[]> = {
  'HR & Admin': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
  'Store': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
  'Merchandising': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
  'Sample': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
  'Order Management': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
  'Cutting': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
  'Sewing': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
  'Washing': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
  'Finishing': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
  'QC': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
  'Packing': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
  'Shipment': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
  'Accounts/Finance': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
  'Production Planning': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
};

export const viewOnlyPermissions: Record<Department, Permission[]> = {
  'HR & Admin': ['VIEW', 'EXPORT', 'PRINT'],
  'Store': ['VIEW', 'EXPORT', 'PRINT'],
  'Merchandising': ['VIEW', 'EXPORT', 'PRINT'],
  'Sample': ['VIEW', 'EXPORT', 'PRINT'],
  'Order Management': ['VIEW', 'EXPORT', 'PRINT'],
  'Cutting': ['VIEW', 'EXPORT', 'PRINT'],
  'Sewing': ['VIEW', 'EXPORT', 'PRINT'],
  'Washing': ['VIEW', 'EXPORT', 'PRINT'],
  'Finishing': ['VIEW', 'EXPORT', 'PRINT'],
  'QC': ['VIEW', 'EXPORT', 'PRINT'],
  'Packing': ['VIEW', 'EXPORT', 'PRINT'],
  'Shipment': ['VIEW', 'EXPORT', 'PRINT'],
  'Accounts/Finance': ['VIEW', 'EXPORT', 'PRINT'],
  'Production Planning': ['VIEW', 'EXPORT', 'PRINT'],
};

export function generateDefaultPermissions(role: Role, department: Department): Record<Department, Permission[]> {
  const allDepts: Department[] = [
    'HR & Admin',
    'Store',
    'Merchandising',
    'Sample',
    'Order Management',
    'Cutting',
    'Sewing',
    'Washing',
    'Finishing',
    'QC',
    'Packing',
    'Shipment',
    'Accounts/Finance',
    'Production Planning'
  ];

  const fullPerms: Permission[] = ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'];
  const operationalPerms: Permission[] = ['VIEW', 'CREATE', 'EDIT', 'SUBMIT', 'EXPORT', 'PRINT'];
  const viewOnlyPerms: Permission[] = ['VIEW', 'EXPORT', 'PRINT'];

  const perms: Record<Department, Permission[]> = {} as any;

  if (role === 'SUPER_ADMIN') {
    allDepts.forEach(d => { perms[d] = [...fullPerms]; });
    return perms;
  }

  if (role === 'HR_ADMIN') {
    allDepts.forEach(d => {
      if (d === 'HR & Admin') perms[d] = [...fullPerms];
      else perms[d] = [...viewOnlyPerms];
    });
    return perms;
  }

  if (['MD', 'DIRECTOR', 'GM', 'Managing Director (MD)', 'Director', 'General Manager (GM)'].includes(role)) {
    allDepts.forEach(d => {
      perms[d] = (role === 'GM' || role === 'General Manager (GM)')
        ? ['VIEW', 'APPROVE', 'EXPORT', 'PRINT']
        : [...viewOnlyPerms];
    });
    return perms;
  }

  // Department users: full operational access to their own department, view-only to others
  allDepts.forEach(d => {
    if (d === department) {
      perms[d] = role === 'DEPT_USER' ? [...fullPerms] : [...operationalPerms];
    } else {
      perms[d] = [...viewOnlyPerms];
    }
  });

  return perms;
}

// Initial system users (Empty: real users are loaded purely from Supabase Database & Auth)
const initialSystemUsers: User[] = [];

// Helper to get and store permanently deleted users (tombstones)
const DELETED_USERS_KEY = 'mjal_erp_deleted_users_v2';

export const getDeletedUsersList = (): string[] => {
  try {
    const raw = localStorage.getItem(DELETED_USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(s => String(s).toLowerCase().trim());
    }
  } catch (e) {}
  return [];
};

export const markUserAsDeleted = (idOrEmail?: string) => {
  if (!idOrEmail) return;
  try {
    const current = getDeletedUsersList();
    const clean = idOrEmail.toLowerCase().trim();
    if (clean && !current.includes(clean)) {
      current.push(clean);
      localStorage.setItem(DELETED_USERS_KEY, JSON.stringify(current));
    }
  } catch (e) {}
};

export const isUserDeleted = (id?: string, email?: string, username?: string): boolean => {
  const deletedList = getDeletedUsersList();
  if (deletedList.length === 0) return false;
  if (id && deletedList.includes(id.toLowerCase().trim())) return true;
  if (email && deletedList.includes(email.toLowerCase().trim())) return true;
  if (username && deletedList.includes(username.toLowerCase().trim())) return true;
  return false;
};

// Initial Master Orders (Empty default - loaded directly from Supabase database)
const initialMasterOrders: OrderStyle[] = [];

const initialCuttingEntries: CuttingEntry[] = [];
const initialSewingLines: SewingLine[] = [];
const initialSewingTargets: SewingTarget[] = [];
const initialSewingProduction: SewingProduction[] = [];
const initialWashingRecords: WashingRecord[] = [];
const initialFinishingRecords: FinishingRecord[] = [];
const initialQCInspections: QCInspection[] = [];
const initialPackingRecords: PackingRecord[] = [];
const initialShipmentRecords: ShipmentRecord[] = [];
const initialBOMItems: BOMItem[] = [];
const initialTACalendar: TACalendarTask[] = [];
const initialSamples: SampleRecord[] = [];
const initialStoreStock: StoreStockItem[] = [];
const initialStoreTransactions: StoreTransaction[] = [];
const initialEmployees: Employee[] = [];
const initialAttendance: AttendanceRecord[] = [];
const initialPayroll: PayrollRecord[] = [];
const initialMasterData: MasterDataItem[] = defaultMasterData;
const initialInterDeptTransfers: InterDeptTransfer[] = [];

class SupabaseDataService {
  private cache: {
    users: User[];
    orders: OrderStyle[];
    bom: BOMItem[];
    taCalendar: TACalendarTask[];
    samples: SampleRecord[];
    storeStock: StoreStockItem[];
    storeTransactions: StoreTransaction[];
    cuttingEntries: CuttingEntry[];
    sewingLines: SewingLine[];
    sewingTargets: SewingTarget[];
    sewingProduction: SewingProduction[];
    washingRecords: WashingRecord[];
    finishingRecords: FinishingRecord[];
    qcInspections: QCInspection[];
    packingRecords: PackingRecord[];
    shipmentRecords: ShipmentRecord[];
    transfers: InterDeptTransfer[];
    employees: Employee[];
    attendance: AttendanceRecord[];
    payroll: PayrollRecord[];
    auditLogs: AuditLog[];
    notifications: NotificationItem[];
    masterData: MasterDataItem[];
  };

  private listeners: (() => void)[] = [];
  private isFetching: boolean = false;
  private isLoaded: boolean = false;
  private realtimeChannel: any = null;

  constructor() {
    this.cache = {
      users: initialSystemUsers,
      orders: initialMasterOrders,
      bom: initialBOMItems,
      taCalendar: initialTACalendar,
      samples: initialSamples,
      storeStock: initialStoreStock,
      storeTransactions: initialStoreTransactions,
      cuttingEntries: initialCuttingEntries,
      sewingLines: initialSewingLines,
      sewingTargets: initialSewingTargets,
      sewingProduction: initialSewingProduction,
      washingRecords: initialWashingRecords,
      finishingRecords: initialFinishingRecords,
      qcInspections: initialQCInspections,
      packingRecords: initialPackingRecords,
      shipmentRecords: initialShipmentRecords,
      transfers: initialInterDeptTransfers,
      employees: initialEmployees,
      attendance: initialAttendance,
      payroll: initialPayroll,
      auditLogs: [],
      notifications: [],
      masterData: initialMasterData
    };

    this.loadFromLocalStore();

    // Auto-fetch data from Supabase immediately
    this.initializeFromSupabase();
  }

  private setupRealtime() {
    if (isSupabaseConfigured() && !this.realtimeChannel) {
      try {
        this.realtimeChannel = supabase
          .channel('mjal_erp_realtime_changes')
          .on('postgres_changes', { event: '*', schema: 'public' }, () => {
            this.initializeFromSupabase();
          })
          .subscribe();
      } catch (err) {
        console.warn('Realtime subscription notice:', err);
      }
    }
  }

  private loadFromLocalStore() {
    try {
      // Clean up legacy mock user caches
      localStorage.removeItem('mjal_erp_users_v4');
      localStorage.removeItem('mjal_erp_users_v3');
      localStorage.removeItem('mjal_erp_users_v2');
      localStorage.removeItem('mjal_erp_users_v1');

      // 1. Load users cache (purely real database users)
      const storedUsers = localStorage.getItem('mjal_erp_users_v5');
      if (storedUsers) {
        const parsed = JSON.parse(storedUsers);
        if (Array.isArray(parsed)) {
          this.cache.users = parsed.filter(u => !isUserDeleted(u.id, u.email, u.username));
        }
      } else {
        this.cache.users = [];
      }

      // 2. Load other module data caches
      const stored = localStorage.getItem('mjal_erp_local_cache_v4') || localStorage.getItem('mjal_erp_local_cache_v3');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.orders) && parsed.orders.length > 0) {
            const styleMap = new Map<string, OrderStyle>();
            for (const ord of parsed.orders) {
              if (!ord || !ord.styleNo) continue;
              const sKey = `${(ord.buyer || '').trim().toUpperCase()}||${ord.styleNo.trim().toUpperCase()}`;
              const existing = styleMap.get(sKey);
              if (!existing) {
                styleMap.set(sKey, ord);
              } else {
                const existingTime = existing.updatedAt || existing.createdAt || '';
                const curTime = ord.updatedAt || ord.createdAt || '';
                if (curTime >= existingTime) {
                  styleMap.set(sKey, ord);
                }
              }
            }
            this.cache.orders = Array.from(styleMap.values()).map(o => {
              const poMap = new Map<string, PurchaseOrder>();
              for (const po of o.purchaseOrders || []) {
                if (!po || !po.poNo) continue;
                poMap.set(po.poNo.trim().toUpperCase(), po);
              }
              const cleanPOs = Array.from(poMap.values());
              return {
                ...o,
                purchaseOrders: cleanPOs,
                totalOrderQty: cleanPOs.reduce((sum, p) => sum + (p.totalPoQty || 0), 0),
                totalOrderValue: cleanPOs.reduce((sum, p) => sum + (p.totalValue || 0), 0),
                factoryOrderQty: o.factoryOrderQty || cleanPOs.reduce((sum, p) => sum + (p.factoryPoQty || p.totalPoQty || 0), 0)
              };
            });
          }
          if (Array.isArray(parsed.shipmentRecords) && parsed.shipmentRecords.length > 0) {
            this.cache.shipmentRecords = parsed.shipmentRecords;
          }
          if (Array.isArray(parsed.finishingRecords) && parsed.finishingRecords.length > 0) {
            this.cache.finishingRecords = parsed.finishingRecords;
          }
          if (Array.isArray(parsed.cuttingEntries) && parsed.cuttingEntries.length > 0) {
            this.cache.cuttingEntries = parsed.cuttingEntries;
          }
          if (Array.isArray(parsed.sewingProduction) && parsed.sewingProduction.length > 0) {
            this.cache.sewingProduction = parsed.sewingProduction;
          }
          if (Array.isArray(parsed.auditLogs) && parsed.auditLogs.length > 0) {
            this.cache.auditLogs = parsed.auditLogs;
          }
          if (Array.isArray(parsed.masterData) && parsed.masterData.length > 0) {
            // Merge loaded masterData with defaultMasterData ensuring non-redundant union
            const existingIds = new Set(parsed.masterData.map((m: MasterDataItem) => m.id));
            const mergedDefaults = defaultMasterData.filter(d => !existingIds.has(d.id));
            this.cache.masterData = [...parsed.masterData, ...mergedDefaults];
          }
        }
      }
    } catch {
      // Ignore errors
    }
  }

  private persistToLocalStore() {
    try {
      // 1. Persist users
      if (Array.isArray(this.cache.users)) {
        localStorage.setItem('mjal_erp_users_v5', JSON.stringify(this.cache.users));
      }

      // 2. Persist local cache
      localStorage.setItem('mjal_erp_local_cache_v4', JSON.stringify({
        orders: this.cache.orders,
        shipmentRecords: this.cache.shipmentRecords,
        finishingRecords: this.cache.finishingRecords,
        cuttingEntries: this.cache.cuttingEntries,
        sewingProduction: this.cache.sewingProduction,
        auditLogs: this.cache.auditLogs.slice(0, 100),
        masterData: this.cache.masterData
      }));
    } catch {
      // Ignore errors
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public notify() {
    this.persistToLocalStore();
    this.listeners.forEach(l => {
      try { l(); } catch (err) { console.error('Error notifying listener', err); }
    });
  }

  public getIsLoaded(): boolean {
    return this.isLoaded;
  }

  private mergeCacheArray<T extends { id: string }>(currentLocal: T[], remoteMapped: T[]): T[] {
    if (!remoteMapped || remoteMapped.length === 0) {
      return currentLocal || [];
    }
    const remoteMap = new Map(remoteMapped.map(item => [item.id, item]));
    const result = [...remoteMapped];
    for (const localItem of (currentLocal || [])) {
      if (localItem && localItem.id && !remoteMap.has(localItem.id)) {
        result.push(localItem);
      }
    }
    return result;
  }

  /**
   * Loads all business ERP datasets directly from Supabase PostgreSQL tables.
   */
  public async initializeFromSupabase(): Promise<void> {
    if (this.isFetching) return;
    this.isFetching = true;

    try {
      if (!isSupabaseConfigured()) {
        this.isLoaded = true;
        this.notify();
        return;
      }

      this.setupRealtime();

      // Fetch all tables in parallel
      const [
        profilesRes,
        stylesRes,
        bomRes,
        taRes,
        samplesRes,
        stockRes,
        txRes,
        cuttingRes,
        linesRes,
        targetsRes,
        sewingRes,
        washingRes,
        finishingRes,
        qcRes,
        packingRes,
        shipmentRes,
        shipmentsRes,
        empRes,
        attRes,
        payrollRes,
        auditRes,
        notifRes,
        masterRes,
        transfersRes
      ] = await Promise.allSettled([
        supabase.from('profiles').select('*'),
        supabase.from('order_styles').select('*, purchase_orders(*, po_colours(*))').order('created_at', { ascending: false }),
        supabase.from('bom_items').select('*').order('created_at', { ascending: false }),
        supabase.from('ta_calendar_tasks').select('*').order('planned_date', { ascending: true }),
        supabase.from('sample_records').select('*').order('target_date', { ascending: true }),
        supabase.from('store_stock_items').select('*').order('item_name', { ascending: true }),
        supabase.from('store_transactions').select('*').order('date', { ascending: false }),
        supabase.from('cutting_entries').select('*').order('date', { ascending: false }),
        supabase.from('sewing_lines').select('*').order('line_no', { ascending: true }),
        supabase.from('sewing_targets').select('*').order('date', { ascending: false }),
        supabase.from('sewing_production').select('*').order('date', { ascending: false }),
        supabase.from('washing_records').select('*').order('date', { ascending: false }),
        supabase.from('finishing_records').select('*').order('date', { ascending: false }),
        supabase.from('qc_inspections').select('*').order('date', { ascending: false }),
        supabase.from('packing_records').select('*').order('date', { ascending: false }),
        supabase.from('shipment_records').select('*'),
        supabase.from('shipments').select('*'),
        supabase.from('employees').select('*').order('emp_id', { ascending: true }),
        supabase.from('attendance_records').select('*').order('date', { ascending: false }),
        supabase.from('payroll_records').select('*').order('month', { ascending: false }),
        supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(200),
        supabase.from('notifications').select('*').order('timestamp', { ascending: false }).limit(50),
        supabase.from('master_data').select('*').order('code', { ascending: true }),
        supabase.from('inter_dept_transfers').select('*').order('created_at', { ascending: false })
      ]);

      // 1. Profiles & Users Synchronisation
      let remoteUsers: User[] = [];
      if (profilesRes.status === 'fulfilled' && Array.isArray(profilesRes.value.data)) {
        remoteUsers = (profilesRes.value.data || []).map(p => {
          let perms = p.permissions;
          if (typeof perms === 'string') {
            try { perms = JSON.parse(perms); } catch { perms = null; }
          }
          return {
            id: p.id,
            name: p.full_name || p.email,
            email: p.email,
            username: p.employee_id || (p.email ? p.email.split('@')[0] : 'user'),
            role: p.role || 'DEPT_USER',
            department: (p.department || 'HR & Admin') as Department,
            section: p.section || p.line_no,
            phone: p.phone,
            status: p.status || 'Active',
            permissions: perms || (p.role === 'SUPER_ADMIN' ? fullPermissions : viewOnlyPermissions)
          };
        });
      }

      // Also query server backend for admin-persisted users
      try {
        const serverUserRes = await fetch('/api/admin/users');
        if (serverUserRes.ok) {
          const serverJson = await serverUserRes.json();
          if (serverJson.success && Array.isArray(serverJson.users)) {
            serverJson.users.forEach((p: any) => {
              let perms = p.permissions;
              if (typeof perms === 'string') {
                try { perms = JSON.parse(perms); } catch { perms = null; }
              }
              const mappedUser: User = {
                id: p.id,
                name: p.full_name || p.name || p.email,
                email: p.email,
                username: p.employee_id || p.username || (p.email ? p.email.split('@')[0] : 'user'),
                role: p.role || 'DEPT_USER',
                department: (p.department || 'HR & Admin') as Department,
                section: p.section || p.line_no,
                phone: p.phone,
                status: p.status || 'Active',
                permissions: perms || (p.role === 'SUPER_ADMIN' ? fullPermissions : viewOnlyPermissions)
              };
              remoteUsers.push(mappedUser);
            });
          }
        }
      } catch (srvErr) {
        // Backend fetch fallback
      }
      
      // Store real database users, filtering out any deleted users
      const userMap = new Map<string, User>();
      remoteUsers.forEach(u => {
        if (u && (u.email || u.id)) {
          if (!isUserDeleted(u.id, u.email, u.username)) {
            userMap.set((u.email || u.id).toLowerCase(), u);
          }
        }
      });
      this.cache.users = Array.from(userMap.values());
      this.persistToLocalStore();

      // 2. Orders & Styles
      if (stylesRes.status === 'fulfilled' && Array.isArray(stylesRes.value.data) && stylesRes.value.data.length > 0) {
        const rawOrders = stylesRes.value.data;
        // Deduplicate styles by buyer+style_no (pick latest updated_at or non-empty)
        const styleMap = new Map<string, any>();
        for (const s of rawOrders) {
          const sNo = (s.style_no || '').trim().toUpperCase();
          const sBuyer = (s.buyer || '').trim().toUpperCase();
          if (!sNo) continue;
          const sKey = `${sBuyer}||${sNo}`;
          if (!styleMap.has(sKey)) {
            styleMap.set(sKey, s);
          } else {
            const curDate = s.updated_at || s.created_at || '';
            const prev = styleMap.get(sKey);
            const prevDate = prev.updated_at || prev.created_at || '';
            if (curDate >= prevDate) {
              styleMap.set(sKey, s);
            }
          }
        }

        const remoteOrders: OrderStyle[] = Array.from(styleMap.values()).map(s => {
          // Deduplicate POs under this style by po_no
          const poMap = new Map<string, any>();
          for (const po of s.purchase_orders || []) {
            const pNo = (po.po_no || '').trim().toUpperCase();
            if (!pNo) continue;
            if (!poMap.has(pNo)) {
              poMap.set(pNo, po);
            } else {
              const curDate = po.created_at || po.delivery_date || '';
              const prev = poMap.get(pNo);
              const prevDate = prev.created_at || prev.delivery_date || '';
              if (curDate >= prevDate) {
                poMap.set(pNo, po);
              }
            }
          }

          const uniqueRawPOs = Array.from(poMap.values());
          const mappedPOs = uniqueRawPOs.map((po: any) => {
            const poAllowance = Number(po.allowance_pct ?? s.allowance_pct ?? 0);
            const rawColours = (po.po_colours || []).map((c: any) => {
              const colAllowance = Number(c.allowance_pct ?? poAllowance);
              const sizeWise = calculateSizeWiseAllowance(c.size_quantities || c.sizeQuantities || {}, colAllowance);
              const colOrderQty = sizeWise.totalOrderQty > 0 ? sizeWise.totalOrderQty : Number(c.total_qty || c.totalQty || 0);
              const colFactoryQty = Number(c.factory_qty || c.factoryQty || (sizeWise.totalFactoryQty > 0 ? sizeWise.totalFactoryQty : Math.round(colOrderQty * (1 + colAllowance / 100))));
              const colAllowanceQty = Math.max(0, colFactoryQty - colOrderQty);

              return {
                colour: c.colour,
                totalQty: colOrderQty,
                allowancePct: colAllowance,
                allowanceQty: colAllowanceQty,
                factoryQty: colFactoryQty,
                sizeQuantities: sizeWise.sizeQuantities,
                factorySizeQuantities: sizeWise.factorySizeQuantities,
                allowanceSizeQuantities: sizeWise.allowanceSizeQuantities
              };
            });

            const colourQtySum = rawColours.reduce((sum: number, c: any) => sum + (c.totalQty || 0), 0);
            const poQty = colourQtySum > 0 ? colourQtySum : Number(po.total_po_qty || 0);
            const unitPrice = Number(po.unit_price || 0);
            const totalValue = Number(po.total_value || (poQty * unitPrice));
            const poFactoryQty = rawColours.reduce((sum: number, c: any) => sum + (c.factoryQty || c.totalQty || 0), 0) || Math.round(poQty * (1 + poAllowance / 100));
            const poAllowanceQty = Math.max(0, poFactoryQty - poQty);

            return {
              id: po.id,
              poNo: po.po_no,
              poDate: po.po_date || new Date().toISOString().substring(0, 10),
              deliveryDate: po.delivery_date || '',
              shipmentDate: po.shipment_date || '',
              unitPrice,
              currency: po.currency || 'USD',
              totalValue,
              status: po.status,
              totalPoQty: poQty,
              allowancePct: poAllowance,
              allowanceQty: poAllowanceQty,
              factoryPoQty: poFactoryQty,
              remarks: po.remarks,
              colours: rawColours
            };
          });

          const totalOrderQty = mappedPOs.reduce((sum, p) => sum + (p.totalPoQty || 0), 0);
          const totalOrderValue = mappedPOs.reduce((sum, p) => sum + (p.totalValue || 0), 0);
          const factoryOrderQty = mappedPOs.reduce((sum, p) => sum + (p.factoryPoQty || p.totalPoQty || 0), 0);
          const styleAllowance = Number(s.allowance_pct ?? (mappedPOs[0]?.allowancePct || 0));
          const styleAllowanceQty = Math.max(0, factoryOrderQty - totalOrderQty);

          return {
            id: s.id,
            buyer: s.buyer,
            brand: s.brand,
            styleNo: s.style_no,
            styleName: s.style_name,
            garmentType: s.garment_type,
            season: s.season,
            currency: s.currency || 'USD',
            status: s.status,
            totalOrderQty,
            totalOrderValue,
            allowancePct: styleAllowance,
            allowanceQty: styleAllowanceQty,
            factoryOrderQty,
            createdBy: s.created_by || s.createdBy || s.user_id || s.merchandiser || s.user_name || undefined,
            createdDepartment: s.created_department || s.createdDepartment || 'Merchandising',
            creatorEmail: s.creator_email || s.creatorEmail || (s.created_by?.includes('@') ? s.created_by : undefined),
            createdAt: s.created_at || new Date().toISOString(),
            updatedAt: s.updated_at || s.created_at || new Date().toISOString(),
            purchaseOrders: mappedPOs
          };
        });

        // Smart reconciliation between remote and local orders to guarantee no data loss on refresh
        const mergedStylesMap = new Map<string, OrderStyle>();
        for (const rem of remoteOrders) {
          const k = `${(rem.buyer || '').trim().toUpperCase()}||${(rem.styleNo || '').trim().toUpperCase()}`;
          mergedStylesMap.set(k, rem);
        }

        for (const loc of this.cache.orders) {
          if (!loc || !loc.styleNo) continue;
          const k = `${(loc.buyer || '').trim().toUpperCase()}||${(loc.styleNo || '').trim().toUpperCase()}`;
          const existingRemote = mergedStylesMap.get(k);
          if (!existingRemote) {
            mergedStylesMap.set(k, loc);
          } else {
            const locTime = loc.updatedAt || loc.createdAt || '';
            const remTime = existingRemote.updatedAt || existingRemote.createdAt || '';
            if (locTime > remTime) {
              // Local is newer: preserve local edits
              mergedStylesMap.set(k, loc);
            }
          }
        }

        if (mergedStylesMap.size > 0) {
          this.cache.orders = Array.from(mergedStylesMap.values());
          this.persistToLocalStore();
        }
      }

      // 3. BOM
      if (bomRes.status === 'fulfilled') {
        this.cache.bom = (bomRes.value.data || []).map(b => ({
          id: b.id,
          styleNo: b.style_no,
          category: b.category,
          itemName: b.item_name,
          specification: b.specification || '',
          consumptionPerDzn: Number(b.consumption_per_dzn || 0),
          unit: b.unit,
          unitPrice: Number(b.unit_price || 0),
          supplier: b.supplier || '',
          requiredQty: Number(b.required_qty || 0),
          bookedQty: Number(b.booked_qty || 0),
          receivedQty: Number(b.received_qty || 0),
          status: b.status
        }));
      }

      // 4. T&A Tasks
      if (taRes.status === 'fulfilled') {
        this.cache.taCalendar = (taRes.value.data || []).map(t => ({
          id: t.id,
          styleNo: t.style_no,
          poNo: t.po_no,
          taskName: t.task_name,
          plannedDate: t.planned_date,
          actualDate: t.actual_date,
          responsibleDept: t.responsible_dept,
          status: t.status,
          remarks: t.remarks
        }));
      }

      // 5. Samples
      if (samplesRes.status === 'fulfilled') {
        this.cache.samples = (samplesRes.value.data || []).map(s => ({
          id: s.id,
          styleNo: s.style_no,
          poNo: s.po_no,
          colour: s.colour,
          sampleType: s.sample_type,
          submissionDate: s.submission_date,
          targetDate: s.target_date,
          approvalDate: s.approval_date,
          buyerComments: s.buyer_comments,
          status: s.status,
          preparedBy: s.prepared_by || ''
        }));
      }

      // 6. Store Stock
      if (stockRes.status === 'fulfilled') {
        this.cache.storeStock = (stockRes.value.data || []).map(i => ({
          id: i.id,
          storeType: i.store_type,
          itemName: i.item_name,
          category: i.category || '',
          styleNo: i.style_no,
          poNo: i.po_no,
          colour: i.colour,
          currentStock: Number(i.current_stock || 0),
          minStockLevel: Number(i.min_stock_level || 0),
          unit: i.unit,
          location: i.location || '',
          unitPrice: Number(i.unit_price || 0)
        }));
      }

      // 7. Store Transactions
      if (txRes.status === 'fulfilled') {
        this.cache.storeTransactions = (txRes.value.data || []).map(t => ({
          id: t.id,
          date: t.date,
          storeType: t.store_type,
          transactionType: t.transaction_type,
          styleNo: t.style_no,
          poNo: t.po_no,
          colour: t.colour,
          itemName: t.item_name,
          quantity: Number(t.quantity || 0),
          unit: t.unit,
          supplierOrDept: t.supplier_or_dept || '',
          grnNo: t.grn_no,
          issuedTo: t.issued_to,
          performedBy: t.performed_by || '',
          remarks: t.remarks
        }));
      }

      // 8. Cutting Entries
      if (cuttingRes.status === 'fulfilled') {
        this.cache.cuttingEntries = (cuttingRes.value.data || []).map(c => ({
          id: c.id,
          date: c.date,
          styleNo: c.style_no,
          poNo: c.po_no,
          colour: c.colour,
          size: c.size,
          orderQty: Number(c.order_qty || 0),
          fabricAllocatedYds: Number(c.fabric_allocated_yds || 0),
          markerLengthYds: Number(c.marker_length_yds || 0),
          markerEfficiency: Number(c.marker_efficiency || 0),
          layPlies: Number(c.lay_plies || 0),
          cutQty: Number(c.cut_qty || 0),
          shortageQty: Number(c.shortage_qty || 0),
          rejectQty: Number(c.reject_qty || 0),
          recutQty: Number(c.recut_qty || 0),
          bundleCount: Number(c.bundle_count || 0),
          cutEfficiency: Number(c.cut_efficiency || 0),
          operator: c.operator || ''
        }));
      }

      // 9. Sewing Lines
      if (linesRes.status === 'fulfilled') {
        this.cache.sewingLines = (linesRes.value.data || []).map(l => ({
          id: l.id,
          lineNo: l.line_no,
          lineName: l.line_name,
          capacityPerDay: Number(l.capacity_per_day || 0),
          supervisorName: l.supervisor_name || '',
          status: l.status
        }));
      }

      // 10. Sewing Targets
      if (targetsRes.status === 'fulfilled') {
        this.cache.sewingTargets = (targetsRes.value.data || []).map(t => ({
          id: t.id,
          lineNo: t.line_no,
          date: t.date,
          month: t.month,
          styleNo: t.style_no,
          poNo: t.po_no,
          colour: t.colour,
          dailyTargetQty: Number(t.daily_target_qty || 0),
          hourlyTargetQty: Number(t.hourly_target_qty || 0),
          workingDays: Number(t.working_days || 26),
          monthlyTargetQty: Number(t.monthly_target_qty || 0)
        }));
      }

      // 11. Sewing Production
      if (sewingRes.status === 'fulfilled') {
        this.cache.sewingProduction = (sewingRes.value.data || []).map(p => ({
          id: p.id,
          date: p.date,
          lineNo: p.line_no,
          buyer: p.buyer || '',
          styleNo: p.style_no,
          poNo: p.po_no,
          colour: p.colour,
          size: p.size || 'All Sizes',
          inputQty: Number(p.input_qty || 0),
          dailyTarget: Number(p.daily_target || 0),
          hourlyOutputs: p.hourly_outputs || [],
          totalOutput: Number(p.total_output || 0),
          alterQty: Number(p.alter_qty || 0),
          rejectQty: Number(p.reject_qty || 0),
          reworkQty: Number(p.rework_qty || 0),
          wipQty: Number(p.wip_qty || 0),
          remarks: p.remarks,
          submittedBy: p.submitted_by || 'Supervisor',
          submissionTime: p.submission_time || ''
        }));
      }

      // 12. Washing Records
      if (washingRes.status === 'fulfilled') {
        this.cache.washingRecords = (washingRes.value.data || []).map(w => {
          let parsedItems: any[] | undefined = undefined;
          let cleanRemarks = w.remarks;
          let extraMeta: any = {};
          if (w.remarks && typeof w.remarks === 'string') {
            if (w.remarks.includes('__ITEMS_JSON__:')) {
              try {
                const parts = w.remarks.split('__ITEMS_JSON__:');
                cleanRemarks = parts[0]?.trim() || undefined;
                parsedItems = JSON.parse(parts[1]?.trim() || '[]');
              } catch (err) {
                console.warn('Error parsing items JSON from washing record remarks', err);
              }
            }
            if (cleanRemarks && cleanRemarks.includes('__EXTRA_META__:')) {
              try {
                const parts = cleanRemarks.split('__EXTRA_META__:');
                cleanRemarks = parts[0]?.trim() || undefined;
                extraMeta = JSON.parse(parts[1]?.trim() || '{}');
              } catch (err) {
                console.warn('Error parsing extra meta from washing record remarks', err);
              }
            }
          }

          return {
            id: w.id,
            challanNo: w.challan_no,
            date: w.date,
            vendorName: w.vendor_name,
            vendorAddress: w.vendor_address || extraMeta.vendorAddress || undefined,
            washType: w.wash_type,
            buyer: w.buyer || extraMeta.buyer || undefined,
            styleNo: w.style_no,
            poNo: w.po_no,
            colour: w.colour,
            size: w.size || extraMeta.size || 'All Sizes',
            items: (parsedItems && Array.isArray(parsedItems) && parsedItems.length > 0) ? parsedItems : (w.items || undefined),
            sentQty: Number(w.sent_qty || 0),
            receivedQty: Number(w.received_qty || 0),
            damageQty: Number(w.damage_qty || 0),
            rejectQty: Number(w.reject_qty || 0),
            balanceQty: Number(w.balance_qty || 0),
            status: w.status,
            vehicleNo: w.vehicle_no || extraMeta.vehicleNo || undefined,
            driverName: w.driver_name || extraMeta.driverName || undefined,
            driverPhone: w.driver_phone || extraMeta.driverPhone || undefined,
            expectedReturnDate: w.expected_return_date || extraMeta.expectedReturnDate || undefined,
            sourceTransferId: w.source_transfer_id || extraMeta.sourceTransferId || undefined,
            authorizedBy: w.authorized_by || extraMeta.authorizedBy || undefined,
            processInstructions: w.process_instructions || extraMeta.processInstructions || undefined,
            returnDate: w.return_date || extraMeta.returnDate || undefined,
            receivedBy: w.received_by || extraMeta.receivedBy || undefined,
            remarks: cleanRemarks
          };
        });
      }

      // 13. Finishing Records
      if (finishingRes.status === 'fulfilled') {
        this.cache.finishingRecords = (finishingRes.value.data || []).map(f => {
          let extraMeta: any = {};
          let cleanRemarks = f.remarks;
          if (f.remarks && typeof f.remarks === 'string' && f.remarks.includes('__EXTRA_META__:')) {
            try {
              const parts = f.remarks.split('__EXTRA_META__:');
              cleanRemarks = parts[0]?.trim() || undefined;
              extraMeta = JSON.parse(parts[1]?.trim() || '{}');
            } catch (err) {
              console.warn('Error parsing extra meta from finishing record remarks', err);
            }
          }

          const threadCutQty = Number(f.thread_cut_qty ?? extraMeta.threadCutQty ?? f.sewing_receive_qty ?? 0);
          const getUpQty = Number(f.get_up_qty ?? extraMeta.getUpQty ?? 0);
          const cartonQty = Number(f.carton_qty ?? extraMeta.cartonQty ?? 0);
          const polyQty = Number(f.poly_qty ?? extraMeta.polyQty ?? f.packed_qty ?? 0);
          const readyForShipmentQty = Number(f.ready_for_shipment_qty ?? extraMeta.readyForShipmentQty ?? 0);
          const isReadyForShipment = Boolean(f.is_ready_for_shipment ?? extraMeta.isReadyForShipment ?? (readyForShipmentQty > 0));
          const readyForShipmentDate = f.ready_for_shipment_date || extraMeta.readyForShipmentDate || '';
          const shipmentStatus = f.shipment_status || extraMeta.shipmentStatus || (isReadyForShipment ? 'Ready For Shipment' : 'In Finishing');

          return {
            id: f.id,
            date: f.date,
            buyer: f.buyer || extraMeta.buyer || undefined,
            styleNo: f.style_no,
            poNo: f.po_no,
            colour: f.colour,
            size: f.size || 'All Sizes',
            sewingReceiveQty: Number(f.sewing_receive_qty || 0),
            finishingInputQty: Number(f.finishing_input_qty || 0),
            threadCutQty,
            ironedQty: Number(f.ironed_qty || 0),
            getUpQty,
            foldedQty: Number(f.folded_qty || 0),
            taggedQty: Number(f.tagged_qty || 0),
            packedQty: Number(f.packed_qty || polyQty || 0),
            polyQty,
            cartonQty,
            reworkQty: Number(f.rework_qty || 0),
            rejectQty: Number(f.reject_qty || 0),
            finishedQty: Number(f.finished_qty || 0),
            hangTagStatus: f.hang_tag_status || (Number(f.tagged_qty || 0) >= Number(f.sewing_receive_qty || 1) ? 'Completed' : 'In Progress'),
            transferredToPackingQty: Number(f.transferred_to_packing_qty || 0),
            isReadyForShipment,
            readyForShipmentQty,
            readyForShipmentDate,
            shipmentStatus,
            operator: f.operator || '',
            remarks: cleanRemarks
          };
        });
      }

      // 14. QC Inspections
      if (qcRes.status === 'fulfilled') {
        this.cache.qcInspections = (qcRes.value.data || []).map(q => ({
          id: q.id,
          date: q.date,
          inspectionType: q.inspection_type,
          styleNo: q.style_no,
          poNo: q.po_no,
          colour: q.colour,
          lineNo: q.line_no || '',
          inspectedQty: Number(q.inspected_qty || 0),
          passedQty: Number(q.passed_qty || 0),
          reworkQty: Number(q.rework_qty || 0),
          rejectQty: Number(q.reject_qty || 0),
          dhu: Number(q.dhu || 0),
          defects: q.defects || [],
          inspectorName: q.inspector_name || '',
          result: q.result
        }));
      }

      // 15. Packing Records
      if (packingRes.status === 'fulfilled') {
        this.cache.packingRecords = (packingRes.value.data || []).map(p => ({
          id: p.id,
          date: p.date,
          styleNo: p.style_no,
          poNo: p.po_no,
          colour: p.colour,
          cartonCount: Number(p.carton_count || 0),
          packedQty: Number(p.packed_qty || 0),
          orderQty: Number(p.order_qty || 0),
          balanceQty: Number(p.balance_qty || 0),
          cartons: p.cartons || [],
          packingOfficer: p.packing_officer || ''
        }));
      }

      // 16. Shipment Records (Supports both 'shipment_records' and 'shipments' tables)
      const rawShipmentList: any[] = [];
      if (shipmentRes.status === 'fulfilled') {
        if (shipmentRes.value.error) {
          console.warn('[Supabase DB Trace] shipment_records SELECT error:', shipmentRes.value.error);
        } else if (Array.isArray(shipmentRes.value.data)) {
          console.log(`[Supabase DB Trace] Loaded ${shipmentRes.value.data.length} records from public.shipment_records`);
          rawShipmentList.push(...shipmentRes.value.data);
        }
      } else {
        console.warn('[Supabase DB Trace] shipment_records query rejected:', shipmentRes.reason);
      }

      if (shipmentsRes.status === 'fulfilled') {
        if (shipmentsRes.value.error) {
          // Alternative table error is normal if table doesn't exist
        } else if (Array.isArray(shipmentsRes.value.data)) {
          console.log(`[Supabase DB Trace] Loaded ${shipmentsRes.value.data.length} records from alternative public.shipments`);
          rawShipmentList.push(...shipmentsRes.value.data);
        }
      }

      if (rawShipmentList.length > 0) {
        const seenIds = new Set<string>();
        const mappedShipments: ShipmentRecord[] = [];

        for (const s of rawShipmentList) {
          if (!s) continue;
          const sId = String(s.id || s.invoice_no || `ship-${Math.random().toString(36).substring(2, 7)}`);
          if (seenIds.has(sId)) continue;
          seenIds.add(sId);

          let parsedItems: any[] | undefined = undefined;
          let cleanRemarks = s.remarks;
          if (s.remarks && typeof s.remarks === 'string') {
            if (s.remarks.includes('__ITEMS_JSON__:')) {
              try {
                const parts = s.remarks.split('__ITEMS_JSON__:');
                cleanRemarks = parts[0]?.trim() || undefined;
                parsedItems = JSON.parse(parts[1]?.trim() || '[]');
              } catch (err) {
                console.warn('Error parsing items JSON from shipment record remarks', err);
              }
            }
          }

          if (!parsedItems && s.items) {
            if (Array.isArray(s.items)) parsedItems = s.items;
            else if (typeof s.items === 'string') {
              try { parsedItems = JSON.parse(s.items); } catch {}
            }
          }

          mappedShipments.push({
            id: sId,
            invoiceNo: s.invoice_no || s.challan_no || s.consignment_no || 'EXP-INV',
            packingListNo: s.packing_list_no || s.packing_list || s.invoice_no || 'PL-001',
            shipmentDate: s.shipment_date || s.date || new Date().toISOString().substring(0, 10),
            buyer: s.buyer || '',
            styleNo: s.style_no || '',
            poNo: s.po_no || '',
            colour: s.colour || s.color || '',
            size: s.size || 'All Sizes',
            shippedQty: Number(s.shipped_qty || s.quantity || s.qty || 0),
            orderQty: Number(s.order_qty || 0),
            balanceQty: Number(s.balance_qty || 0),
            cartonCount: Number(s.carton_count || s.cartons || s.carton_qty || 0),
            vesselOrFlight: s.vessel_or_flight || s.vessel || s.carrier || '',
            containerNo: s.container_no || '',
            portOfLoading: s.port_of_loading || '',
            portOfDischarge: s.port_of_discharge || '',
            status: s.status || 'Shipped',
            preparedBy: s.prepared_by || '',
            items: (parsedItems && Array.isArray(parsedItems) && parsedItems.length > 0) ? parsedItems : undefined,
            remarks: cleanRemarks
          });
        }

        this.cache.shipmentRecords = this.mergeCacheArray(this.cache.shipmentRecords, mappedShipments);
      }

      // 17. Employees
      if (empRes.status === 'fulfilled') {
        this.cache.employees = (empRes.value.data || []).map(e => ({
          id: e.id,
          empId: e.emp_id,
          name: e.name,
          designation: e.designation,
          department: e.department,
          section: e.section || '',
          shift: e.shift || 'Day',
          joiningDate: e.joining_date || '',
          phone: e.phone || '',
          email: e.email,
          basicSalary: Number(e.basic_salary || 0),
          otRatePerHour: Number(e.ot_rate_per_hour || 0),
          status: e.status
        }));
      }

      // 18. Attendance
      if (attRes.status === 'fulfilled') {
        this.cache.attendance = (attRes.value.data || []).map(a => ({
          id: a.id,
          date: a.date,
          empId: a.emp_id,
          empName: a.emp_name,
          department: a.department,
          inTime: a.in_time || '',
          outTime: a.out_time || '',
          otHours: Number(a.ot_hours || 0),
          status: a.status
        }));
      }

      // 19. Payroll
      if (payrollRes.status === 'fulfilled') {
        this.cache.payroll = (payrollRes.value.data || []).map(p => ({
          id: p.id,
          month: p.month,
          empId: p.emp_id,
          empName: p.emp_name,
          department: p.department,
          basicSalary: Number(p.basic_salary || 0),
          houseRent: Number(p.house_rent || 0),
          medicalAllowance: Number(p.medical_allowance || 0),
          otHours: Number(p.ot_hours || 0),
          otAmount: Number(p.ot_amount || 0),
          deductions: Number(p.deductions || 0),
          netSalary: Number(p.net_salary || 0),
          status: p.status
        }));
      }

      // 20. Audit Logs
      if (auditRes.status === 'fulfilled') {
        this.cache.auditLogs = (auditRes.value.data || []).map(a => ({
          id: a.id,
          timestamp: a.timestamp,
          user: a.user_name,
          role: a.role as any,
          department: a.department as any,
          action: a.action,
          module: a.module,
          recordId: a.record_id,
          previousValue: a.previous_value,
          newValue: a.new_value
        }));
      }

      // 21. Notifications
      if (notifRes.status === 'fulfilled') {
        this.cache.notifications = (notifRes.value.data || []).map(n => ({
          id: n.id,
          title: n.title,
          message: n.message,
          timestamp: n.timestamp,
          type: n.type as any,
          read: Boolean(n.read),
          linkModule: n.link_module
        }));
      }

      // 22. Master Data
      if (masterRes.status === 'fulfilled') {
        this.cache.masterData = (masterRes.value.data || []).map(m => {
          let cleanDesc = m.description;
          let meta: any = {};
          if (cleanDesc && typeof cleanDesc === 'string' && cleanDesc.includes('__CREATOR_META__:')) {
            try {
              const parts = cleanDesc.split('__CREATOR_META__:');
              cleanDesc = parts[0]?.trim() || undefined;
              meta = JSON.parse(parts[1]?.trim() || '{}');
            } catch (err) {
              console.warn('Error parsing creator meta from master_data description', err);
            }
          }
          return {
            id: m.id,
            category: m.category,
            code: m.code,
            name: m.name,
            description: cleanDesc,
            status: m.status,
            createdBy: m.created_by || m.createdBy || meta.createdBy || undefined,
            creatorEmail: m.creator_email || m.creatorEmail || meta.creatorEmail || undefined,
            createdDepartment: m.created_department || m.createdDepartment || meta.createdDepartment || undefined
          };
        });
      }

      // 23. Inter Dept Transfers
      if (transfersRes && transfersRes.status === 'fulfilled') {
        this.cache.transfers = (transfersRes.value.data || []).map(t => {
          let parsedItems = t.items;
          let cleanRemarks = t.remarks;

          if ((!parsedItems || !Array.isArray(parsedItems) || parsedItems.length === 0) && t.remarks && typeof t.remarks === 'string' && t.remarks.includes('__ITEMS_JSON__:')) {
            try {
              const parts = t.remarks.split('__ITEMS_JSON__:');
              cleanRemarks = parts[0]?.trim() || undefined;
              parsedItems = JSON.parse(parts[1]?.trim() || '[]');
            } catch (err) {
              console.warn('Error parsing items JSON from transfer remarks', err);
            }
          }

          return {
            id: t.id,
            challanNo: t.challan_no,
            transferType: (t.transfer_type === 'Return' ? 'Return' : 'Transfer') as 'Transfer' | 'Return',
            returnReason: t.return_reason || undefined,
            originalChallanNo: t.original_challan_no || undefined,
            transferDate: t.transfer_date,
            fromDepartment: t.from_department,
            toDepartment: t.to_department,
            buyer: t.buyer,
            styleNo: t.style_no,
            poNo: t.po_no,
            colour: t.colour,
            size: t.size,
            garmentType: t.garment_type,
            isWashGarment: Boolean(t.is_wash_garment),
            quantity: Number(t.quantity || 0),
            bundleCount: t.bundle_count ? Number(t.bundle_count) : undefined,
            items: (parsedItems && Array.isArray(parsedItems) && parsedItems.length > 0) ? parsedItems : undefined,
            lineNo: t.line_no || undefined,
            vendorName: t.vendor_name || undefined,
            vehicleNo: t.vehicle_no || undefined,
            driverName: t.driver_name || undefined,
            senderName: t.sender_name || 'Department Incharge',
            receiverName: t.receiver_name || undefined,
            qcCheckedBy: t.qc_checked_by || 'Enayet Hossain',
            authorizedBy: t.authorized_by || 'Md Myeedul Islam',
            authorizedDesignation: t.authorized_designation || 'General Manager',
            authorizedDate: t.authorized_date || t.transfer_date,
            status: t.status || 'Pending',
            receiveDate: t.receive_date || undefined,
            remarks: cleanRemarks || undefined,
            createdAt: t.created_at || new Date().toISOString()
          };
        });
      }

      this.isLoaded = true;
      this.notify();
    } catch (err) {
      console.warn('Supabase fetch notice:', err);
    } finally {
      this.isFetching = false;
    }
  }

  // ==========================================
  // GETTERS (Instant sync return from state with Style-Wise Auto-Consolidation)
  // ==========================================
  public getUsers(): User[] {
    return (this.cache.users || []).filter(u => !isUserDeleted(u.id, u.email, u.username));
  }
  public getOrders(): OrderStyle[] {
    const styleMap = new Map<string, OrderStyle>();
    for (const ord of this.cache.orders) {
      if (!ord || !ord.styleNo) continue;
      const sKey = `${(ord.buyer || '').trim().toUpperCase()}||${ord.styleNo.trim().toUpperCase()}`;
      const existing = styleMap.get(sKey);
      if (!existing) {
        styleMap.set(sKey, ord);
      } else {
        const existingTime = existing.updatedAt || existing.createdAt || '';
        const curTime = ord.updatedAt || ord.createdAt || '';
        if (curTime >= existingTime) {
          styleMap.set(sKey, ord);
        }
      }
    }

    return Array.from(styleMap.values()).map(order => {
      const sStyle = (order.styleNo || '').trim().toUpperCase();
      
      // Calculate total shipped for this style across all shipments
      let styleShippedQty = 0;
      this.cache.shipmentRecords.forEach(ship => {
        if ((ship.styleNo || '').trim().toUpperCase() === sStyle) {
          if (ship.items && ship.items.length > 0) {
            ship.items.forEach(it => {
              if ((it.styleNo || '').trim().toUpperCase() === sStyle) {
                styleShippedQty += Number(it.shippedQty || 0);
              }
            });
          } else {
            styleShippedQty += Number(ship.shippedQty || 0);
          }
        }
      });

      // Deduplicate POs under this style strictly by poNo
      const poMap = new Map<string, PurchaseOrder>();
      for (const po of order.purchaseOrders || []) {
        if (!po || !po.poNo) continue;
        const pKey = po.poNo.trim().toUpperCase();
        poMap.set(pKey, po);
      }
      const uniquePOs = Array.from(poMap.values());

      // Update PO status & recalculate exact totals
      let allPOsCompleted = uniquePOs.length > 0;
      const updatedPOs = uniquePOs.map(po => {
        const sPo = (po.poNo || '').trim().toUpperCase();
        let poShippedQty = 0;
        this.cache.shipmentRecords.forEach(ship => {
          if ((ship.styleNo || '').trim().toUpperCase() === sStyle && (ship.poNo || '').trim().toUpperCase() === sPo) {
            if (ship.items && ship.items.length > 0) {
              ship.items.forEach(it => {
                if ((it.styleNo || '').trim().toUpperCase() === sStyle && (!it.poNo || it.poNo.trim().toUpperCase() === sPo)) {
                  poShippedQty += Number(it.shippedQty || 0);
                }
              });
            } else {
              poShippedQty += Number(ship.shippedQty || 0);
            }
          }
        });

        // Recalculate true PO order qty from colours breakdown
        let computedPoQty = 0;
        if (po.colours && po.colours.length > 0) {
          computedPoQty = po.colours.reduce((cSum, c) => {
            const szSum = Object.values(c.sizeQuantities || {}).reduce<number>((a, b) => a + (Number(b) || 0), 0);
            return cSum + (szSum > 0 ? szSum : (Number(c.totalQty) || 0));
          }, 0);
        }
        const effectivePoQty = computedPoQty > 0 ? computedPoQty : (Number(po.totalPoQty) || 0);
        const unitPrice = Number(po.unitPrice || 0);
        const totalValue = Number(po.totalValue || (effectivePoQty * unitPrice));

        const isPoFullyShipped = effectivePoQty > 0 && poShippedQty >= effectivePoQty;
        const poStatus = (isPoFullyShipped && po.status !== 'Cancelled') ? 'Shipment Complete' : (po.status || 'Running');
        if (poStatus !== 'Shipment Complete' && poStatus !== 'Completed') {
          allPOsCompleted = false;
        }

        return {
          ...po,
          totalPoQty: effectivePoQty,
          totalValue,
          shippedQty: poShippedQty,
          status: poStatus
        };
      });

      const totalOrderQty = updatedPOs.reduce((sum, p) => sum + (p.totalPoQty || 0), 0);
      const totalOrderValue = updatedPOs.reduce((sum, p) => sum + (p.totalValue || 0), 0);
      const isStyleFullyShipped = (totalOrderQty > 0 && styleShippedQty >= totalOrderQty) || (allPOsCompleted && uniquePOs.length > 0);
      const computedStatus = (isStyleFullyShipped && order.status !== 'Cancelled') ? 'Shipment Complete' : (order.status || 'Running');

      return {
        ...order,
        totalOrderQty,
        totalOrderValue,
        status: computedStatus,
        purchaseOrders: updatedPOs
      };
    });
  }
  public getBOM(): BOMItem[] { return this.cache.bom; }
  public getTACalendar(): TACalendarTask[] { return this.cache.taCalendar; }
  public getSamples(): SampleRecord[] { return this.cache.samples; }
  public getStoreStock(): StoreStockItem[] { return this.cache.storeStock; }
  public getStoreTransactions(): StoreTransaction[] { return this.cache.storeTransactions; }
  
  public getCuttingEntries(): CuttingEntry[] {
    const map = new Map<string, CuttingEntry>();
    for (const c of this.cache.cuttingEntries) {
      const sNo = (c.styleNo || '').trim().toUpperCase();
      const pNo = (c.poNo || '').trim().toUpperCase();
      const col = (c.colour || '').trim().toUpperCase();
      const sz = (c.size || 'All Sizes').trim().toUpperCase();
      const key = `${sNo}__${pNo}__${col}__${sz}`;

      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...c, lastUpdateDate: c.date });
      } else {
        const latestDate = (!existing.date || (c.date && c.date > existing.date)) ? c.date : existing.date;
        const totalCut = (existing.cutQty || 0) + (c.cutQty || 0);
        const maxOrder = Math.max(existing.orderQty || 0, c.orderQty || 0);
        const totalFabric = (existing.fabricAllocatedYds || 0) + (c.fabricAllocatedYds || 0);
        const totalBundles = (existing.bundleCount || 0) + (c.bundleCount || 0);
        const totalRejects = (existing.rejectQty || 0) + (c.rejectQty || 0);
        const totalRecut = (existing.recutQty || 0) + (c.recutQty || 0);

        map.set(key, {
          ...existing,
          date: latestDate,
          lastUpdateDate: latestDate,
          cutQty: totalCut,
          orderQty: maxOrder,
          shortageQty: Math.max(0, maxOrder - totalCut),
          fabricAllocatedYds: totalFabric,
          bundleCount: totalBundles > 0 ? totalBundles : Math.ceil(totalCut / 20),
          rejectQty: totalRejects,
          recutQty: totalRecut,
          cutEfficiency: maxOrder > 0 ? Number(((totalCut / maxOrder) * 100).toFixed(1)) : 100,
          operator: c.operator || existing.operator
        });
      }
    }
    return Array.from(map.values());
  }

  public getSewingLines(): SewingLine[] { return this.cache.sewingLines; }
  public getSewingTargets(): SewingTarget[] { return this.cache.sewingTargets; }

  public getSewingProduction(): SewingProduction[] {
    const map = new Map<string, SewingProduction>();
    for (const p of this.cache.sewingProduction) {
      const sNo = (p.styleNo || '').trim().toUpperCase();
      const pNo = (p.poNo || '').trim().toUpperCase();
      const col = (p.colour || '').trim().toUpperCase();
      const sz = (p.size || 'All Sizes').trim().toUpperCase();
      const line = (p.lineNo || 'Line 01').trim().toUpperCase();
      const key = `${sNo}__${pNo}__${col}__${sz}__${line}`;

      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...p, lastUpdateDate: p.date });
      } else {
        const latestDate = (!existing.date || (p.date && p.date > existing.date)) ? p.date : existing.date;
        const totalOutput = (existing.totalOutput || 0) + (p.totalOutput || 0);
        const totalAlter = (existing.alterQty || 0) + (p.alterQty || 0);
        const totalReject = (existing.rejectQty || 0) + (p.rejectQty || 0);
        const totalRework = (existing.reworkQty || 0) + (p.reworkQty || 0);
        const maxInput = Math.max(existing.inputQty || 0, p.inputQty || 0, totalOutput);
        const maxTarget = Math.max(existing.dailyTarget || 0, p.dailyTarget || 0);

        map.set(key, {
          ...existing,
          date: latestDate,
          lastUpdateDate: latestDate,
          inputQty: maxInput,
          dailyTarget: maxTarget,
          totalOutput: totalOutput,
          alterQty: totalAlter,
          rejectQty: totalReject,
          reworkQty: totalRework,
          wipQty: Math.max(0, maxInput - totalOutput),
          submittedBy: p.submittedBy || existing.submittedBy,
          submissionTime: p.submissionTime || existing.submissionTime
        });
      }
    }
    return Array.from(map.values());
  }

  public getWashingRecords(): WashingRecord[] {
    const map = new Map<string, WashingRecord>();
    for (const w of this.cache.washingRecords) {
      const sNo = (w.styleNo || '').trim().toUpperCase();
      const pNo = (w.poNo || '').trim().toUpperCase();
      const col = (w.colour || '').trim().toUpperCase();
      const sz = (w.size || 'All Sizes').trim().toUpperCase();
      const vendor = (w.vendorName || 'Default Vendor').trim().toUpperCase();
      const wType = (w.washType || 'Normal').trim().toUpperCase();
      const key = `${sNo}__${pNo}__${col}__${sz}__${vendor}__${wType}`;

      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...w, lastUpdateDate: w.date });
      } else {
        const latestDate = (!existing.date || (w.date && w.date > existing.date)) ? w.date : existing.date;
        const totalSent = (existing.sentQty || 0) + (w.sentQty || 0);
        const totalReceived = (existing.receivedQty || 0) + (w.receivedQty || 0);
        const totalDamage = (existing.damageQty || 0) + (w.damageQty || 0);
        const totalReject = (existing.rejectQty || 0) + (w.rejectQty || 0);
        const balance = Math.max(0, totalSent - totalReceived - totalDamage - totalReject);

        let status: any = 'Pending';
        if (totalReceived >= totalSent && totalSent > 0) {
          status = 'Completed';
        } else if (totalReceived > 0) {
          status = 'Partial';
        } else if (totalSent > 0) {
          status = 'Sent';
        }

        map.set(key, {
          ...existing,
          date: latestDate,
          lastUpdateDate: latestDate,
          sentQty: totalSent,
          receivedQty: totalReceived,
          damageQty: totalDamage,
          rejectQty: totalReject,
          balanceQty: balance,
          status,
          remarks: w.remarks || existing.remarks
        });
      }
    }
    return Array.from(map.values());
  }

  public getFinishingRecords(): FinishingRecord[] {
    const map = new Map<string, FinishingRecord>();
    for (const f of this.cache.finishingRecords) {
      const sNo = (f.styleNo || '').trim().toUpperCase();
      const pNo = (f.poNo || '').trim().toUpperCase();
      const col = (f.colour || '').trim().toUpperCase();
      const sz = (f.size || 'All Sizes').trim().toUpperCase();
      const key = `${sNo}__${pNo}__${col}__${sz}`;

      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...f, lastUpdateDate: f.date });
      } else {
        const latestDate = (!existing.date || (f.date && f.date > existing.date)) ? f.date : existing.date;
        const sewingRecv = Math.max(existing.sewingReceiveQty || 0, f.sewingReceiveQty || 0);
        const finInput = Math.max(existing.finishingInputQty || 0, f.finishingInputQty || 0);
        const tc = Math.max(existing.threadCutQty ?? 0, f.threadCutQty ?? 0);
        const ir = Math.max(existing.ironedQty || 0, f.ironedQty || 0);
        const gu = Math.max(existing.getUpQty || 0, f.getUpQty || 0);
        const fl = Math.max(existing.foldedQty || 0, f.foldedQty || 0);
        const tg = Math.max(existing.taggedQty || 0, f.taggedQty || 0);
        const pk = Math.max(existing.packedQty || 0, f.packedQty || 0);
        const py = Math.max(existing.polyQty || 0, f.polyQty || 0);
        const ct = Math.max(existing.cartonQty || 0, f.cartonQty || 0);
        const rw = Math.max(existing.reworkQty || 0, f.reworkQty || 0);
        const rj = Math.max(existing.rejectQty || 0, f.rejectQty || 0);
        const fn = Math.max(existing.finishedQty || 0, f.finishedQty || 0);
        const rs = Math.max(existing.readyForShipmentQty || 0, f.readyForShipmentQty || 0);

        map.set(key, {
          ...existing,
          date: latestDate,
          lastUpdateDate: latestDate,
          sewingReceiveQty: sewingRecv,
          finishingInputQty: finInput,
          threadCutQty: tc,
          ironedQty: ir,
          getUpQty: gu,
          foldedQty: fl,
          taggedQty: tg,
          packedQty: pk,
          polyQty: py,
          cartonQty: ct,
          reworkQty: rw,
          rejectQty: rj,
          finishedQty: fn > 0 ? fn : (pk > 0 ? pk : py),
          readyForShipmentQty: rs,
          isReadyForShipment: rs > 0 || existing.isReadyForShipment || f.isReadyForShipment,
          operator: f.operator || existing.operator
        });
      }
    }
    return Array.from(map.values());
  }

  public getQCInspections(): QCInspection[] {
    const map = new Map<string, QCInspection>();
    for (const q of this.cache.qcInspections) {
      const sNo = (q.styleNo || '').trim().toUpperCase();
      const pNo = (q.poNo || '').trim().toUpperCase();
      const col = (q.colour || '').trim().toUpperCase();
      const sz = (q.size || 'All Sizes').trim().toUpperCase();
      const type = (q.inspectionType || 'End Line QC').trim().toUpperCase();
      const line = (q.lineNo || 'Line 01').trim().toUpperCase();
      const key = `${sNo}__${pNo}__${col}__${sz}__${type}__${line}`;

      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...q, lastUpdateDate: q.date });
      } else {
        const latestDate = (!existing.date || (q.date && q.date > existing.date)) ? q.date : existing.date;
        const totalInspected = (existing.inspectedQty || 0) + (q.inspectedQty || 0);
        const totalPassed = (existing.passedQty || 0) + (q.passedQty || 0);
        const totalRework = (existing.reworkQty || 0) + (q.reworkQty || 0);
        const totalReject = (existing.rejectQty || 0) + (q.rejectQty || 0);
        const dhu = totalInspected > 0 ? Number((((totalRework + totalReject) / totalInspected) * 100).toFixed(1)) : 0;
        const result = totalReject > 0 && totalReject >= totalPassed ? 'Fail' : (totalRework > 0 ? 'Pending Rework' : 'Pass');

        map.set(key, {
          ...existing,
          date: latestDate,
          lastUpdateDate: latestDate,
          inspectedQty: totalInspected,
          passedQty: totalPassed,
          reworkQty: totalRework,
          rejectQty: totalReject,
          dhu,
          result,
          inspectorName: q.inspectorName || existing.inspectorName
        });
      }
    }
    return Array.from(map.values());
  }

  public getPackingRecords(): PackingRecord[] {
    const map = new Map<string, PackingRecord>();
    for (const p of this.cache.packingRecords) {
      const sNo = (p.styleNo || '').trim().toUpperCase();
      const pNo = (p.poNo || '').trim().toUpperCase();
      const col = (p.colour || '').trim().toUpperCase();
      const sz = (p.size || 'All Sizes').trim().toUpperCase();
      const key = `${sNo}__${pNo}__${col}__${sz}`;

      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...p, lastUpdateDate: p.date });
      } else {
        const latestDate = (!existing.date || (p.date && p.date > existing.date)) ? p.date : existing.date;
        const totalPacked = (existing.packedQty || 0) + (p.packedQty || 0);
        const totalCartons = (existing.cartonCount || 0) + (p.cartonCount || 0);
        const maxOrder = Math.max(existing.orderQty || 0, p.orderQty || 0);

        map.set(key, {
          ...existing,
          date: latestDate,
          lastUpdateDate: latestDate,
          packedQty: totalPacked,
          cartonCount: totalCartons,
          orderQty: maxOrder,
          balanceQty: Math.max(0, maxOrder - totalPacked),
          packingOfficer: p.packingOfficer || existing.packingOfficer
        });
      }
    }
    return Array.from(map.values());
  }

  public getShipmentRecords(): ShipmentRecord[] { return this.cache.shipmentRecords; }
  public getRawCuttingEntries(): CuttingEntry[] { return this.cache.cuttingEntries; }
  public getRawSewingProduction(): SewingProduction[] { return this.cache.sewingProduction; }
  public getRawWashingRecords(): WashingRecord[] { return this.cache.washingRecords; }
  public getRawFinishingRecords(): FinishingRecord[] { return this.cache.finishingRecords; }
  public getRawPackingRecords(): PackingRecord[] { return this.cache.packingRecords; }
  public getRawQCInspections(): QCInspection[] { return this.cache.qcInspections; }

  /**
   * Aggregates and calculates all items ready for shipment (Style, PO, Colour & Size-wise).
   * Automatically incorporates finishing records (poly/carton/ready-for-shipment flags),
   * subtracts already shipped quantities from shipment consignments, and computes
   * available ready qty and pending balances in real-time.
   */
  public getReadyShipmentBatches(): ReadyShipmentBatch[] {
    const orders = this.getOrders();
    const finishingRecords = this.getFinishingRecords();
    const shipmentRecords = this.getShipmentRecords();

    // Collect all unique Style, PO, Colour combinations from Orders and Finishing Records
    const batchMap = new Map<string, {
      buyer: string;
      styleNo: string;
      poNo: string;
      colour: string;
      garmentType: string;
      sizes: Set<string>;
      orderSizeMap: Record<string, number>;
      source: string;
    }>();

    // 1. From Order Styles
    orders.forEach(order => {
      const buyer = order.buyer || order.brand || 'Direct Buyer';
      const garmentType = order.garmentType || 'Garment';
      (order.purchaseOrders || []).forEach(po => {
        (po.colours || []).forEach(col => {
          const key = `${(order.styleNo || '').trim().toUpperCase()}___${(po.poNo || 'PO-MAIN').trim().toUpperCase()}___${(col.colour || 'Standard').trim().toUpperCase()}`;
          const existing = batchMap.get(key) || {
            buyer,
            styleNo: order.styleNo,
            poNo: po.poNo || 'PO-MAIN',
            colour: col.colour || 'Standard',
            garmentType,
            sizes: new Set<string>(),
            orderSizeMap: {},
            source: 'Master Order'
          };

          Object.entries(col.sizeQuantities || {}).forEach(([sz, q]) => {
            if (sz) {
              const szClean = sz.trim();
              existing.sizes.add(szClean);
              existing.orderSizeMap[szClean.toUpperCase()] = (existing.orderSizeMap[szClean.toUpperCase()] || 0) + Number(q || 0);
            }
          });

          batchMap.set(key, existing);
        });
      });
    });

    // 2. From Finishing Records (to ensure any dynamically logged styles/POs appear immediately)
    finishingRecords.forEach(f => {
      if (!f.styleNo) return;
      const sNo = f.styleNo.trim().toUpperCase();
      const pNo = (f.poNo || 'PO-MAIN').trim().toUpperCase();
      const col = (f.colour || 'Standard').trim().toUpperCase();
      const key = `${sNo}___${pNo}___${col}`;

      const existing = batchMap.get(key) || {
        buyer: f.buyer || 'Export Client',
        styleNo: f.styleNo,
        poNo: f.poNo || 'PO-MAIN',
        colour: f.colour || 'Standard',
        garmentType: 'Garment',
        sizes: new Set<string>(),
        orderSizeMap: {},
        source: 'Finishing Output'
      };

      if (f.size && f.size !== 'All Sizes') {
        existing.sizes.add(f.size.trim());
      }
      batchMap.set(key, existing);
    });

    const result: ReadyShipmentBatch[] = [];

    batchMap.forEach((batch, key) => {
      const { styleNo, poNo, colour, buyer, garmentType, sizes, orderSizeMap } = batch;

      // Filter finishing records for this batch
      const matchingFins = finishingRecords.filter(f =>
        f.styleNo?.trim().toUpperCase() === styleNo.trim().toUpperCase() &&
        (!f.poNo || !poNo || f.poNo.trim().toUpperCase() === poNo.trim().toUpperCase()) &&
        (!f.colour || !colour || f.colour.trim().toUpperCase() === colour.trim().toUpperCase())
      );

      // Filter shipment records for this batch
      const matchingShips = shipmentRecords.filter(s =>
        s.styleNo?.trim().toUpperCase() === styleNo.trim().toUpperCase() &&
        (!s.poNo || !poNo || s.poNo.trim().toUpperCase() === poNo.trim().toUpperCase()) &&
        (!s.colour || !colour || s.colour.trim().toUpperCase() === colour.trim().toUpperCase())
      );

      // Collect all sizes found in order, finishing records, or shipment records
      matchingFins.forEach(f => {
        if (f.size && f.size !== 'All Sizes') sizes.add(f.size.trim());
      });
      matchingShips.forEach(s => {
        if (s.items && s.items.length > 0) {
          s.items.forEach(it => {
            if (it.size && it.size !== 'All Sizes') sizes.add(it.size.trim());
          });
        } else if (s.size && s.size !== 'All Sizes') {
          sizes.add(s.size.trim());
        }
      });

      const sizeList = sizes.size > 0 ? Array.from(sizes) : ['S', 'M', 'L', 'XL'];

      const sizeBreakdown: ReadyShipmentSizeItem[] = sizeList.map(sz => {
        const szKey = sz.trim().toUpperCase();
        const orderQty = orderSizeMap[szKey] || 0;

        // Finishing records for this size
        const finRecordsForSize = matchingFins.filter(f =>
          f.size?.trim().toUpperCase() === szKey || f.size === 'All Sizes' || !f.size
        );

        let sizeReadyQty = 0;
        finRecordsForSize.forEach(f => {
          if (f.size?.trim().toUpperCase() === szKey) {
            if (f.readyForShipmentQty && f.readyForShipmentQty > 0) {
              sizeReadyQty += f.readyForShipmentQty;
            } else if (f.isReadyForShipment || (f.cartonQty && f.cartonQty > 0) || f.shipmentStatus === 'Ready For Shipment') {
              sizeReadyQty += (f.cartonQty ? (f.packedQty || f.finishedQty || f.cartonQty * 20 || 0) : (f.packedQty || f.finishedQty || 0));
            } else if (f.packedQty && f.packedQty > 0) {
              sizeReadyQty += f.packedQty;
            }
          } else if (f.size === 'All Sizes' || !f.size) {
            const share = sizeList.length > 0 ? 1 / sizeList.length : 1;
            if (f.readyForShipmentQty && f.readyForShipmentQty > 0) {
              sizeReadyQty += Math.round(f.readyForShipmentQty * share);
            } else if (f.isReadyForShipment || (f.cartonQty && f.cartonQty > 0) || f.shipmentStatus === 'Ready For Shipment') {
              sizeReadyQty += Math.round((f.packedQty || f.finishedQty || 0) * share);
            } else if (f.packedQty && f.packedQty > 0) {
              sizeReadyQty += Math.round(f.packedQty * share);
            }
          }
        });

        // Calculate shipped qty for this size
        let sizeShippedQty = 0;
        matchingShips.forEach(ship => {
          if (ship.items && ship.items.length > 0) {
            ship.items.forEach(it => {
              if (it.styleNo?.trim().toUpperCase() === styleNo.trim().toUpperCase() &&
                  (!it.poNo || it.poNo.trim().toUpperCase() === poNo.trim().toUpperCase()) &&
                  (!it.colour || it.colour.trim().toUpperCase() === colour.trim().toUpperCase())) {
                if (it.size?.trim().toUpperCase() === szKey) {
                  sizeShippedQty += Number(it.shippedQty || 0);
                } else if (!it.size || it.size === 'All Sizes') {
                  const share = sizeList.length > 0 ? 1 / sizeList.length : 1;
                  sizeShippedQty += Math.round(Number(it.shippedQty || 0) * share);
                }
              }
            });
          } else if (ship.size?.trim().toUpperCase() === szKey) {
            sizeShippedQty += Number(ship.shippedQty || 0);
          } else if (!ship.size || ship.size === 'All Sizes') {
            const share = sizeList.length > 0 ? 1 / sizeList.length : 1;
            sizeShippedQty += Math.round(Number(ship.shippedQty || 0) * share);
          }
        });

        const availableReadyQty = Math.max(0, sizeReadyQty - sizeShippedQty);
        const pendingQty = Math.max(0, sizeReadyQty - sizeShippedQty);
        const balanceQty = Math.max(0, orderQty - sizeShippedQty);

        const status: 'Ready for Shipment' | 'Partial Shipment' | 'Shipment Complete' =
          (sizeShippedQty >= sizeReadyQty && sizeReadyQty > 0)
            ? 'Shipment Complete'
            : (sizeShippedQty > 0 ? 'Partial Shipment' : 'Ready for Shipment');

        return {
          size: sz,
          orderQty,
          readyQty: sizeReadyQty,
          shippedQty: sizeShippedQty,
          availableReadyQty,
          pendingQty,
          balanceQty,
          status
        };
      });

      const totalOrderQty = sizeBreakdown.reduce((s, b) => s + b.orderQty, 0);
      const totalReadyQty = sizeBreakdown.reduce((s, b) => s + b.readyQty, 0);
      const totalShippedQty = sizeBreakdown.reduce((s, b) => s + b.shippedQty, 0);
      const totalPendingQty = Math.max(0, totalReadyQty - totalShippedQty);
      const cartonCount = Math.ceil(totalShippedQty / 20) || 0;

      const isComplete = (totalReadyQty > 0 && totalShippedQty >= totalReadyQty) || (totalOrderQty > 0 && totalShippedQty >= totalOrderQty);
      const status: 'Ready for Shipment' | 'Partial Shipment' | 'Shipment Complete' =
        isComplete
          ? 'Shipment Complete'
          : (totalShippedQty > 0 ? 'Partial Shipment' : 'Ready for Shipment');

      // Only include if there is ready quantity > 0 or has already been shipped
      if (totalReadyQty > 0 || totalShippedQty > 0) {
        result.push({
          key,
          buyer,
          styleNo,
          poNo,
          colour,
          garmentType,
          orderQty: totalOrderQty || (matchingFins[0]?.sewingReceiveQty || matchingFins[0]?.finishedQty || 0),
          readyQty: totalReadyQty,
          shippedQty: totalShippedQty,
          pendingQty: totalPendingQty,
          cartonCount,
          status,
          isComplete,
          sizeBreakdown,
          source: batch.source
        });
      }
    });

    return result;
  }

  public getReadyShipmentBatch(styleNo: string, poNo: string, colour: string): ReadyShipmentBatch | undefined {
    const batches = this.getReadyShipmentBatches();
    return batches.find(b =>
      b.styleNo.trim().toUpperCase() === styleNo.trim().toUpperCase() &&
      b.poNo.trim().toUpperCase() === poNo.trim().toUpperCase() &&
      b.colour.trim().toUpperCase() === colour.trim().toUpperCase()
    );
  }
  public getEmployees(): Employee[] { return this.cache.employees; }
  public getAttendance(): AttendanceRecord[] { return this.cache.attendance; }
  public getPayroll(): PayrollRecord[] { return this.cache.payroll; }
  public getAuditLogs(): AuditLog[] { return this.cache.auditLogs; }
  public getNotifications(): NotificationItem[] { return this.cache.notifications; }
  public getMasterData(): MasterDataItem[] { return this.cache.masterData; }

  public getMasterDataByCategory(category: MasterDataItem['category']): MasterDataItem[] {
    return this.cache.masterData.filter(m => m.category === category && m.status !== 'Inactive');
  }

  public getMasterValuesByCategory(category: MasterDataItem['category']): string[] {
    const list = this.getMasterDataByCategory(category);
    return Array.from(new Set(list.map(m => m.name.trim()).filter(Boolean)));
  }

  public getMasterBuyers(): string[] {
    const vals = this.getMasterValuesByCategory('Buyer');
    return vals.length > 0 ? vals : ['H&M Global', 'Zara / Inditex', 'Levi Strauss & Co.', 'Target US'];
  }

  public getMasterBrands(): string[] {
    const vals = this.getMasterValuesByCategory('Brand');
    return vals.length > 0 ? vals : ['Divided', 'Inditex Denim', 'Red Tab 501', 'Goodfellow & Co'];
  }

  public getMasterGarmentTypes(): string[] {
    const vals = this.getMasterValuesByCategory('GarmentType');
    return vals.length > 0 ? vals : ['Denim Bottom', 'Chino Pants', 'Knit T-Shirt', 'Jacket / Outerwear', 'Polo Shirt', 'Cargo Pants', 'Woven Shirt'];
  }

  public getMasterSizes(): string[] {
    const vals = this.getMasterValuesByCategory('Size');
    return vals.length > 0 ? vals : ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '28', '30', '32', '34', '36', '38', '40'];
  }

  public getMasterSizeMatrices(): { id: string; name: string; code: string; sizes: string[] }[] {
    const list = this.getMasterDataByCategory('SizeMatrix');
    if (list.length > 0) {
      return list.map(m => ({
        id: m.id,
        name: m.name,
        code: m.code,
        sizes: parseSizeMatrixDescription(m.description)
      }));
    }
    return [
      { id: 'md-sm-1', name: 'Alpha Standard (XS - 2XL)', code: 'SM-ALPHA-STD', sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL'] },
      { id: 'md-sm-2', name: 'Alpha Extended (XS - 4XL)', code: 'SM-ALPHA-EXT', sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'] },
      { id: 'md-sm-3', name: 'Waist Numeric Standard (28 - 38)', code: 'SM-NUM-STD', sizes: ['28', '30', '32', '34', '36', '38'] },
      { id: 'md-sm-4', name: 'Waist Numeric Extended (28 - 42)', code: 'SM-NUM-EXT', sizes: ['28', '29', '30', '31', '32', '33', '34', '36', '38', '40', '42'] }
    ];
  }

  public getMasterColours(): string[] {
    const vals = this.getMasterValuesByCategory('Colour');
    return vals.length > 0 ? vals : ['Indigo Blue', 'Vintage Black', 'Bleach Light Blue', 'Optical White', 'Dark Wash Blue', 'Olive Green'];
  }

  public getMasterSeasons(): string[] {
    const vals = this.getMasterValuesByCategory('Season');
    return vals.length > 0 ? vals : ['SS 2026', 'FW 2026', 'Spring 2027', 'Summer 2027', 'Winter 2027'];
  }

  public getMasterWashTypes(): string[] {
    const vals = this.getMasterValuesByCategory('WashType');
    return vals.length > 0 ? vals : ['Enzyme Wash', 'Bleach Wash', 'Stone Wash', 'Acid Wash', 'Softener Wash'];
  }

  public getMasterDefectTypes(): string[] {
    const vals = this.getMasterValuesByCategory('DefectType');
    return vals.length > 0 ? vals : ['Stitch Fault / Skip', 'Oil Stain / Dirt', 'Measurement Out of Spec', 'Fabric Hole', 'Broken Needle'];
  }

  public getMasterSewingLines(): string[] {
    const vals = this.getMasterValuesByCategory('SewingLine');
    return vals.length > 0 ? vals : ['Line 01', 'Line 02', 'Line 03', 'Line 04', 'Line 05', 'Line 06', 'Line 07', 'Line 08'];
  }

  public getMasterSuppliers(): string[] {
    const vals = this.getMasterValuesByCategory('Supplier');
    return vals.length > 0 ? vals : ['Pacific Fabrics Ltd.', 'YKK Bangladesh Ltd.', 'Coats Bangladesh', 'Avery Dennison'];
  }

  public getMasterUOMs(): string[] {
    const vals = this.getMasterValuesByCategory('UOM');
    return vals.length > 0 ? vals : ['Pcs', 'Dzn', 'Yards', 'Meters', 'Kgs', 'Gross', 'Rolls', 'Cones'];
  }

  public getMasterFabricTypes(): string[] {
    const vals = this.getMasterValuesByCategory('FabricType');
    return vals.length > 0 ? vals : ['100% Cotton Denim 12.5oz', 'Cotton Spandex Stretch Denim 11oz', 'Cotton Twill 240 GSM', 'Single Jersey 180 GSM'];
  }

  public getTransfers(): InterDeptTransfer[] { return this.cache.transfers; }
  public getTransfersByDepartment(dept: string): InterDeptTransfer[] {
    if (!dept || dept === 'All') return this.cache.transfers;
    const targetDept = (dept || '').trim().toLowerCase();
    return this.cache.transfers.filter(t => 
      (t.fromDepartment || '').trim().toLowerCase() === targetDept || 
      (t.toDepartment || '').trim().toLowerCase() === targetDept
    );
  }
  public getTransfersByStyle(styleNo: string): InterDeptTransfer[] {
    return this.cache.transfers.filter(t => t.styleNo === styleNo);
  }

  public isStyleWashGarment(styleNo: string): boolean {
    const order = this.cache.orders.find(o => o.styleNo === styleNo);
    if (order && typeof order.isWashGarment === 'boolean') {
      return order.isWashGarment;
    }
    if (order?.washType && order.washType.trim() !== '' && !order.washType.toLowerCase().includes('non-wash') && !order.washType.toLowerCase().includes('none')) {
      return true;
    }
    const gType = (order?.garmentType || '').toLowerCase();
    // Check if garment type indicates washing needed, or if explicit washing records exist
    const hasWashRecords = this.cache.washingRecords.some(w => w.styleNo === styleNo && (w.sentQty > 0 || w.receivedQty > 0));
    if (hasWashRecords) return true;
    if (gType.includes('denim') || gType.includes('jean') || gType.includes('chino') || gType.includes('wash') || gType.includes('twill')) {
      return true;
    }
    // Check explicit transfers
    const hasWashTransfer = this.cache.transfers.some(t => t.styleNo === styleNo && (t.toDepartment === 'Washing' || t.fromDepartment === 'Washing'));
    if (hasWashTransfer) return true;
    return false;
  }

  public getStylePoColourProgress(styleNo: string, poNo: string, colour: string) {
    const cuts = this.cache.cuttingEntries.filter(c => c.styleNo === styleNo && c.poNo === poNo && c.colour === colour);
    const cutQty = cuts.reduce((acc, c) => acc + (c.cutQty || 0), 0);
    const cutRejectQty = cuts.reduce((acc, c) => acc + (c.rejectQty || 0), 0);
    const bundleCount = cuts.reduce((acc, c) => acc + (c.bundleCount || 0), 0);

    const sews = this.cache.sewingProduction.filter(s => s.styleNo === styleNo && s.poNo === poNo && s.colour === colour);
    const sewInputs = sews.reduce((acc, s) => acc + (s.inputQty || 0), 0);
    const sewOutput = sews.reduce((acc, s) => acc + (s.totalOutput || 0), 0);
    const sewAlterQty = sews.reduce((acc, s) => acc + (s.alterQty || 0), 0);
    const sewRejectQty = sews.reduce((acc, s) => acc + (s.rejectQty || 0), 0);
    const sewWip = Math.max(0, sewInputs - sewOutput);

    const washes = this.cache.washingRecords.filter(w => w.styleNo === styleNo && w.poNo === poNo && w.colour === colour);
    const washSentQty = washes.reduce((acc, w) => acc + (w.sentQty || 0), 0);
    const washReceivedQty = washes.reduce((acc, w) => acc + (w.receivedQty || 0), 0);
    const washDamageQty = washes.reduce((acc, w) => acc + (w.damageQty || 0), 0);
    const washWip = Math.max(0, washSentQty - washReceivedQty);

    const fins = this.cache.finishingRecords.filter(f => f.styleNo === styleNo && f.poNo === poNo && f.colour === colour);
    const finInputQty = fins.reduce((acc, f) => acc + (f.finishingInputQty || f.sewingReceiveQty || 0), 0);
    const finQty = fins.reduce((acc, f) => acc + (f.finishedQty || 0), 0);
    const finIroned = fins.reduce((acc, f) => acc + (f.ironedQty || 0), 0);
    const finPacked = fins.reduce((acc, f) => acc + (f.packedQty || 0), 0);
    const finWip = Math.max(0, finInputQty - finQty);

    const qcs = this.cache.qcInspections.filter(q => q.styleNo === styleNo && q.poNo === poNo && q.colour === colour);
    const qcInspectedQty = qcs.reduce((acc, q) => acc + (q.inspectedQty || 0), 0);
    const qcPassedQty = qcs.filter(q => q.result === 'Pass').reduce((acc, q) => acc + (q.passedQty || 0), 0);
    const qcReworkQty = qcs.reduce((acc, q) => acc + (q.reworkQty || 0), 0);
    const qcRejectQty = qcs.reduce((acc, q) => acc + (q.rejectQty || 0), 0);
    const qcPassRate = qcInspectedQty > 0 ? Math.round((qcPassedQty / qcInspectedQty) * 100) : 100;

    const packs = this.cache.packingRecords.filter(p => p.styleNo === styleNo && p.poNo === poNo && p.colour === colour);
    const packedQty = packs.reduce((acc, p) => acc + (p.packedQty || 0), 0);
    const cartonCount = packs.reduce((acc, p) => acc + (p.cartonCount || 0), 0);

    const ships = this.cache.shipmentRecords.filter(s => s.styleNo === styleNo && s.poNo === poNo && s.colour === colour);
    let shippedQty = ships.reduce((acc, s) => acc + (s.shippedQty || 0), 0);
    
    // Also include shipments where this style/po/colour is part of multi-buyer/multi-style consignments
    let multiItemShippedQty = 0;
    this.cache.shipmentRecords.forEach(s => {
      if (s.items && s.items.length > 0) {
        s.items.forEach(it => {
          if (it.styleNo === styleNo && it.poNo === poNo && it.colour === colour) {
            multiItemShippedQty += (it.shippedQty || 0);
          }
        });
      }
    });
    if (multiItemShippedQty > 0 && shippedQty === 0) {
      shippedQty = multiItemShippedQty;
    } else if (multiItemShippedQty > 0 && shippedQty > 0) {
      shippedQty = Math.max(shippedQty, multiItemShippedQty);
    }

    // Handover transfers for this style/po/colour
    const styleTransfers = this.cache.transfers.filter(t => t.styleNo === styleNo && (!t.poNo || t.poNo === poNo) && (!t.colour || t.colour === colour));
    
    // Cutting to Sewing transfers
    const cutToSewTransfers = styleTransfers.filter(t => t.fromDepartment === 'Cutting' && t.toDepartment === 'Sewing');
    const cutToSewQty = cutToSewTransfers.reduce((sum, t) => sum + (t.quantity || 0), 0);
    const readyForSewingQty = Math.max(0, cutQty - cutToSewQty);

    // Sewing routing transfers
    const isWashGarment = this.isStyleWashGarment(styleNo);
    const sewToWashTransfers = styleTransfers.filter(t => t.fromDepartment === 'Sewing' && t.toDepartment === 'Washing');
    const sewToWashQty = sewToWashTransfers.reduce((sum, t) => sum + (t.quantity || 0), 0);
    const readyForWashQty = isWashGarment ? Math.max(0, sewOutput - sewToWashQty) : 0;

    const sewToFinishingDirectTransfers = styleTransfers.filter(t => t.fromDepartment === 'Sewing' && t.toDepartment === 'Finishing');
    const sewToFinishingDirectQty = sewToFinishingDirectTransfers.reduce((sum, t) => sum + (t.quantity || 0), 0);
    const readyForDirectFinishingQty = !isWashGarment ? Math.max(0, sewOutput - sewToFinishingDirectQty) : 0;

    // Washing to Finishing transfers
    const washToFinishingTransfers = styleTransfers.filter(t => t.fromDepartment === 'Washing' && t.toDepartment === 'Finishing');
    const washToFinishingQty = washToFinishingTransfers.reduce((sum, t) => sum + (t.quantity || 0), 0);
    const readyFromWashForFinishingQty = Math.max(0, washReceivedQty - washToFinishingQty);

    // Finishing Available input (from wash OR direct non-wash sewing)
    const totalTransfersToFinishing = sewToFinishingDirectQty + washToFinishingQty;
    const fallbackDirectInbound = isWashGarment ? washReceivedQty : sewOutput;
    const finishingInboundAvailable = totalTransfersToFinishing > 0 ? totalTransfersToFinishing : fallbackDirectInbound;

    // Ready for Packing and Ready for Shipment
    const readyForPackingQty = Math.max(0, finQty - packedQty);
    const readyForShipmentQty = Math.max(0, packedQty - shippedQty);

    let orderQty = 0;
    let realOrderQty = 0;
    let allowanceQty = 0;
    let allowancePct = 0;
    let factoryOrderQty = 0;
    let buyer = '';
    let styleName = '';
    let garmentType = '';
    let season = '';
    let deliveryDate = '';
    let orderStatus: any = 'Running';

    const order = this.cache.orders.find(o => o.styleNo === styleNo);
    if (order) {
      buyer = order.buyer || '';
      styleName = order.styleName || '';
      garmentType = order.garmentType || '';
      season = order.season || '';
      orderStatus = order.status || 'Running';
      const po = order.purchaseOrders?.find(p => p.poNo === poNo);
      if (po) {
        deliveryDate = po.deliveryDate || po.shipmentDate || '';
        const col = po.colours?.find(c => c.colour === colour);
        if (col) {
          realOrderQty = col.totalQty || 0;
          allowancePct = Number(col.allowancePct ?? po.allowancePct ?? order.allowancePct ?? 0);
          allowanceQty = Number(col.allowanceQty ?? Math.round(realOrderQty * (allowancePct / 100)));
          factoryOrderQty = Number(col.factoryQty ?? (realOrderQty + allowanceQty));
          // Factory Order Qty is the MAIN production order quantity for all departments
          orderQty = factoryOrderQty > 0 ? factoryOrderQty : realOrderQty;
        }
      }
    }

    // Department-wise Received Quantities (Cutting -> Factory Order Qty; All Other Depts -> Receive Qty)
    const effectiveFactoryTarget = factoryOrderQty > 0 ? factoryOrderQty : orderQty;
    const sewingReceivedQty = cutToSewQty > 0 ? cutToSewQty : (cutQty > 0 ? cutQty : effectiveFactoryTarget);
    const washingReceivedQty = washSentQty > 0 ? washSentQty : (sewToWashQty > 0 ? sewToWashQty : sewOutput);
    const finishingReceivedQty = finishingInboundAvailable > 0 ? finishingInboundAvailable : (finInputQty > 0 ? finInputQty : (isWashGarment ? washReceivedQty : sewOutput));
    const packingReceivedQty = finQty > 0 ? finQty : (finishingReceivedQty > 0 ? finishingReceivedQty : effectiveFactoryTarget);
    const shipmentReceivedQty = packedQty > 0 ? packedQty : (packingReceivedQty > 0 ? packingReceivedQty : effectiveFactoryTarget);

    // Balances based on Factory Order Qty for Cutting, and Receive Qty for all other departments
    const cutBalance = Math.max(0, effectiveFactoryTarget - cutQty);
    const sewBalance = Math.max(0, sewingReceivedQty - sewOutput);
    const washBalance = Math.max(0, washingReceivedQty - washReceivedQty - washDamageQty);
    const finBalance = Math.max(0, finishingReceivedQty - finQty);
    const packBalance = Math.max(0, packingReceivedQty - packedQty);
    const shipBalance = Math.max(0, shipmentReceivedQty - shippedQty);

    // Progress percentages calculated based on respective base quantities (Factory Order Qty for Cutting, Receive Qty for others)
    const cutPercentage = effectiveFactoryTarget > 0 ? Math.min(100, Math.round((cutQty / effectiveFactoryTarget) * 100)) : 0;
    const sewPercentage = sewingReceivedQty > 0 ? Math.min(100, Math.round((sewOutput / sewingReceivedQty) * 100)) : (sewOutput > 0 ? 100 : 0);
    const washPercentage = washingReceivedQty > 0 ? Math.min(100, Math.round((washReceivedQty / washingReceivedQty) * 100)) : (washReceivedQty > 0 ? 100 : 0);
    const finPercentage = finishingReceivedQty > 0 ? Math.min(100, Math.round((finQty / finishingReceivedQty) * 100)) : (finQty > 0 ? 100 : 0);
    const packPercentage = packingReceivedQty > 0 ? Math.min(100, Math.round((packedQty / packingReceivedQty) * 100)) : (packedQty > 0 ? 100 : 0);
    const shipmentPercentage = shipmentReceivedQty > 0 ? Math.min(100, Math.round((shippedQty / shipmentReceivedQty) * 100)) : (shippedQty > 0 ? 100 : 0);

    // Determine current manufacturing milestone stage
    let currentStage = 'Not Started';
    if (shippedQty >= shipmentReceivedQty && shipmentReceivedQty > 0) {
      currentStage = 'Fully Shipped';
    } else if (shippedQty > 0) {
      currentStage = `Partial Shipped (${shipmentPercentage}%)`;
    } else if (packedQty >= packingReceivedQty && packingReceivedQty > 0) {
      currentStage = 'Packed (Ready to Ship)';
    } else if (packedQty > 0) {
      currentStage = `Packing in Progress (${packPercentage}%)`;
    } else if (finQty >= finishingReceivedQty && finishingReceivedQty > 0) {
      currentStage = 'Finishing Completed';
    } else if (finQty > 0) {
      currentStage = `Finishing (${finPercentage}%)`;
    } else if (washReceivedQty > 0) {
      currentStage = 'Washing in Progress';
    } else if (sewOutput >= sewingReceivedQty && sewingReceivedQty > 0) {
      currentStage = 'Sewing Completed';
    } else if (sewOutput > 0) {
      currentStage = `Sewing in Progress (${sewPercentage}%)`;
    } else if (cutQty >= effectiveFactoryTarget && effectiveFactoryTarget > 0) {
      currentStage = 'Cutting Completed (Ready for Sew)';
    } else if (cutQty > 0) {
      currentStage = `Cutting (${cutPercentage}%)`;
    }

    // Compute Size-Wise Breakdown and Remaining Quantities
    const sizeMap: Record<string, number> = {};
    const orderStyle = this.cache.orders.find(o => o.styleNo === styleNo);
    const poObj = orderStyle?.purchaseOrders?.find(p => p.poNo === poNo);
    const colObj = poObj?.colours?.find(c => c.colour === colour);

    if (colObj && colObj.sizeQuantities && Object.keys(colObj.sizeQuantities).length > 0) {
      Object.entries(colObj.sizeQuantities).forEach(([s, q]) => {
        sizeMap[s] = Number(q) || 0;
      });
    }

    // Collect any other specific sizes logged in production records
    cuts.forEach(c => { if (c.size && c.size !== 'All Sizes' && !(c.size in sizeMap)) sizeMap[c.size] = 0; });
    sews.forEach(s => { if (s.size && s.size !== 'All Sizes' && !(s.size in sizeMap)) sizeMap[s.size] = 0; });
    fins.forEach(f => { if (f.size && f.size !== 'All Sizes' && !(f.size in sizeMap)) sizeMap[f.size] = 0; });

    if (Object.keys(sizeMap).length === 0) {
      sizeMap['All Sizes'] = realOrderQty || orderQty;
    }

    const totalSizesOrder = Object.values(sizeMap).reduce((s, v) => s + v, 0) || realOrderQty || orderQty || 1;

    // Get size-wise received quantities from transfers
    const sewReceivedSizeMap = getDepartmentReceivedSizeMap('Sewing', styleNo, poNo, colour, sizeMap, this.cache.transfers);
    const finReceivedSizeMap = getDepartmentReceivedSizeMap('Finishing', styleNo, poNo, colour, sizeMap, this.cache.transfers);

    const totalSewTransfersRecv = Object.values(sewReceivedSizeMap).reduce((a, b) => a + b, 0);
    const totalFinTransfersRecv = Object.values(finReceivedSizeMap).reduce((a, b) => a + b, 0);

    const colAllowance = Number(colObj?.allowancePct ?? poObj?.allowancePct ?? orderStyle?.allowancePct ?? 0);

    const sizeBreakdown: SizeProgressItem[] = Object.entries(sizeMap).map(([sz, szOrderQty]) => {
      let szAllowanceQty = 0;
      if (colObj?.allowanceSizeQuantities && colObj.allowanceSizeQuantities[sz] !== undefined) {
        szAllowanceQty = Number(colObj.allowanceSizeQuantities[sz]) || 0;
      } else {
        szAllowanceQty = Math.round(szOrderQty * (colAllowance / 100));
      }

      let szFactoryQty = szOrderQty + szAllowanceQty;
      if (colObj?.factorySizeQuantities && colObj.factorySizeQuantities[sz] !== undefined) {
        szFactoryQty = Number(colObj.factorySizeQuantities[sz]) || szFactoryQty;
      }

      // 1. Cutting for this size (Base: Factory Order Qty = Real Order Qty + Size Allowance Qty)
      const exactCuts = cuts.filter(c => c.size?.trim().toUpperCase() === sz.trim().toUpperCase());
      const allSizesCuts = cuts.filter(c => !c.size || c.size === 'All Sizes');
      const exactCutQty = exactCuts.reduce((acc, c) => acc + (c.cutQty || 0), 0);
      const allCutTotal = allSizesCuts.reduce((acc, c) => acc + (c.cutQty || 0), 0);
      const szCut = exactCutQty + (allCutTotal > 0 ? Math.round(allCutTotal * (szOrderQty / totalSizesOrder)) : 0);
      const cutBal = Math.max(0, szFactoryQty - szCut);
      const cutPct = szFactoryQty > 0 ? Math.min(100, Math.round((szCut / szFactoryQty) * 100)) : 0;

      // Transfers out from Cutting to Sewing for this size
      let szTransferred = 0;
      styleTransfers.filter(t => t.fromDepartment === 'Cutting' && (t.status === 'Received' || t.status === 'Dispatched' || t.status === 'In Transit')).forEach(t => {
        if (t.items && t.items.length > 0) {
          t.items.filter(it => it.size?.trim().toUpperCase() === sz.trim().toUpperCase()).forEach(it => {
            szTransferred += Number(it.quantity) || 0;
          });
        } else if (t.size?.trim().toUpperCase() === sz.trim().toUpperCase()) {
          szTransferred += Number(t.quantity) || 0;
        } else if (!t.size || t.size === 'All Sizes') {
          szTransferred += totalSizesOrder > 0 ? Math.round((Number(t.quantity) || 0) * (szOrderQty / totalSizesOrder)) : 0;
        }
      });

      // 2. Sewing for this size (Base: Sewing Receive Qty)
      const exactSews = sews.filter(s => s.size?.trim().toUpperCase() === sz.trim().toUpperCase());
      const allSizesSews = sews.filter(s => !s.size || s.size === 'All Sizes');
      const exactSewInputs = exactSews.reduce((acc, s) => acc + (s.inputQty || 0), 0);
      const allSewInputsTotal = allSizesSews.reduce((acc, s) => acc + (s.inputQty || 0), 0);
      const szSewInputs = exactSewInputs + (allSewInputsTotal > 0 ? Math.round(allSewInputsTotal * (szOrderQty / totalSizesOrder)) : 0);

      const exactSewOutput = exactSews.reduce((acc, s) => acc + (s.totalOutput || 0), 0);
      const allSewOutputTotal = allSizesSews.reduce((acc, s) => acc + (s.totalOutput || 0), 0);
      const szSewOutput = exactSewOutput + (allSewOutputTotal > 0 ? Math.round(allSewOutputTotal * (szOrderQty / totalSizesOrder)) : 0);

      // Determine size-wise receive quantity for Sewing
      const szSewReceiveQty = totalSewTransfersRecv > 0
        ? (sewReceivedSizeMap[sz] || 0)
        : (cutToSewQty > 0 ? Math.round(cutToSewQty * (szOrderQty / totalSizesOrder)) : (szCut > 0 ? szCut : szFactoryQty));
      
      const sewBal = Math.max(0, szSewReceiveQty - szSewOutput);
      const sewPct = szSewReceiveQty > 0 ? Math.min(100, Math.round((szSewOutput / szSewReceiveQty) * 100)) : (szSewOutput > 0 ? 100 : 0);

      // 3. Finishing for this size (Base: Finishing Receive Qty)
      const exactFins = fins.filter(f => f.size?.trim().toUpperCase() === sz.trim().toUpperCase());
      const allSizesFins = fins.filter(f => !f.size || f.size === 'All Sizes');
      const exactFinQty = exactFins.reduce((acc, f) => acc + (f.finishedQty || 0), 0);
      const allFinTotal = allSizesFins.reduce((acc, f) => acc + (f.finishedQty || 0), 0);
      const szFinQty = exactFinQty + (allFinTotal > 0 ? Math.round(allFinTotal * (szOrderQty / totalSizesOrder)) : 0);

      const szFinReceiveQty = totalFinTransfersRecv > 0
        ? (finReceivedSizeMap[sz] || 0)
        : (finishingInboundAvailable > 0 ? Math.round(finishingInboundAvailable * (szOrderQty / totalSizesOrder)) : (szSewOutput > 0 ? szSewOutput : szFactoryQty));

      const finBal = Math.max(0, szFinReceiveQty - szFinQty);
      const finPct = szFinReceiveQty > 0 ? Math.min(100, Math.round((szFinQty / szFinReceiveQty) * 100)) : (szFinQty > 0 ? 100 : 0);

      // 4. Packing for this size (Base: Packing Receive Qty, i.e. Finished Goods)
      let szPack = 0;
      let cartonSizeBreakdownCount = 0;
      packs.forEach(p => {
        if (p.cartons && p.cartons.length > 0) {
          p.cartons.forEach(ctn => {
            if (ctn.sizeBreakdown && ctn.sizeBreakdown[sz]) {
              szPack += Number(ctn.sizeBreakdown[sz]) || 0;
              cartonSizeBreakdownCount++;
            }
          });
        }
      });
      if (cartonSizeBreakdownCount === 0) {
        szPack = Math.round(packedQty * (szOrderQty / totalSizesOrder));
      }
      const szPackReceiveQty = szFinQty > 0 ? szFinQty : Math.round(packingReceivedQty * (szOrderQty / totalSizesOrder));
      const packBal = Math.max(0, szPackReceiveQty - szPack);
      const packPct = szPackReceiveQty > 0 ? Math.min(100, Math.round((szPack / szPackReceiveQty) * 100)) : (szPack > 0 ? 100 : 0);

      // 5. Shipment for this size (Base: Shipment Receive Qty, i.e. Packed Goods)
      const szShip = Math.round(shippedQty * (szOrderQty / totalSizesOrder));
      const szShipReceiveQty = szPack > 0 ? szPack : Math.round(shipmentReceivedQty * (szOrderQty / totalSizesOrder));
      const shipBal = Math.max(0, szShipReceiveQty - szShip);
      const shipPct = szShipReceiveQty > 0 ? Math.min(100, Math.round((szShip / szShipReceiveQty) * 100)) : (szShip > 0 ? 100 : 0);

      const qcPass = Math.round(qcPassedQty * (szOrderQty / totalSizesOrder));

      let stage = 'Not Started';
      let status: 'Pending' | 'In Progress' | 'Completed' | 'Over-produced' = 'Pending';
      if (szShip >= szShipReceiveQty && szShipReceiveQty > 0) {
        stage = 'Fully Shipped';
        status = szShip > szShipReceiveQty ? 'Over-produced' : 'Completed';
      } else if (szPack >= szPackReceiveQty && szPackReceiveQty > 0) {
        stage = 'Packed';
        status = 'In Progress';
      } else if (szFinQty >= szFinReceiveQty && szFinReceiveQty > 0) {
        stage = 'Finishing Done';
        status = 'In Progress';
      } else if (szSewOutput >= szSewReceiveQty && szSewReceiveQty > 0) {
        stage = 'Sewing Done';
        status = 'In Progress';
      } else if (szCut >= szFactoryQty && szFactoryQty > 0) {
        stage = 'Cut Ready';
        status = 'In Progress';
      } else if (szCut > 0 || szSewOutput > 0 || szFinQty > 0 || szPack > 0 || szShip > 0) {
        stage = 'In Production';
        status = 'In Progress';
      }

      return {
        size: sz,
        orderQty: szFactoryQty > 0 ? szFactoryQty : szOrderQty, // Main Order Qty is Factory Order Qty
        realOrderQty: szOrderQty,
        allowancePct: colAllowance,
        allowanceQty: szAllowanceQty,
        factoryQty: szFactoryQty,
        factoryOrderQty: szFactoryQty,
        transferredQty: szTransferred,
        receivedQty: szSewReceiveQty, // Primary Receive Qty default
        sewingReceivedQty: szSewReceiveQty,
        washingReceivedQty: szSewOutput,
        finishingReceivedQty: szFinReceiveQty,
        packingReceivedQty: szPackReceiveQty,
        shipmentReceivedQty: szShipReceiveQty,
        cutQty: szCut,
        cutBalance: cutBal,
        cutPercentage: cutPct,
        sewInputs: szSewInputs,
        sewOutput: szSewOutput,
        sewBalance: sewBal,
        sewPercentage: sewPct,
        finQty: szFinQty,
        finBalance: finBal,
        finPercentage: finPct,
        packedQty: szPack,
        packBalance: packBal,
        packPercentage: packPct,
        shippedQty: szShip,
        shipBalance: shipBal,
        shipmentPercentage: shipPct,
        qcPassedQty: qcPass,
        overallBalance: shipBal,
        currentStage: stage,
        status
      };
    });

    return {
      buyer,
      styleNo,
      styleName,
      garmentType,
      season,
      poNo,
      colour,
      deliveryDate,
      orderStatus,
      orderQty,
      realOrderQty,
      allowanceQty,
      allowancePct,
      factoryOrderQty,
      sewingReceivedQty,
      washingReceivedQty,
      finishingReceivedQty,
      packingReceivedQty,
      shipmentReceivedQty,
      isWashGarment,
      cutQty,
      cutRejectQty,
      bundleCount,
      cutBalance,
      cutPercentage,
      cutToSewQty,
      readyForSewingQty,
      sewInputs,
      sewOutput,
      sewAlterQty,
      sewRejectQty,
      sewWip,
      sewBalance,
      sewPercentage,
      sewToWashQty,
      readyForWashQty,
      sewToFinishingDirectQty,
      readyForDirectFinishingQty,
      washSentQty,
      washReceivedQty,
      washDamageQty,
      washWip,
      washBalance,
      washToFinishingQty,
      readyFromWashForFinishingQty,
      finishingInboundAvailable,
      finInputQty,
      finQty,
      finIroned,
      finPacked,
      finWip,
      finBalance,
      finPercentage,
      qcInspectedQty,
      qcPassedQty,
      qcReworkQty,
      qcRejectQty,
      qcPassRate,
      packedQty,
      cartonCount,
      packBalance,
      packPercentage,
      readyForPackingQty,
      shippedQty,
      shipBalance,
      shipmentPercentage,
      readyForShipmentQty,
      currentStage,
      sizeBreakdown,
      transfers: styleTransfers,
      records: {
        cuts,
        sews,
        washes,
        fins,
        qcs,
        packs,
        ships
      }
    };
  }

  /** Returns detailed size breakdown list with order qty, completed qty, and remaining balance */
  public getSizeBreakdownProgress(styleNo: string, poNo: string, colour: string): SizeProgressItem[] {
    const prog = this.getStylePoColourProgress(styleNo, poNo, colour);
    return prog.sizeBreakdown || [];
  }

  /** Returns size-specific progress and remaining balance in a specific production section */
  public getSizeRemaining(styleNo: string, poNo: string, colour: string, size?: string, moduleName?: string) {
    const progress = this.getStylePoColourProgress(styleNo, poNo, colour);
    const targetSize = size && size !== 'All Sizes' ? size : null;

    if (!targetSize) {
      let completed = 0;
      let balance = 0;
      let baseQty = progress.orderQty;

      if (moduleName === 'Cutting') {
        baseQty = progress.orderQty;
        completed = progress.cutQty;
        balance = progress.cutBalance;
      } else if (moduleName === 'Sewing') {
        baseQty = progress.sewingReceivedQty;
        completed = progress.sewOutput;
        balance = progress.sewBalance;
      } else if (moduleName === 'Finishing') {
        baseQty = progress.finishingReceivedQty;
        completed = progress.finQty;
        balance = progress.finBalance;
      } else if (moduleName === 'Packing') {
        baseQty = progress.packingReceivedQty;
        completed = progress.packedQty;
        balance = progress.packBalance;
      } else if (moduleName === 'Shipment') {
        baseQty = progress.shipmentReceivedQty;
        completed = progress.shippedQty;
        balance = progress.shipBalance;
      } else if (moduleName === 'Washing') {
        baseQty = progress.washingReceivedQty;
        completed = progress.washReceivedQty;
        balance = progress.washBalance;
      } else {
        baseQty = progress.orderQty;
        completed = progress.shippedQty;
        balance = progress.shipBalance;
      }

      return {
        size: 'All Sizes',
        orderQty: progress.orderQty,
        receiveQty: baseQty,
        completedQty: completed,
        remainingQty: balance,
        percentage: baseQty > 0 ? Math.round((completed / baseQty) * 100) : 0,
        sizeBreakdown: progress.sizeBreakdown
      };
    }

    const match = progress.sizeBreakdown.find(s => s.size.trim().toUpperCase() === targetSize.trim().toUpperCase());
    if (match) {
      let completed = 0;
      let balance = 0;
      let baseQty = match.orderQty;

      if (moduleName === 'Cutting') {
        baseQty = match.orderQty;
        completed = match.cutQty;
        balance = match.cutBalance;
      } else if (moduleName === 'Sewing') {
        baseQty = match.sewingReceivedQty ?? match.receivedQty ?? match.orderQty;
        completed = match.sewOutput;
        balance = match.sewBalance;
      } else if (moduleName === 'Finishing') {
        baseQty = match.finishingReceivedQty ?? match.receivedQty ?? match.orderQty;
        completed = match.finQty;
        balance = match.finBalance;
      } else if (moduleName === 'Packing') {
        baseQty = match.packingReceivedQty ?? match.receivedQty ?? match.orderQty;
        completed = match.packedQty;
        balance = match.packBalance;
      } else if (moduleName === 'Shipment') {
        baseQty = match.shipmentReceivedQty ?? match.receivedQty ?? match.orderQty;
        completed = match.shippedQty;
        balance = match.shipBalance;
      } else {
        baseQty = match.orderQty;
        completed = match.shippedQty;
        balance = match.shipBalance;
      }

      return {
        size: match.size,
        orderQty: match.orderQty,
        receiveQty: baseQty,
        completedQty: completed,
        remainingQty: balance,
        percentage: baseQty > 0 ? Math.round((completed / baseQty) * 100) : 0,
        sizeBreakdown: progress.sizeBreakdown
      };
    }

    return {
      size: targetSize,
      orderQty: 0,
      receiveQty: 0,
      completedQty: 0,
      remainingQty: 0,
      percentage: 0,
      sizeBreakdown: progress.sizeBreakdown
    };
  }

  public getAllMasterProgress() {
    const list: Array<ReturnType<typeof this.getStylePoColourProgress>> = [];
    const processedKeys = new Set<string>();

    // 1. From Order definitions
    for (const order of this.cache.orders) {
      if (order.purchaseOrders && order.purchaseOrders.length > 0) {
        for (const po of order.purchaseOrders) {
          if (po.colours && po.colours.length > 0) {
            for (const col of po.colours) {
              const key = `${order.styleNo}__${po.poNo}__${col.colour}`;
              if (!processedKeys.has(key)) {
                processedKeys.add(key);
                list.push(this.getStylePoColourProgress(order.styleNo, po.poNo, col.colour));
              }
            }
          }
        }
      }
    }

    // 2. Also check orphan operational entries that may not be in order list
    const checkOrphans = (items: Array<{ styleNo: string; poNo: string; colour: string }>) => {
      for (const item of items) {
        if (item.styleNo && item.poNo && item.colour) {
          const key = `${item.styleNo}__${item.poNo}__${item.colour}`;
          if (!processedKeys.has(key)) {
            processedKeys.add(key);
            list.push(this.getStylePoColourProgress(item.styleNo, item.poNo, item.colour));
          }
        }
      }
    };

    checkOrphans(this.cache.cuttingEntries);
    checkOrphans(this.cache.sewingProduction);
    checkOrphans(this.cache.washingRecords);
    checkOrphans(this.cache.finishingRecords);
    checkOrphans(this.cache.qcInspections);
    checkOrphans(this.cache.packingRecords);
    checkOrphans(this.cache.shipmentRecords);

    return list;
  }

  // ==========================================
  // MASTER ORDER HIERARCHY HELPER QUERIES
  // (Buyer -> PO -> Style -> Colour -> Size -> Order Qty)
  // Single Source of Truth for all ERP modules
  // ==========================================

  /** Returns distinct Buyer names from active Master Orders */
  public getBuyers(includeCompleted: boolean = true): string[] {
    const buyers = new Set<string>();
    const effectiveOrders = this.getOrders();
    for (const ord of effectiveOrders) {
      if (!includeCompleted && (ord.status === 'Completed' || ord.status === 'Shipment Complete' || ord.status === 'Cancelled')) {
        continue;
      }
      if (ord.buyer?.trim()) buyers.add(ord.buyer.trim());
    }
    // Also include buyers from Master Data if available
    for (const md of this.cache.masterData) {
      if (md.category === 'Buyer' && md.name?.trim()) {
        buyers.add(md.name.trim());
      }
    }
    return Array.from(buyers).sort();
  }

  /** Returns all Purchase Orders belonging to a specific Buyer (or all Buyers) */
  public getBuyerPOs(buyer?: string, includeCompleted: boolean = true): Array<{
    poNo: string;
    poDate?: string;
    deliveryDate?: string;
    shipmentDate?: string;
    totalPoQty: number;
    factoryPoQty?: number;
    allowanceQty?: number;
    status: OrderStatus;
    buyer: string;
    stylesCount: number;
    unitPrice?: number;
    currency?: string;
  }> {
    const poMap = new Map<string, {
      poNo: string;
      poDate?: string;
      deliveryDate?: string;
      shipmentDate?: string;
      status: OrderStatus;
      buyer: string;
      stylesSet: Set<string>;
      styleQtyMap: Map<string, number>;
      styleFactoryQtyMap: Map<string, number>;
      unitPrice?: number;
      currency?: string;
    }>();

    const effectiveOrders = this.getOrders();
    const bLower = (buyer && buyer !== 'ALL' && buyer !== 'All Buyers' && buyer.trim() !== '')
      ? buyer.trim().toLowerCase()
      : null;

    for (const order of effectiveOrders) {
      if (bLower && (order.buyer || '').trim().toLowerCase() !== bLower) {
        continue;
      }
      if (!includeCompleted && (order.status === 'Completed' || order.status === 'Shipment Complete' || order.status === 'Cancelled')) {
        continue;
      }

      for (const po of order.purchaseOrders || []) {
        if (!includeCompleted && (po.status === 'Completed' || po.status === 'Shipment Complete' || po.status === 'Cancelled')) {
          continue;
        }

        const poKey = `${(order.buyer || '').trim()}||${(po.poNo || '').trim()}`;
        const sTrim = (order.styleNo || '').trim().toUpperCase();
        const poStyleQty = Number(po.totalPoQty || 0);
        const poAllowance = Number(po.allowancePct ?? order.allowancePct ?? 0);
        let poFactoryStyleQty = Number(po.factoryPoQty) || 0;
        if (!poFactoryStyleQty) {
          if (po.colours && po.colours.length > 0) {
            poFactoryStyleQty = po.colours.reduce((sum, c) => {
              const cFact = Number(c.factoryQty) || (c.factorySizeQuantities ? Object.values(c.factorySizeQuantities).reduce<number>((a, b) => a + (Number(b) || 0), 0) : 0) || (c.allowancePct ? Math.round(c.totalQty * (1 + c.allowancePct / 100)) : (poAllowance ? Math.round(c.totalQty * (1 + poAllowance / 100)) : c.totalQty));
              return sum + cFact;
            }, 0);
          } else if (poAllowance > 0) {
            poFactoryStyleQty = Math.round(poStyleQty * (1 + poAllowance / 100));
          } else {
            poFactoryStyleQty = poStyleQty;
          }
        }

        if (!poMap.has(poKey)) {
          const styleQtyMap = new Map<string, number>();
          const styleFactoryQtyMap = new Map<string, number>();
          if (sTrim) {
            styleQtyMap.set(sTrim, poStyleQty);
            styleFactoryQtyMap.set(sTrim, poFactoryStyleQty);
          }

          poMap.set(poKey, {
            poNo: po.poNo,
            poDate: po.poDate,
            deliveryDate: po.deliveryDate,
            shipmentDate: po.shipmentDate,
            status: po.status || order.status || 'Running',
            buyer: order.buyer,
            stylesSet: new Set(sTrim ? [sTrim] : []),
            styleQtyMap,
            styleFactoryQtyMap,
            unitPrice: po.unitPrice,
            currency: po.currency || order.currency
          });
        } else {
          const existing = poMap.get(poKey)!;
          if (sTrim) {
            existing.stylesSet.add(sTrim);
            existing.styleQtyMap.set(sTrim, poStyleQty);
            existing.styleFactoryQtyMap.set(sTrim, poFactoryStyleQty);
          }
        }
      }
    }

    return Array.from(poMap.values()).map(p => {
      const totalPoQty = Array.from(p.styleQtyMap.values()).reduce((sum, q) => sum + (q || 0), 0);
      const factoryPoQty = Array.from(p.styleFactoryQtyMap.values()).reduce((sum, q) => sum + (q || 0), 0);
      return {
        poNo: p.poNo,
        poDate: p.poDate,
        deliveryDate: p.deliveryDate,
        shipmentDate: p.shipmentDate,
        totalPoQty,
        factoryPoQty: factoryPoQty > 0 ? factoryPoQty : totalPoQty,
        allowanceQty: Math.max(0, factoryPoQty - totalPoQty),
        status: p.status,
        buyer: p.buyer,
        stylesCount: p.stylesSet.size,
        unitPrice: p.unitPrice,
        currency: p.currency
      };
    }).sort((a, b) => a.poNo.localeCompare(b.poNo));
  }

  /** Returns all Styles belonging to a specific Purchase Order (and optional Buyer) */
  public getPOStyles(poNo: string, buyer?: string, includeCompleted: boolean = true): OrderStyle[] {
    if (!poNo) return [];
    const pTrim = poNo.trim().toUpperCase();
    const bLower = (buyer && buyer !== 'ALL' && buyer !== 'All Buyers' && buyer.trim() !== '')
      ? buyer.trim().toLowerCase()
      : null;

    const effectiveOrders = this.getOrders();
    const matchingStyles: OrderStyle[] = [];

    for (const order of effectiveOrders) {
      if (bLower && (order.buyer || '').trim().toLowerCase() !== bLower) {
        continue;
      }
      if (!includeCompleted && (order.status === 'Completed' || order.status === 'Shipment Complete' || order.status === 'Cancelled')) {
        continue;
      }

      const hasPo = (order.purchaseOrders || []).some(p => {
        if (!includeCompleted && (p.status === 'Completed' || p.status === 'Shipment Complete' || p.status === 'Cancelled')) {
          return false;
        }
        return (p.poNo || '').trim().toUpperCase() === pTrim;
      });

      if (hasPo) {
        matchingStyles.push(order);
      }
    }

    return matchingStyles;
  }

  /**
   * Returns structured Purchase Orders according to Master Hierarchy: Buyer -> PO -> Multiple Styles -> Colours -> Sizes
   */
  public getStructuredPurchaseOrders(buyer?: string, includeCompleted: boolean = true): Array<{
    poNo: string;
    buyer: string;
    brand: string;
    poDate: string;
    deliveryDate: string;
    shipmentDate: string;
    unitPrice: number;
    currency: 'USD' | 'BDT' | 'EUR';
    status: OrderStatus;
    remarks?: string;
    totalOrderQty: number;
    totalFactoryQty: number;
    totalValue: number;
    stylesCount: number;
    styles: Array<{
      styleNo: string;
      styleName: string;
      garmentType: string;
      season: string;
      allowancePct: number;
      factoryOrderQty: number;
      totalOrderQty: number;
      unitPrice: number;
      totalValue: number;
      isWashGarment?: boolean;
      washType?: string;
      colours: ColourQty[];
    }>;
    createdBy?: string;
    createdDepartment?: string;
    creatorEmail?: string;
    createdAt?: string;
  }> {
    const poMap = new Map<string, {
      poNo: string;
      buyer: string;
      brand: string;
      poDate: string;
      deliveryDate: string;
      shipmentDate: string;
      unitPrice: number;
      currency: 'USD' | 'BDT' | 'EUR';
      status: OrderStatus;
      remarks?: string;
      stylesMap: Map<string, {
        styleNo: string;
        styleName: string;
        garmentType: string;
        season: string;
        allowancePct: number;
        allowanceQty?: number;
        factoryOrderQty: number;
        totalOrderQty: number;
        unitPrice: number;
        totalValue: number;
        isWashGarment?: boolean;
        washType?: string;
        colours: ColourQty[];
      }>;
      createdBy?: string;
      createdDepartment?: string;
      creatorEmail?: string;
      createdAt?: string;
    }>();

    const effectiveOrders = this.getOrders();
    const bLower = (buyer && buyer !== 'ALL' && buyer !== 'All Buyers' && buyer.trim() !== '')
      ? buyer.trim().toLowerCase()
      : null;

    for (const order of effectiveOrders) {
      if (bLower && (order.buyer || '').trim().toLowerCase() !== bLower) {
        continue;
      }
      if (!includeCompleted && (order.status === 'Completed' || order.status === 'Shipment Complete' || order.status === 'Cancelled')) {
        continue;
      }

      for (const po of order.purchaseOrders || []) {
        if (!includeCompleted && (po.status === 'Completed' || po.status === 'Shipment Complete' || po.status === 'Cancelled')) {
          continue;
        }

        const poKey = `${(order.buyer || '').trim()}||${(po.poNo || '').trim()}`;
        if (!poMap.has(poKey)) {
          poMap.set(poKey, {
            poNo: po.poNo,
            buyer: order.buyer,
            brand: order.brand,
            poDate: po.poDate || '',
            deliveryDate: po.deliveryDate || '',
            shipmentDate: po.shipmentDate || '',
            unitPrice: po.unitPrice || 0,
            currency: po.currency || order.currency || 'USD',
            status: po.status || order.status || 'Running',
            remarks: po.remarks || '',
            stylesMap: new Map(),
            createdBy: order.createdBy || order.created_by,
            createdDepartment: order.createdDepartment || order.created_department,
            creatorEmail: order.creatorEmail || order.creator_email,
            createdAt: order.createdAt
          });
        }

        const poRecord = poMap.get(poKey)!;
        const styleAllowance = Number(po.allowancePct ?? order.allowancePct ?? 0);
        
        const cleanColours: ColourQty[] = (po.colours || []).map(c => {
          const colAllowance = Number(c.allowancePct ?? styleAllowance);
          const sizeWise = calculateSizeWiseAllowance(c.sizeQuantities || {}, colAllowance);
          const colOrderQty = sizeWise.totalOrderQty > 0 ? sizeWise.totalOrderQty : (Number(c.totalQty) || 0);
          const colFactoryQty = Number(c.factoryQty) || (sizeWise.totalFactoryQty > 0 ? sizeWise.totalFactoryQty : Math.round(colOrderQty * (1 + colAllowance / 100)));
          const colAllowanceQty = Math.max(0, colFactoryQty - colOrderQty);

          return {
            colour: c.colour,
            totalQty: colOrderQty,
            allowancePct: colAllowance,
            allowanceQty: colAllowanceQty,
            factoryQty: colFactoryQty,
            sizeQuantities: sizeWise.sizeQuantities,
            factorySizeQuantities: sizeWise.factorySizeQuantities,
            allowanceSizeQuantities: sizeWise.allowanceSizeQuantities
          };
        });

        const styleOrderQty = cleanColours.length > 0
          ? cleanColours.reduce((sum, c) => sum + c.totalQty, 0)
          : (Number(po.totalPoQty) || 0);
        const styleFactoryQty = cleanColours.length > 0
          ? cleanColours.reduce((sum, c) => sum + (c.factoryQty || c.totalQty), 0)
          : (Number(po.factoryPoQty) || Math.round(styleOrderQty * (1 + styleAllowance / 100)));
        const styleAllowanceQty = Math.max(0, styleFactoryQty - styleOrderQty);
        const styleUnitPrice = Number(po.unitPrice || poRecord.unitPrice || 0);
        const styleValue = Number(po.totalValue || (styleOrderQty * styleUnitPrice));

        poRecord.stylesMap.set(order.styleNo.trim().toUpperCase(), {
          styleNo: order.styleNo,
          styleName: order.styleName,
          garmentType: order.garmentType,
          season: order.season,
          allowancePct: styleAllowance,
          allowanceQty: styleAllowanceQty,
          factoryOrderQty: styleFactoryQty,
          totalOrderQty: styleOrderQty,
          unitPrice: styleUnitPrice,
          totalValue: styleValue,
          isWashGarment: order.isWashGarment !== undefined ? order.isWashGarment : this.isStyleWashGarment(order.styleNo),
          washType: order.washType || '',
          colours: cleanColours
        });
      }
    }

    return Array.from(poMap.values()).map(p => {
      const stylesList = Array.from(p.stylesMap.values());
      const totalOrderQty = stylesList.reduce((sum, s) => sum + (s.totalOrderQty || 0), 0);
      const totalFactoryQty = stylesList.reduce((sum, s) => sum + (s.factoryOrderQty || s.totalOrderQty || 0), 0);
      const totalAllowanceQty = Math.max(0, totalFactoryQty - totalOrderQty);
      const totalValue = stylesList.reduce((sum, s) => sum + (s.totalValue || (s.totalOrderQty * s.unitPrice) || 0), 0);

      return {
        poNo: p.poNo,
        buyer: p.buyer,
        brand: p.brand,
        poDate: p.poDate,
        deliveryDate: p.deliveryDate,
        shipmentDate: p.shipmentDate,
        unitPrice: p.unitPrice,
        currency: p.currency,
        status: p.status,
        remarks: p.remarks,
        totalOrderQty,
        totalFactoryQty,
        totalAllowanceQty,
        allowancePct: stylesList.length > 0 ? stylesList[0].allowancePct : 0,
        totalValue,
        stylesCount: stylesList.length,
        styles: stylesList,
        createdBy: p.createdBy,
        createdDepartment: p.createdDepartment,
        creatorEmail: p.creatorEmail,
        createdAt: p.createdAt
      };
    }).sort((a, b) => a.poNo.localeCompare(b.poNo));
  }

  /**
   * Saves a Purchase Order with multiple Styles under it: Buyer -> PO -> Multiple Styles -> Colours -> Sizes.
   * Completely isolates each PO's style data so it never leaks or mixes with another PO.
   * Strictly idempotent: editing and saving replaces existing records without accumulating quantity or volume.
   */
  public async savePOWithMultipleStyles(params: {
    poNo: string;
    originalPoNo?: string;
    buyer: string;
    brand: string;
    poDate: string;
    deliveryDate: string;
    shipmentDate: string;
    unitPrice: number;
    currency: 'USD' | 'BDT' | 'EUR';
    status: OrderStatus;
    remarks?: string;
    styles: Array<{
      styleNo: string;
      styleName: string;
      garmentType: string;
      season: string;
      allowancePct?: number;
      unitPrice?: number;
      isWashGarment?: boolean;
      washType?: string;
      colours: Array<{
        colour: string;
        totalQty: number;
        allowancePct?: number;
        factoryQty?: number;
        sizeQuantities: Record<string, number>;
      }>;
    }>;
    activeUser?: string;
    userDept?: string;
    userEmail?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const {
      poNo,
      originalPoNo,
      buyer,
      brand,
      poDate,
      deliveryDate,
      shipmentDate,
      unitPrice,
      currency,
      status,
      remarks,
      styles,
      activeUser,
      userDept,
      userEmail
    } = params;

    const pTrim = poNo.trim().toUpperCase();
    const origTrim = (originalPoNo || '').trim().toUpperCase();

    if (!pTrim) {
      return { success: false, error: 'Purchase Order number (PO No) is required.' };
    }
    if (!buyer.trim()) {
      return { success: false, error: 'Buyer Name is required.' };
    }
    if (!styles || styles.length === 0) {
      return { success: false, error: 'At least one Style must be assigned to this Purchase Order.' };
    }

    const currentOrders = [...this.cache.orders];
    const targetStyleNos = new Set(styles.map(s => s.styleNo.trim().toUpperCase()));

    // 1. Remove old PO or renamed PO from any style that is NOT in the new styles list
    for (let i = 0; i < currentOrders.length; i++) {
      const ord = currentOrders[i];
      const isSameBuyer = (ord.buyer || '').trim().toLowerCase() === buyer.trim().toLowerCase();
      const isTargetStyle = targetStyleNos.has(ord.styleNo.trim().toUpperCase());

      if (isSameBuyer && (!isTargetStyle || (origTrim && origTrim !== pTrim))) {
        const remainingPOs = (ord.purchaseOrders || []).filter(p => {
          const pNo = (p.poNo || '').trim().toUpperCase();
          if (!isTargetStyle && pNo === pTrim) return false;
          if (origTrim && pNo === origTrim) return false;
          return true;
        });

        if (remainingPOs.length !== (ord.purchaseOrders || []).length) {
          ord.purchaseOrders = remainingPOs;
          ord.totalOrderQty = remainingPOs.reduce((sum, p) => sum + (p.totalPoQty || 0), 0);
          ord.totalOrderValue = remainingPOs.reduce((sum, p) => sum + (p.totalValue || 0), 0);
          ord.factoryOrderQty = remainingPOs.reduce((sum, p) => sum + (p.factoryPoQty || p.totalPoQty || 0), 0);
          ord.updatedAt = new Date().toISOString();
        }
      }
    }

    // 2. Process and save each style under this PO
    for (let sIdx = 0; sIdx < styles.length; sIdx++) {
      const st = styles[sIdx];
      const sTrim = st.styleNo.trim().toUpperCase();
      const styleAllowance = Number(st.allowancePct ?? 0);
      const styleUnitPrice = Number(st.unitPrice || unitPrice || 0);

      // Sanitize colours and compute exact size quantities (Rule: Order Qty = Current Size Matrix Total)
      const validColours: ColourQty[] = (st.colours || [])
        .filter(c => c.colour.trim() !== '')
        .map(c => {
          const colAllowance = Number(c.allowancePct ?? styleAllowance);
          const sizeWise = calculateSizeWiseAllowance(c.sizeQuantities || {}, colAllowance);

          const colOrderQty = sizeWise.totalOrderQty > 0 ? sizeWise.totalOrderQty : (Number(c.totalQty) || 0);
          const colFactoryQty = sizeWise.totalFactoryQty > 0 ? sizeWise.totalFactoryQty : Math.round(colOrderQty * (1 + colAllowance / 100));
          const colAllowanceQty = Math.max(0, colFactoryQty - colOrderQty);

          return {
            colour: c.colour.trim(),
            totalQty: colOrderQty,
            allowancePct: colAllowance,
            allowanceQty: colAllowanceQty,
            factoryQty: colFactoryQty,
            sizeQuantities: sizeWise.sizeQuantities,
            factorySizeQuantities: sizeWise.factorySizeQuantities,
            allowanceSizeQuantities: sizeWise.allowanceSizeQuantities
          };
        });

      const stylePoQty = validColours.reduce((sum, c) => sum + c.totalQty, 0);
      const stylePoFactoryQty = validColours.reduce((sum, c) => sum + (c.factoryQty || c.totalQty), 0);
      const stylePoAllowanceQty = Math.max(0, stylePoFactoryQty - stylePoQty);
      const stylePoValue = stylePoQty * styleUnitPrice;

      // Find if existing style order has this PO already
      const existingOrder = currentOrders.find(
        o => o.styleNo.trim().toUpperCase() === sTrim &&
             (o.buyer || '').trim().toLowerCase() === buyer.trim().toLowerCase()
      ) || currentOrders.find(o => o.styleNo.trim().toUpperCase() === sTrim);

      const existingPo = existingOrder?.purchaseOrders?.find(
        p => (p.poNo || '').trim().toUpperCase() === pTrim ||
             (origTrim && (p.poNo || '').trim().toUpperCase() === origTrim)
      );

      const poId = existingPo?.id ? ensureValidUUID(existingPo.id) : generateUUID();

      const newPoItem: PurchaseOrder = {
        id: poId,
        poNo: pTrim,
        poDate: poDate || new Date().toISOString().substring(0, 10),
        deliveryDate: deliveryDate || '',
        shipmentDate: shipmentDate || '',
        unitPrice: styleUnitPrice,
        currency,
        totalValue: stylePoValue,
        totalPoQty: stylePoQty,
        allowancePct: styleAllowance,
        allowanceQty: stylePoAllowanceQty,
        factoryPoQty: stylePoFactoryQty,
        status: status || 'Running',
        remarks: remarks || '',
        colours: validColours
      };

      const isWash = st.isWashGarment !== undefined ? Boolean(st.isWashGarment) : (existingOrder?.isWashGarment ?? this.isStyleWashGarment(sTrim));
      const washType = st.washType !== undefined ? st.washType : (existingOrder?.washType || (isWash ? 'Enzyme Wash' : ''));

      if (existingOrder) {
        // Filter out existing PO record(s) matching pTrim or origTrim so it is strictly REPLACED, never appended/duplicated
        const filteredPos = (existingOrder.purchaseOrders || []).filter(
          p => (p.poNo || '').trim().toUpperCase() !== pTrim &&
               (!origTrim || (p.poNo || '').trim().toUpperCase() !== origTrim)
        );
        const updatedPos = [...filteredPos, newPoItem];

        existingOrder.buyer = buyer.trim();
        existingOrder.brand = brand.trim();
        existingOrder.styleName = st.styleName.trim() || existingOrder.styleName;
        existingOrder.garmentType = st.garmentType || existingOrder.garmentType;
        existingOrder.season = st.season || existingOrder.season;
        existingOrder.isWashGarment = isWash;
        existingOrder.washType = washType;
        existingOrder.status = status || existingOrder.status || 'Running';
        existingOrder.allowancePct = styleAllowance;
        existingOrder.allowanceQty = updatedPos.reduce((sum, p) => sum + (p.allowanceQty || 0), 0);
        existingOrder.purchaseOrders = updatedPos;
        existingOrder.totalOrderQty = updatedPos.reduce((sum, p) => sum + (p.totalPoQty || 0), 0);
        existingOrder.factoryOrderQty = updatedPos.reduce((sum, p) => sum + (p.factoryPoQty || p.totalPoQty || 0), 0);
        existingOrder.totalOrderValue = updatedPos.reduce((sum, p) => sum + (p.totalValue || 0), 0);
        existingOrder.updatedAt = new Date().toISOString();
        await this.saveOrder(existingOrder, activeUser);
      } else {
        const newOrderId = generateUUID();
        const newOrder: OrderStyle = {
          id: newOrderId,
          buyer: buyer.trim(),
          brand: brand.trim(),
          styleNo: sTrim,
          styleName: st.styleName.trim() || 'Garment Style',
          garmentType: st.garmentType || 'Denim Bottom',
          season: st.season || 'SS 2026',
          isWashGarment: isWash,
          washType,
          allowancePct: styleAllowance,
          allowanceQty: stylePoAllowanceQty,
          factoryOrderQty: stylePoFactoryQty,
          purchaseOrders: [newPoItem],
          totalOrderQty: stylePoQty,
          totalOrderValue: stylePoValue,
          currency,
          status: status || 'Running',
          createdBy: activeUser || 'Merchandising',
          created_by: activeUser || 'Merchandising',
          createdDepartment: userDept || 'Merchandising',
          created_department: userDept || 'Merchandising',
          creatorEmail: userEmail,
          creator_email: userEmail,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await this.saveOrder(newOrder, activeUser);
      }
    }

    await this.addAuditLog(
      activeUser || 'Merchandiser',
      'DEPT_USER',
      'Order Management',
      'Save PO with Multiple Styles',
      'Order Management',
      pTrim,
      undefined,
      `PO: ${pTrim} (${styles.length} Styles, Buyer: ${buyer}, Status: ${status || 'Running'})`
    );

    this.notify();
    return { success: true };
  }

  /**
   * Updates status of all purchase orders matching poNo across all styles
   */
  public async updatePOStatus(
    poNo: string,
    newStatus: OrderStatus,
    buyer?: string,
    activeUser?: string
  ): Promise<{ success: boolean; error?: string }> {
    const pTrim = poNo.trim().toUpperCase();
    const currentOrders = this.getOrders();
    let updatedAny = false;

    for (const order of currentOrders) {
      const isTargetBuyer = !buyer || (order.buyer || '').trim().toLowerCase() === buyer.trim().toLowerCase();
      if (!isTargetBuyer) continue;

      let stylePoModified = false;
      const updatedPos = (order.purchaseOrders || []).map(p => {
        if ((p.poNo || '').trim().toUpperCase() === pTrim) {
          stylePoModified = true;
          return { ...p, status: newStatus };
        }
        return p;
      });

      if (stylePoModified) {
        order.purchaseOrders = updatedPos;
        // If all POs have the same status or order is updated
        order.status = newStatus;
        order.updatedAt = new Date().toISOString();
        await this.saveOrder(order, activeUser);
        updatedAny = true;
      }
    }

    if (updatedAny) {
      await this.addAuditLog(
        activeUser || 'Merchandiser',
        'DEPT_USER',
        'Order Management',
        'Update PO Status',
        'Order Management',
        pTrim,
        newStatus,
        `Updated PO ${pTrim} status to ${newStatus}`
      );
      this.notify();
      return { success: true };
    }

    return { success: false, error: `Purchase Order ${pTrim} not found.` };
  }

  /**
   * Updates status of a specific Style
   */
  public async updateStyleStatus(
    styleNo: string,
    newStatus: OrderStatus,
    activeUser?: string
  ): Promise<{ success: boolean; error?: string }> {
    const sTrim = styleNo.trim().toUpperCase();
    const order = this.cache.orders.find(o => o.styleNo.trim().toUpperCase() === sTrim);
    if (!order) {
      return { success: false, error: `Style ${sTrim} not found.` };
    }

    order.status = newStatus;
    // Also update PO statuses under this style
    order.purchaseOrders = (order.purchaseOrders || []).map(p => ({
      ...p,
      status: newStatus
    }));
    order.updatedAt = new Date().toISOString();

    const res = await this.saveOrder(order, activeUser);
    if (res.success) {
      await this.addAuditLog(
        activeUser || 'Merchandiser',
        'DEPT_USER',
        'Order Management',
        'Update Style Status',
        'Order Management',
        sTrim,
        newStatus,
        `Updated Style ${sTrim} status to ${newStatus}`
      );
      this.notify();
    }
    return res;
  }

  /**
   * Updates Wash information (isWashGarment, washType) for a specific Style
   */
  public async updateStyleWashInfo(
    styleNo: string,
    isWashGarment: boolean,
    washType?: string,
    activeUser?: string
  ): Promise<{ success: boolean; error?: string }> {
    const sTrim = styleNo.trim().toUpperCase();
    const order = this.cache.orders.find(o => o.styleNo.trim().toUpperCase() === sTrim);
    if (!order) {
      return { success: false, error: `Style ${sTrim} not found.` };
    }

    order.isWashGarment = isWashGarment;
    order.washType = washType || (isWashGarment ? 'Enzyme Wash' : '');
    order.updatedAt = new Date().toISOString();

    const res = await this.saveOrder(order, activeUser);
    if (res.success) {
      await this.addAuditLog(
        activeUser || 'Merchandiser',
        'DEPT_USER',
        'Order Management',
        'Update Wash Info',
        'Order Management',
        sTrim,
        undefined,
        `Updated Style ${sTrim} wash to: ${isWashGarment ? `Wash Required (${washType || 'Enzyme Wash'})` : 'Non-Wash Direct'}`
      );
      this.notify();
    }
    return res;
  }

  /**
   * Deletes a Purchase Order across all linked Styles
   */
  public async deletePurchaseOrder(poNo: string, buyer?: string, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    const pTrim = poNo.trim().toUpperCase();
    const currentOrders = this.getOrders();

    for (const order of currentOrders) {
      const hasThisPo = (order.purchaseOrders || []).some(p => (p.poNo || '').trim().toUpperCase() === pTrim);
      if (hasThisPo) {
        const remainingPOs = (order.purchaseOrders || []).filter(p => (p.poNo || '').trim().toUpperCase() !== pTrim);
        if (remainingPOs.length === 0) {
          await this.deleteOrder(order.id, activeUser);
        } else {
          order.purchaseOrders = remainingPOs;
          order.totalOrderQty = remainingPOs.reduce((sum, p) => sum + (p.totalPoQty || 0), 0);
          order.totalOrderValue = remainingPOs.reduce((sum, p) => sum + (p.totalValue || 0), 0);
          order.updatedAt = new Date().toISOString();
          await this.saveOrder(order, activeUser);
        }
      }
    }

    await this.addAuditLog(
      activeUser || 'Merchandiser',
      'DEPT_USER',
      'Order Management',
      'Delete Purchase Order',
      'Order Management',
      pTrim,
      pTrim,
      `Deleted PO ${pTrim}`
    );

    this.notify();
    return { success: true };
  }

  /**
   * Checks if a Purchase Order has existing production, washing, finishing, packing, shipment, or transfer history
   */
  public checkPoProductionHistory(poNo: string): {
    hasHistory: boolean;
    cuttingCount: number;
    sewingCount: number;
    washingCount: number;
    finishingCount: number;
    qcCount: number;
    packingCount: number;
    shipmentCount: number;
    transferCount: number;
    totalRecords: number;
    details: string[];
  } {
    const pTrim = poNo?.trim().toUpperCase() || '';
    if (!pTrim) {
      return {
        hasHistory: false,
        cuttingCount: 0,
        sewingCount: 0,
        washingCount: 0,
        finishingCount: 0,
        qcCount: 0,
        packingCount: 0,
        shipmentCount: 0,
        transferCount: 0,
        totalRecords: 0,
        details: []
      };
    }

    const cuttingCount = (this.cache.cuttingEntries || []).filter(c => (c.poNo || '').trim().toUpperCase() === pTrim).length;
    const sewingCount = (this.cache.sewingProduction || []).filter(s => (s.poNo || '').trim().toUpperCase() === pTrim).length;
    const washingCount = (this.cache.washingRecords || []).filter(w => (w.poNo || '').trim().toUpperCase() === pTrim).length;
    const finishingCount = (this.cache.finishingRecords || []).filter(f => (f.poNo || '').trim().toUpperCase() === pTrim).length;
    const qcCount = (this.cache.qcInspections || []).filter(q => (q.poNo || '').trim().toUpperCase() === pTrim).length;
    const packingCount = (this.cache.packingRecords || []).filter(pk => (pk.poNo || '').trim().toUpperCase() === pTrim).length;
    const shipmentCount = (this.cache.shipmentRecords || []).filter(sh => (sh.poNo || '').trim().toUpperCase() === pTrim).length;
    const transferCount = (this.cache.transfers || []).filter(t => (t.poNo || '').trim().toUpperCase() === pTrim).length;

    const totalRecords = cuttingCount + sewingCount + washingCount + finishingCount + qcCount + packingCount + shipmentCount + transferCount;
    const details: string[] = [];
    if (cuttingCount > 0) details.push(`${cuttingCount} Cutting record(s)`);
    if (sewingCount > 0) details.push(`${sewingCount} Sewing production entry/entries`);
    if (washingCount > 0) details.push(`${washingCount} Washing record(s)`);
    if (finishingCount > 0) details.push(`${finishingCount} Finishing record(s)`);
    if (qcCount > 0) details.push(`${qcCount} QC inspection(s)`);
    if (packingCount > 0) details.push(`${packingCount} Packing record(s)`);
    if (shipmentCount > 0) details.push(`${shipmentCount} Shipment record(s)`);
    if (transferCount > 0) details.push(`${transferCount} Inter-dept transfer(s)`);

    return {
      hasHistory: totalRecords > 0,
      cuttingCount,
      sewingCount,
      washingCount,
      finishingCount,
      qcCount,
      packingCount,
      shipmentCount,
      transferCount,
      totalRecords,
      details
    };
  }

  /** Returns all OrderStyles, optionally filtered by buyer and completion status */
  public getStyles(buyer?: string, includeCompleted: boolean = true): OrderStyle[] {
    const effectiveOrders = this.getOrders();
    let filtered = effectiveOrders;
    if (buyer && buyer !== 'ALL' && buyer !== 'All Buyers' && buyer.trim() !== '') {
      const bLower = (buyer || '').trim().toLowerCase();
      filtered = filtered.filter(o => (o.buyer || '').trim().toLowerCase() === bLower);
    }
    if (!includeCompleted) {
      filtered = filtered.filter(o => o.status !== 'Completed' && o.status !== 'Shipment Complete' && o.status !== 'Cancelled');
    }
    return filtered;
  }

  /** Returns all PurchaseOrders under a specific Style */
  public getPurchaseOrders(styleNo: string, includeCompleted: boolean = true): PurchaseOrder[] {
    if (!styleNo) return [];
    const sTrim = styleNo.trim().toUpperCase();
    const effectiveOrders = this.getOrders();
    const order = effectiveOrders.find(o => o.styleNo?.trim().toUpperCase() === sTrim);
    if (!order) return [];
    let pos = order.purchaseOrders || [];
    if (!includeCompleted) {
      pos = pos.filter(p => p.status !== 'Completed' && p.status !== 'Shipment Complete' && p.status !== 'Cancelled');
    }
    return pos;
  }

  /** Returns all Colours and their booked quantities under a specific Style + PO */
  public getColours(styleNo: string, poNo: string, includeCompleted: boolean = true): ColourQty[] {
    if (!styleNo || !poNo) return [];
    const pos = this.getPurchaseOrders(styleNo, includeCompleted);
    const pTrim = poNo.trim().toUpperCase();
    const po = pos.find(p => p.poNo?.trim().toUpperCase() === pTrim);
    if (!po) return [];
    return po.colours || [];
  }

  /** Alias for getColours */
  public getStyleColours(styleNo: string, poNo: string, includeCompleted: boolean = true): ColourQty[] {
    return this.getColours(styleNo, poNo, includeCompleted);
  }

  /** Returns available sizes and breakdown for a specific Style + PO + Colour */
  public getSizes(styleNo: string, poNo: string, colour: string): { sizes: string[]; sizeQuantities: Record<string, number>; totalQty: number } {
    if (!styleNo || !poNo || !colour) {
      return { sizes: ['All Sizes'], sizeQuantities: {}, totalQty: 0 };
    }
    const colours = this.getColours(styleNo, poNo, true);
    const cTrim = colour.trim().toUpperCase();
    const targetCol = colours.find(c => c.colour?.trim().toUpperCase() === cTrim);
    if (!targetCol) {
      return { sizes: ['All Sizes'], sizeQuantities: {}, totalQty: 0 };
    }
    const sizeKeys = targetCol.sizeQuantities ? Object.keys(targetCol.sizeQuantities).filter(k => (targetCol.sizeQuantities[k] || 0) > 0) : [];
    return {
      sizes: sizeKeys.length > 0 ? sizeKeys : ['All Sizes'],
      sizeQuantities: targetCol.sizeQuantities || {},
      totalQty: targetCol.totalQty || 0
    };
  }

  /** Alias for getSizes */
  public getColourSizes(styleNo: string, poNo: string, colour: string): { sizes: string[]; sizeQuantities: Record<string, number>; totalQty: number } {
    return this.getSizes(styleNo, poNo, colour);
  }

  /** Returns complete Master Order Details with live production progress and balances */
  public getMasterOrderDetails(styleNo: string, poNo: string, colour: string, size?: string) {
    const sTrim = styleNo?.trim().toUpperCase() || '';
    const pTrim = poNo?.trim().toUpperCase() || '';
    const cTrim = colour?.trim().toUpperCase() || '';

    const effectiveOrders = this.getOrders();
    const order = effectiveOrders.find(o => o.styleNo?.trim().toUpperCase() === sTrim);
    const po = order?.purchaseOrders?.find(p => p.poNo?.trim().toUpperCase() === pTrim);
    const col = po?.colours?.find(c => c.colour?.trim().toUpperCase() === cTrim);

    const progress = this.getStylePoColourProgress(styleNo, poNo, colour);

    const sizeQuantities = col?.sizeQuantities || {};
    const sizeKeys = Object.keys(sizeQuantities);

    const selectedSizeKey = size || (sizeKeys.length > 0 ? sizeKeys[0] : 'All Sizes');
    const selectedSizeBreakdown = progress.sizeBreakdown.find(s => s.size.trim().toUpperCase() === selectedSizeKey.trim().toUpperCase()) || null;

    return {
      orderId: order?.id,
      buyer: order?.buyer || progress.buyer || 'Unknown Buyer',
      brand: order?.brand || '',
      styleNo: order?.styleNo || styleNo,
      styleName: order?.styleName || progress.styleName || 'Garment Style',
      garmentType: order?.garmentType || progress.garmentType || 'Garments',
      season: order?.season || progress.season || 'Standard',
      poNo: po?.poNo || poNo,
      poDate: po?.poDate || '',
      deliveryDate: po?.deliveryDate || progress.deliveryDate || '',
      shipmentDate: po?.shipmentDate || '',
      unitPrice: po?.unitPrice || 0,
      currency: po?.currency || order?.currency || 'USD',
      orderStatus: order?.status || po?.status || progress.orderStatus || 'Running',
      colour: col?.colour || colour,
      colourOrderQty: Number(col?.factoryQty) || col?.totalQty || progress.orderQty || 0,
      colourBaseOrderQty: col?.totalQty || 0,
      colourFactoryQty: Number(col?.factoryQty) || col?.totalQty || 0,
      size: selectedSizeKey,
      sizeQuantities,
      availableSizes: sizeKeys.length > 0 ? sizeKeys : ['All Sizes'],
      sizeBreakdown: progress.sizeBreakdown,
      selectedSizeBreakdown,
      progress
    };
  }

  /** Flattened list of valid combinations for search and fast selection (defaults to active uncompleted orders) */
  public getAllOrderCombinations(includeCompleted: boolean = false) {
    const combinations: Array<{
      key: string;
      buyer: string;
      styleNo: string;
      styleName: string;
      garmentType: string;
      poNo: string;
      deliveryDate: string;
      colour: string;
      orderQty: number;
      sizes: string[];
      label: string;
      searchText: string;
    }> = [];

    const effectiveOrders = this.getOrders();

    for (const order of effectiveOrders) {
      if (!includeCompleted && (order.status === 'Completed' || order.status === 'Shipment Complete' || order.status === 'Cancelled')) {
        continue;
      }

      for (const po of order.purchaseOrders || []) {
        if (!includeCompleted && (po.status === 'Completed' || po.status === 'Shipment Complete' || po.status === 'Cancelled')) {
          continue;
        }

        for (const col of po.colours || []) {
          const sizes = col.sizeQuantities ? Object.keys(col.sizeQuantities) : [];
          const factQty = Number(col.factoryQty) || col.totalQty;
          const key = `${order.styleNo}||${po.poNo}||${col.colour}`;
          const label = `${order.styleNo} | PO: ${po.poNo} | ${col.colour} (${factQty?.toLocaleString()} pcs) - ${order.buyer}`;
          const searchText = `${order.styleNo || ''} ${order.styleName || ''} ${order.buyer || ''} ${order.brand || ''} ${po.poNo || ''} ${col.colour || ''} ${sizes.join(' ')}`.toLowerCase();
          combinations.push({
            key,
            buyer: order.buyer,
            styleNo: order.styleNo,
            styleName: order.styleName,
            garmentType: order.garmentType,
            poNo: po.poNo,
            deliveryDate: po.deliveryDate,
            colour: col.colour,
            orderQty: factQty,
            sizes,
            label,
            searchText
          });
        }
      }
    }
    return combinations;
  }

  // ==========================================
  // AUDIT LOGGING & NOTIFICATIONS
  // ==========================================
  public async addAuditLog(
    user: string,
    role: any,
    dept: any,
    action: string,
    module: string,
    recordId?: string,
    prev?: string,
    next?: string
  ): Promise<void> {
    const logId = generateUUID();
    const timestamp = new Date().toISOString();

    const logItem: AuditLog = {
      id: logId,
      timestamp,
      user,
      role,
      department: dept,
      action,
      module,
      recordId,
      previousValue: prev,
      newValue: next
    };

    this.cache.auditLogs = [logItem, ...this.cache.auditLogs].slice(0, 300);

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('audit_logs').insert({
          id: logId,
          timestamp,
          user_name: user,
          role: String(role || ''),
          department: String(dept || ''),
          action,
          module,
          record_id: recordId || null,
          previous_value: prev || null,
          new_value: next || null
        });
      } catch (err) {
        console.warn('Audit log write error:', err);
      }
    }
  }

  public async addNotification(notif: Partial<NotificationItem>): Promise<void> {
    const id = generateUUID();
    const newNotif: NotificationItem = {
      id,
      title: notif.title || 'System Notification',
      message: notif.message || '',
      timestamp: notif.timestamp || new Date().toISOString().replace('T', ' ').substring(0, 19),
      type: notif.type || 'info',
      read: false,
      linkModule: notif.linkModule
    };

    this.cache.notifications = [newNotif, ...this.cache.notifications];
    this.notify();

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('notifications').insert({
          id,
          title: newNotif.title,
          message: newNotif.message,
          timestamp: newNotif.timestamp,
          type: newNotif.type,
          read: false,
          link_module: newNotif.linkModule || null
        });
      } catch (err) {
        console.warn('Notification insert error:', err);
      }
    }
  }

  public async markNotificationRead(id: string): Promise<void> {
    this.cache.notifications = this.cache.notifications.map(n => n.id === id ? { ...n, read: true } : n);
    this.notify();

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('notifications').update({ read: true }).eq('id', id);
      } catch (err) {
        console.warn('Notification update error:', err);
      }
    }
  }

  public async deleteNotification(id: string): Promise<void> {
    this.cache.notifications = this.cache.notifications.filter(n => n.id !== id);
    this.notify();

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('notifications').delete().eq('id', id);
      } catch (err) {
        console.warn('Notification delete error:', err);
      }
    }
  }

  // ==========================================
  // CRUD: USER / PROFILES (Super Admin User Management)
  // ==========================================
  public async createUserViaAdminAPI(
    userData: {
      name: string;
      email: string;
      password?: string;
      username?: string;
      department: Department;
      designation?: string;
      role: Role;
      employeeId?: string;
      phone?: string;
      status?: 'Active' | 'Inactive';
      permissions?: Record<Department, Permission[]>;
      section?: string;
      lineNo?: string;
    },
    activeUser?: string
  ): Promise<{ success: boolean; error?: string; user?: User }> {
    const finalPermissions = userData.permissions || generateDefaultPermissions(userData.role, userData.department);
    const employeeId = userData.employeeId || userData.username || userData.email.split('@')[0];
    const userPassword = userData.password || 'Mjal@123456';

    // 1. Try invoking server-side admin API
    try {
      const response = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: userData.name,
          email: userData.email,
          password: userPassword,
          username: employeeId,
          department: userData.department,
          designation: userData.designation,
          role: userData.role,
          employeeId: employeeId,
          phone: userData.phone,
          status: userData.status || 'Active',
          permissions: finalPermissions,
          section: userData.section,
          lineNo: userData.lineNo
        })
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && json.user) {
          const createdUser: User = {
            id: json.user.id,
            name: json.user.name,
            email: json.user.email,
            username: json.user.username || employeeId,
            role: json.user.role,
            department: json.user.department,
            designation: userData.designation,
            employee_id: employeeId,
            section: json.user.section,
            line_no: json.user.line_no,
            phone: json.user.phone,
            status: json.user.status || 'Active',
            permissions: json.user.permissions || finalPermissions,
            createdAt: new Date().toISOString()
          };

          this.cache.users = this.cache.users
            .filter(u => u.id !== createdUser.id && (u.email || '').toLowerCase() !== (createdUser.email || '').toLowerCase())
            .concat(createdUser);

          await this.addAuditLog(
            activeUser || 'Super Admin',
            'SUPER_ADMIN',
            'HR & Admin',
            'Create User (Supabase Auth + Profile)',
            'User Management',
            createdUser.id,
            undefined,
            `${createdUser.name} (${createdUser.role} - ${createdUser.department})`
          );

          this.notify();
          return { success: true, user: createdUser };
        } else if (json.error) {
          console.warn('API /api/admin/users/create error response, trying client direct auth:', json.error);
        }
      }
    } catch (err: any) {
      console.warn('API /api/admin/users/create not reachable or failed, attempting client direct auth:', err);
    }

    // 2. Client-side direct Supabase Auth SignUp + Profiles table Upsert
    let directAuthId = generateUUID();
    if (isSupabaseConfigured()) {
      try {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: userData.email,
          password: userPassword,
          options: {
            data: {
              full_name: userData.name,
              role: userData.role,
              department: userData.department,
              designation: userData.designation || '',
              employee_id: employeeId,
              phone: userData.phone || ''
            }
          }
        });

        if (signUpData?.user) {
          directAuthId = signUpData.user.id;
        } else if (signUpError) {
          console.warn('Client direct signUp notice:', signUpError.message);
        }
      } catch (authErr: any) {
        console.warn('Client direct auth signUp exception:', authErr?.message || authErr);
      }
    }

    const fallbackUser: User = {
      id: directAuthId,
      name: userData.name,
      email: userData.email,
      username: employeeId,
      role: userData.role,
      department: userData.department,
      designation: userData.designation,
      employee_id: employeeId,
      section: userData.section,
      line_no: userData.lineNo,
      phone: userData.phone,
      status: userData.status || 'Active',
      permissions: finalPermissions,
      createdAt: new Date().toISOString()
    };

    const saveRes = await this.saveUser(fallbackUser, activeUser);
    if (saveRes.success) {
      return { success: true, user: fallbackUser };
    }
    return { success: false, error: saveRes.error || 'Failed to create user' };
  }

  public async updateUserViaAdminAPI(
    user: User,
    activeUser?: string,
    password?: string
  ): Promise<{ success: boolean; error?: string }> {
    const validId = ensureValidUUID(user.id);
    const userToSave = { ...user, id: validId };

    // 1. Try server-side endpoint
    try {
      const response = await fetch('/api/admin/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: validId,
          fullName: userToSave.name,
          email: userToSave.email,
          department: userToSave.department,
          designation: userToSave.designation,
          role: userToSave.role,
          employeeId: userToSave.employee_id || userToSave.username,
          phone: userToSave.phone,
          status: userToSave.status,
          permissions: userToSave.permissions,
          section: userToSave.section,
          lineNo: userToSave.line_no,
          password: password || undefined
        })
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success) {
          this.cache.users = this.cache.users.map(u => u.id === validId ? userToSave : u);
          await this.addAuditLog(
            activeUser || 'Super Admin',
            'SUPER_ADMIN',
            'HR & Admin',
            'Update User Profile & Role',
            'User Management',
            validId,
            undefined,
            `${userToSave.name} (${userToSave.role} - ${userToSave.department})`
          );
          this.notify();
          return { success: true };
        }
      }
    } catch (err) {
      console.warn('API /api/admin/users/update error, using direct database update:', err);
    }

    // 2. Direct database update fallback
    return await this.saveUser(userToSave, activeUser);
  }

  public async resetUserPasswordViaAdminAPI(
    userId: string,
    newPassword: string,
    activeUser?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }

    try {
      const response = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newPassword })
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success) {
          await this.addAuditLog(
            activeUser || 'Super Admin',
            'SUPER_ADMIN',
            'HR & Admin',
            'Reset User Password',
            'User Management',
            userId
          );
          return { success: true };
        } else {
          return { success: false, error: json.error };
        }
      }
    } catch (err: any) {
      console.warn('API /api/admin/users/reset-password notice:', err);
    }

    await this.addAuditLog(
      activeUser || 'Super Admin',
      'SUPER_ADMIN',
      'HR & Admin',
      'Reset User Password',
      'User Management',
      userId
    );
    return { success: true };
  }

  public async deleteUserViaAdminAPI(
    userId: string,
    activeUser?: string
  ): Promise<{ success: boolean; error?: string }> {
    const user = this.cache.users.find(u => u.id === userId || (u.email && u.email.toLowerCase() === userId.toLowerCase()));
    const email = user?.email || (userId.includes('@') ? userId : undefined);
    const id = user?.id || userId;

    if (id) markUserAsDeleted(id);
    if (email) markUserAsDeleted(email);
    if (user?.username) markUserAsDeleted(user.username);
    if (user?.employee_id) markUserAsDeleted(user.employee_id);

    try {
      await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id, email })
      });
    } catch (err) {
      console.warn('API /api/admin/users/delete notice:', err);
    }

    if (isSupabaseConfigured()) {
      try {
        if (id) await supabase.from('profiles').delete().eq('id', id);
        if (email) await supabase.from('profiles').delete().eq('email', email.toLowerCase());
      } catch (sbErr) {
        console.warn('Supabase profiles delete notice:', sbErr);
      }
    }

    const removed = user || this.cache.users.find(u => u.id === id);
    this.cache.users = this.cache.users.filter(u => u.id !== id && (!email || (u.email || '').toLowerCase() !== email.toLowerCase()));
    this.persistToLocalStore();
    await this.addAuditLog(
      activeUser || 'Super Admin',
      'SUPER_ADMIN',
      'HR & Admin',
      'Delete User (Auth + Profile)',
      'User Management',
      id,
      removed?.name
    );
    this.notify();
    return { success: true };
  }

  public async purgeDemoMockUsers(activeUser?: string): Promise<{ success: boolean; count: number; error?: string }> {
    const demoEmails = [
      'hr.admin@mjal.com',
      'md@mjal.com',
      'director@mjal.com',
      'gm@mjal.com',
      'ismail@mjal.com',
      'sewing@mjal.com',
      'cutting@mjal.com',
      'merchandiser@mjal.com',
      'qc@mjal.com'
    ];

    demoEmails.forEach(email => markUserAsDeleted(email));

    // 1. Call backend API to purge from server store & remote auth
    try {
      await fetch('/api/admin/users/delete-demo-mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      console.warn('API /api/admin/users/delete-demo-mock notice:', err);
    }

    // 2. Direct Supabase delete
    if (isSupabaseConfigured()) {
      for (const email of demoEmails) {
        try {
          await supabase.from('profiles').delete().eq('email', email);
        } catch (e) {
          console.warn(`Supabase delete profile for ${email} notice:`, e);
        }
      }
    }

    const initialLen = this.cache.users.length;
    this.cache.users = this.cache.users.filter(u => !demoEmails.includes((u.email || '').toLowerCase()) && !isUserDeleted(u.id, u.email, u.username));
    const removedCount = Math.max(initialLen - this.cache.users.length, demoEmails.length);
    this.persistToLocalStore();
    await this.addAuditLog(
      activeUser || 'Super Admin',
      'SUPER_ADMIN',
      'HR & Admin',
      'Purge Demo Mock Users',
      'User Management',
      'demo-users-all',
      'Purged Demo Users'
    );
    this.notify();
    return { success: true, count: removedCount };
  }

  public async syncAllUsersToSupabase(): Promise<{ success: boolean; count: number; error?: string }> {
    if (!isSupabaseConfigured()) {
      return { success: false, count: 0, error: 'Supabase is not configured' };
    }

    try {
      const usersToSync = (this.cache.users && this.cache.users.length > 0) ? this.cache.users : initialSystemUsers;
      const profilesPayload = usersToSync.map(u => ({
        id: ensureValidUUID(u.id),
        employee_id: u.employee_id || u.username || (u.email ? u.email.split('@')[0] : 'user'),
        full_name: u.name || u.email,
        email: (u.email || '').toLowerCase(),
        phone: u.phone || null,
        role: u.role || 'DEPT_USER',
        department: u.department || 'HR & Admin',
        section: u.section || null,
        line_no: u.line_no || null,
        status: u.status || 'Active',
        permissions: u.permissions || (u.role === 'SUPER_ADMIN' ? fullPermissions : viewOnlyPermissions),
        updated_at: new Date().toISOString()
      }));

      // 1. Try batch upsert
      const { error } = await supabase
        .from('profiles')
        .upsert(profilesPayload, { onConflict: 'id' });

      if (error) {
        console.warn('[Supabase DB Batch Sync Warning] Falling back to sequential upsert:', error.message);
        let syncedCount = 0;
        for (const item of profilesPayload) {
          const { error: singleErr } = await supabase.from('profiles').upsert(item, { onConflict: 'id' });
          if (!singleErr) {
            syncedCount++;
          } else {
            console.warn(`[Supabase Profile Upsert Error for ${item.email}]:`, singleErr.message);
          }
        }
        return { success: syncedCount > 0, count: syncedCount, error: syncedCount === 0 ? error.message : undefined };
      }

      // Also notify backend server
      try {
        await fetch('/api/admin/users/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ users: profilesPayload })
        });
      } catch (srvSyncErr) {
        // Optional backend sync
      }

      console.log(`%c[Supabase DB Sync Success] Synchronized ${profilesPayload.length} user profiles into public.profiles!`, 'color: #10b981; font-weight: bold;');
      return { success: true, count: profilesPayload.length };
    } catch (err: any) {
      console.error('[Supabase DB Sync Exception]:', err);
      return { success: false, count: 0, error: err?.message || 'Sync operation failed' };
    }
  }

  public async saveUser(user: User, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    const validId = ensureValidUUID(user.id);
    const userToSave = { ...user, id: validId };

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('profiles').upsert({
          id: validId,
          employee_id: userToSave.employee_id || userToSave.username || (userToSave.email ? userToSave.email.split('@')[0] : 'user'),
          full_name: userToSave.name,
          email: (userToSave.email || '').toLowerCase(),
          phone: userToSave.phone || null,
          role: userToSave.role,
          department: userToSave.department,
          section: userToSave.section || null,
          line_no: userToSave.line_no || null,
          status: userToSave.status || 'Active',
          permissions: userToSave.permissions || (userToSave.role === 'SUPER_ADMIN' ? fullPermissions : viewOnlyPermissions),
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

        if (error) {
          console.error('[Supabase saveUser Error]:', error.message);
        } else {
          console.log(`[Supabase saveUser Success] Persisted user profile: ${userToSave.email}`);
        }
      } catch (err: any) {
        console.error('Supabase saveUser exception:', err?.message || err);
      }
    }

    this.cache.users = this.cache.users.filter(u => u.id !== userToSave.id && (u.email || '').toLowerCase() !== (userToSave.email || '').toLowerCase()).concat(userToSave);
    await this.addAuditLog(activeUser || 'Admin', 'SUPER_ADMIN', 'HR & Admin', 'Save User Profile', 'User Management', validId, undefined, userToSave.name);
    this.notify();
    return { success: true };
  }

  public async deleteUser(id: string, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    const user = this.cache.users.find(u => u.id === id || (u.email && u.email.toLowerCase() === id.toLowerCase()));
    const email = user?.email || (id.includes('@') ? id : undefined);
    const validId = user?.id || id;

    if (validId) markUserAsDeleted(validId);
    if (email) markUserAsDeleted(email);
    if (user?.username) markUserAsDeleted(user.username);
    if (user?.employee_id) markUserAsDeleted(user.employee_id);

    if (isSupabaseConfigured()) {
      try {
        if (validId) await supabase.from('profiles').delete().eq('id', validId);
        if (email) await supabase.from('profiles').delete().eq('email', email.toLowerCase());
      } catch (err) {
        console.warn('Supabase delete error:', err);
      }
    }

    const removed = user || this.cache.users.find(u => u.id === validId);
    this.cache.users = this.cache.users.filter(u => u.id !== validId && (!email || (u.email || '').toLowerCase() !== email.toLowerCase()));
    this.persistToLocalStore();
    await this.addAuditLog(activeUser || 'Admin', 'SUPER_ADMIN', 'HR & Admin', 'Delete User', 'User Management', validId, removed?.name);
    this.notify();
    return { success: true };
  }

  // ==========================================
  // CRUD: ORDERS & PURCHASE ORDERS
  // ==========================================
  public async saveOrder(order: OrderStyle, activeUser?: string): Promise<{ success: boolean; error?: string; data?: OrderStyle }> {
    const validStyleId = ensureValidUUID(order.id);
    const creator = order.createdBy || order.created_by || activeUser || 'Merchandiser';
    const dept = order.createdDepartment || order.created_department || 'Merchandising';
    const email = order.creatorEmail || order.creator_email || (activeUser?.includes('@') ? activeUser : undefined) || (creator.includes('@') ? creator : undefined);

    // Strictly re-derive all quantities & values from the ground up from size-level matrices
    let computedTotalOrderQty = 0;
    let computedFactoryOrderQty = 0;
    let computedTotalOrderValue = 0;

    const sanitizedPOs: PurchaseOrder[] = (order.purchaseOrders || []).map((po, pIdx) => {
      const validPoId = ensureValidUUID(po.id || `po-${validStyleId}-${pIdx}`);
      const poUnitPrice = Number(po.unitPrice || 0);
      const poAllowance = Number(po.allowancePct ?? order.allowancePct ?? 0);

      let poOrderQty = 0;
      let poFactoryQty = 0;

      const sanitizedColours: ColourQty[] = (po.colours || [])
        .filter(c => c && c.colour && c.colour.trim() !== '')
        .map(c => {
          const colAllowance = Number(c.allowancePct ?? poAllowance);
          const sizeWise = calculateSizeWiseAllowance(c.sizeQuantities || {}, colAllowance);

          const colOrderQty = sizeWise.totalOrderQty > 0 ? sizeWise.totalOrderQty : (Number(c.totalQty) || 0);
          const colFactoryQty = sizeWise.totalFactoryQty > 0 ? sizeWise.totalFactoryQty : (Number(c.factoryQty) || Math.round(colOrderQty * (1 + colAllowance / 100)));
          const colAllowanceQty = Math.max(0, colFactoryQty - colOrderQty);

          poOrderQty += colOrderQty;
          poFactoryQty += colFactoryQty;

          return {
            colour: c.colour.trim(),
            totalQty: colOrderQty,
            allowancePct: colAllowance,
            allowanceQty: colAllowanceQty,
            factoryQty: colFactoryQty,
            sizeQuantities: sizeWise.sizeQuantities,
            factorySizeQuantities: sizeWise.factorySizeQuantities,
            allowanceSizeQuantities: sizeWise.allowanceSizeQuantities
          };
        });

      const effectivePoQty = poOrderQty > 0 ? poOrderQty : (Number(po.totalPoQty) || 0);
      const effectivePoFactoryQty = poFactoryQty > 0 ? poFactoryQty : (Number(po.factoryPoQty) || effectivePoQty);
      const effectivePoAllowanceQty = Math.max(0, effectivePoFactoryQty - effectivePoQty);
      const effectivePoValue = Number(po.totalValue) || (effectivePoQty * poUnitPrice);

      computedTotalOrderQty += effectivePoQty;
      computedFactoryOrderQty += effectivePoFactoryQty;
      computedTotalOrderValue += effectivePoValue;

      return {
        ...po,
        id: validPoId,
        poNo: (po.poNo || '').trim().toUpperCase(),
        totalPoQty: effectivePoQty,
        allowancePct: poAllowance,
        allowanceQty: effectivePoAllowanceQty,
        factoryPoQty: effectivePoFactoryQty,
        unitPrice: poUnitPrice,
        totalValue: effectivePoValue,
        colours: sanitizedColours
      };
    });

    const computedStyleAllowanceQty = Math.max(0, computedFactoryOrderQty - computedTotalOrderQty);

    const orderToSave: OrderStyle = {
      ...order,
      id: validStyleId,
      styleNo: (order.styleNo || '').trim().toUpperCase(),
      buyer: (order.buyer || '').trim(),
      brand: (order.brand || '').trim(),
      totalOrderQty: computedTotalOrderQty,
      allowanceQty: computedStyleAllowanceQty,
      factoryOrderQty: computedFactoryOrderQty,
      totalOrderValue: computedTotalOrderValue,
      purchaseOrders: sanitizedPOs,
      createdBy: creator,
      created_by: creator,
      createdDepartment: dept,
      created_department: dept,
      creatorEmail: email,
      creator_email: email,
      createdAt: order.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isSupabaseConfigured()) {
      let rpcHandled = false;
      try {
        const rpcPayload = {
          id: validStyleId,
          style_no: orderToSave.styleNo,
          style_name: orderToSave.styleName,
          buyer: orderToSave.buyer,
          brand: orderToSave.brand,
          garment_type: orderToSave.garmentType,
          season: orderToSave.season,
          currency: orderToSave.currency,
          status: orderToSave.status,
          allowance_pct: Number(orderToSave.allowancePct || 0),
          allowance_qty: Number(orderToSave.allowanceQty || 0),
          factory_order_qty: Number(orderToSave.factoryOrderQty || orderToSave.totalOrderQty || 0),
          created_by: creator,
          created_department: dept,
          purchase_orders: sanitizedPOs.map(po => ({
            id: po.id,
            po_no: po.poNo,
            po_date: toIsoDateString(po.poDate),
            delivery_date: toIsoDateString(po.deliveryDate || po.poDate),
            shipment_date: toIsoDateString(po.shipmentDate || po.deliveryDate || po.poDate),
            unit_price: Number(po.unitPrice || 0),
            currency: po.currency || 'USD',
            status: po.status || 'Active',
            allowance_pct: Number(po.allowancePct || 0),
            allowance_qty: Number(po.allowanceQty || 0),
            factory_po_qty: Number(po.factoryPoQty || po.totalPoQty || 0),
            remarks: po.remarks || '',
            colours: (po.colours || []).map(c => ({
              colour: c.colour,
              total_qty: Number(c.totalQty || 0),
              allowance_pct: Number(c.allowancePct || 0),
              allowance_qty: Number(c.allowanceQty || 0),
              factory_qty: Number(c.factoryQty || c.totalQty || 0),
              size_quantities: c.sizeQuantities || {},
              factory_size_quantities: c.factorySizeQuantities || {},
              allowance_size_quantities: c.allowanceSizeQuantities || {}
            }))
          }))
        };

        const { data: rpcData, error: rpcErr } = await supabase.rpc('upsert_order_atomic', {
          p_order: rpcPayload
        });

        if (!rpcErr && rpcData && rpcData.success) {
          rpcHandled = true;
          supabaseLogger.logSuccess('order_styles', 'RPC', rpcPayload, {
            module: 'Order Management',
            user: activeUser || 'Merchandiser'
          });
          console.log('[Supabase atomic RPC upsert_order_atomic succeeded]:', rpcData);
        } else if (!rpcErr && rpcData && rpcData.success === false) {
          supabaseLogger.logError('order_styles', 'RPC', { message: rpcData.error }, rpcPayload, {
            module: 'Order Management',
            user: activeUser || 'Merchandiser'
          });
          console.error('[Supabase atomic RPC error]:', rpcData.error);
          return { success: false, error: rpcData.error || 'Server rejected order upsert operation.' };
        } else if (rpcErr) {
          supabaseLogger.logWarning('order_styles', 'RPC', `RPC unavailable (${rpcErr.message}), falling back to direct table upsert.`, rpcPayload, {
            module: 'Order Management',
            user: activeUser || 'Merchandiser'
          });
          console.warn('[Supabase atomic RPC unavailable, falling back to direct transaction]:', rpcErr.message);
        }
      } catch (err: any) {
        supabaseLogger.logWarning('order_styles', 'RPC', `RPC call exception: ${err?.message || err}`, null, {
          module: 'Order Management',
          user: activeUser || 'Merchandiser'
        });
        console.warn('[Supabase atomic RPC invocation exception]:', err?.message || err);
      }

      if (!rpcHandled) {
        // 1. Upsert order style (try with allowance fields & created_by first)
        let { error: styleErr } = await supabase.from('order_styles').upsert({
          id: validStyleId,
          buyer: orderToSave.buyer,
          brand: orderToSave.brand,
          style_no: orderToSave.styleNo,
          style_name: orderToSave.styleName,
          garment_type: orderToSave.garmentType,
          season: orderToSave.season,
          currency: orderToSave.currency,
          status: orderToSave.status,
          total_order_qty: orderToSave.totalOrderQty,
          allowance_pct: Number(orderToSave.allowancePct || 0),
          allowance_qty: Number(orderToSave.allowanceQty || 0),
          factory_order_qty: Number(orderToSave.factoryOrderQty || orderToSave.totalOrderQty || 0),
          total_order_value: orderToSave.totalOrderValue,
          created_by: creator,
          created_department: dept,
          updated_at: new Date().toISOString()
        });

        // Fallback if created_by or allowance columns do not exist in older SQL schema
        if (styleErr && (styleErr.message?.includes('created_by') || styleErr.message?.includes('column') || styleErr.message?.includes('allowance'))) {
          const { error: fallbackErr } = await supabase.from('order_styles').upsert({
            id: validStyleId,
            buyer: orderToSave.buyer,
            brand: orderToSave.brand,
            style_no: orderToSave.styleNo,
            style_name: orderToSave.styleName,
            garment_type: orderToSave.garmentType,
            season: orderToSave.season,
            currency: orderToSave.currency,
            status: orderToSave.status,
            total_order_qty: orderToSave.totalOrderQty,
            total_order_value: orderToSave.totalOrderValue,
            updated_at: new Date().toISOString()
          });
          styleErr = fallbackErr;
        }

        if (styleErr) {
          console.error('Supabase saveOrder error:', styleErr);
        }

        // 2. Upsert purchase orders & colours idempotently
        if (orderToSave.purchaseOrders && orderToSave.purchaseOrders.length > 0) {
          for (const po of orderToSave.purchaseOrders) {
            const validPoId = ensureValidUUID(po.id);
            po.id = validPoId;

            let { error: poErr } = await supabase.from('purchase_orders').upsert({
              id: validPoId,
              style_id: validStyleId,
              style_no: orderToSave.styleNo,
              po_no: po.poNo,
              po_date: toIsoDateString(po.poDate),
              delivery_date: toIsoDateString(po.deliveryDate || po.poDate),
              shipment_date: toIsoDateString(po.shipmentDate || po.deliveryDate || po.poDate),
              unit_price: Number(po.unitPrice || 0),
              currency: po.currency || 'USD',
              total_value: Number(po.totalValue || 0),
              status: po.status || 'Active',
              total_po_qty: Number(po.totalPoQty || 0),
              allowance_pct: Number(po.allowancePct || 0),
              allowance_qty: Number(po.allowanceQty || 0),
              factory_po_qty: Number(po.factoryPoQty || po.totalPoQty || 0),
              remarks: po.remarks || ''
            });

            if (poErr && poErr.message?.includes('column')) {
              const { error: poFallbackErr } = await supabase.from('purchase_orders').upsert({
                id: validPoId,
                style_id: validStyleId,
                style_no: orderToSave.styleNo,
                po_no: po.poNo,
                po_date: toIsoDateString(po.poDate),
                delivery_date: toIsoDateString(po.deliveryDate || po.poDate),
                shipment_date: toIsoDateString(po.shipmentDate || po.deliveryDate || po.poDate),
                unit_price: Number(po.unitPrice || 0),
                currency: po.currency || 'USD',
                total_value: Number(po.totalValue || 0),
                status: po.status || 'Active',
                total_po_qty: Number(po.totalPoQty || 0),
                remarks: po.remarks || ''
              });
              poErr = poFallbackErr;
            }

            if (poErr) {
              console.error('Supabase savePO error:', poErr);
            } else if (po.colours && po.colours.length > 0) {
              // Replace colours for this PO atomically
              await supabase.from('po_colours').delete().eq('po_id', validPoId);
              for (const col of po.colours) {
                let { error: colErr } = await supabase.from('po_colours').insert({
                  id: generateUUID(),
                  po_id: validPoId,
                  colour: col.colour,
                  total_qty: col.totalQty,
                  allowance_pct: Number(col.allowancePct || 0),
                  allowance_qty: Number(col.allowanceQty || 0),
                  factory_qty: Number(col.factoryQty || col.totalQty || 0),
                  size_quantities: col.sizeQuantities || {},
                  factory_size_quantities: col.factorySizeQuantities || {},
                  allowance_size_quantities: col.allowanceSizeQuantities || {}
                });

                if (colErr && colErr.message?.includes('column')) {
                  await supabase.from('po_colours').insert({
                    id: generateUUID(),
                    po_id: validPoId,
                    colour: col.colour,
                    total_qty: col.totalQty,
                    size_quantities: col.sizeQuantities || {}
                  });
                }
              }
            }
          }
        }
      }
    }

    this.cache.orders = this.cache.orders
      .filter(o => 
        o.id !== validStyleId &&
        o.id !== order.id &&
        !(o.styleNo.trim().toUpperCase() === orderToSave.styleNo.trim().toUpperCase() && (o.buyer || '').trim().toLowerCase() === (orderToSave.buyer || '').trim().toLowerCase())
      )
      .concat(orderToSave);

    this.persistToLocalStore();
    await this.addAuditLog(activeUser || 'Merchandiser', 'DEPT_USER', 'Merchandising', 'Save Order', 'Order Management', validStyleId, undefined, `Style: ${orderToSave.styleNo}`);
    this.notify();
    return { success: true, data: orderToSave };
  }

  public async deleteOrder(orderId: string, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('order_styles').delete().eq('id', orderId);
      if (error) {
        console.error('Supabase deleteOrder error:', error);
        return { success: false, error: error.message };
      }
    }

    const removed = this.cache.orders.find(o => o.id === orderId);
    this.cache.orders = this.cache.orders.filter(o => o.id !== orderId);
    await this.addAuditLog(activeUser || 'Merchandiser', 'DEPT_USER', 'Merchandising', 'Delete Order', 'Order Management', orderId, removed?.styleNo);
    this.notify();
    return { success: true };
  }

  // ==========================================
  // CRUD: BOM ITEMS
  // ==========================================
  public async saveBOMItem(item: BOMItem, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    const validId = ensureValidUUID(item.id);
    const itemToSave = { ...item, id: validId };

    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('bom_items').upsert({
        id: validId,
        style_no: itemToSave.styleNo,
        category: itemToSave.category,
        item_name: itemToSave.itemName,
        specification: itemToSave.specification,
        consumption_per_dzn: itemToSave.consumptionPerDzn,
        unit: itemToSave.unit,
        unit_price: itemToSave.unitPrice,
        supplier: itemToSave.supplier,
        required_qty: itemToSave.requiredQty,
        booked_qty: itemToSave.bookedQty,
        received_qty: itemToSave.receivedQty,
        status: itemToSave.status
      });

      if (error) {
        return { success: false, error: error.message };
      }
    }

    this.cache.bom = this.cache.bom.filter(b => b.id !== validId).concat(itemToSave);
    await this.addAuditLog(activeUser || 'Merchandiser', 'DEPT_USER', 'Merchandising', 'Save BOM Item', 'Merchandising', validId, undefined, itemToSave.itemName);
    this.notify();
    return { success: true };
  }

  public async deleteBOMItem(id: string, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('bom_items').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
    }

    this.cache.bom = this.cache.bom.filter(b => b.id !== id);
    await this.addAuditLog(activeUser || 'Merchandiser', 'DEPT_USER', 'Merchandising', 'Delete BOM Item', 'Merchandising', id);
    this.notify();
    return { success: true };
  }

  // ==========================================
  // CRUD: T&A CALENDAR
  // ==========================================
  public async saveTATask(task: TACalendarTask, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    const validId = ensureValidUUID(task.id);
    const taskToSave = { ...task, id: validId };

    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('ta_calendar_tasks').upsert({
        id: validId,
        style_no: taskToSave.styleNo,
        po_no: taskToSave.poNo,
        task_name: taskToSave.taskName,
        planned_date: taskToSave.plannedDate,
        actual_date: taskToSave.actualDate || null,
        responsible_dept: taskToSave.responsibleDept,
        status: taskToSave.status,
        remarks: taskToSave.remarks
      });

      if (error) return { success: false, error: error.message };
    }

    this.cache.taCalendar = this.cache.taCalendar.filter(t => t.id !== validId).concat(taskToSave);
    await this.addAuditLog(activeUser || 'Merchandiser', 'DEPT_USER', 'Merchandising', 'Save T&A Task', 'T&A Calendar', validId, undefined, taskToSave.taskName);
    this.notify();
    return { success: true };
  }

  public async deleteTATask(id: string, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('ta_calendar_tasks').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
    }

    this.cache.taCalendar = this.cache.taCalendar.filter(t => t.id !== id);
    await this.addAuditLog(activeUser || 'Merchandiser', 'DEPT_USER', 'Merchandising', 'Delete T&A Task', 'T&A Calendar', id);
    this.notify();
    return { success: true };
  }

  // ==========================================
  // CRUD: SAMPLES
  // ==========================================
  public async saveSample(sample: SampleRecord, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    const validId = ensureValidUUID(sample.id);
    const sampleToSave = { ...sample, id: validId };

    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('sample_records').upsert({
        id: validId,
        style_no: sampleToSave.styleNo,
        po_no: sampleToSave.poNo,
        colour: sampleToSave.colour,
        sample_type: sampleToSave.sampleType,
        submission_date: sampleToSave.submissionDate,
        target_date: sampleToSave.targetDate,
        approval_date: sampleToSave.approvalDate || null,
        buyer_comments: sampleToSave.buyerComments || null,
        status: sampleToSave.status,
        prepared_by: sampleToSave.preparedBy
      });

      if (error) return { success: false, error: error.message };
    }

    this.cache.samples = this.cache.samples.filter(s => s.id !== validId).concat(sampleToSave);
    await this.addAuditLog(activeUser || 'Sample Master', 'DEPT_USER', 'Sample', 'Save Sample', 'Sample Management', validId, undefined, `${sampleToSave.styleNo} - ${sampleToSave.sampleType}`);
    this.notify();
    return { success: true };
  }

  public async deleteSample(id: string, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('sample_records').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
    }

    this.cache.samples = this.cache.samples.filter(s => s.id !== id);
    await this.addAuditLog(activeUser || 'Sample Master', 'DEPT_USER', 'Sample', 'Delete Sample', 'Sample Management', id);
    this.notify();
    return { success: true };
  }

  // ==========================================
  // CRUD: STORE & INVENTORY
  // ==========================================
  public async addStoreTransaction(tx: StoreTransaction, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    const validId = ensureValidUUID(tx.id);
    const txToSave = { ...tx, id: validId };

    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('store_transactions').insert({
        id: validId,
        date: txToSave.date,
        store_type: txToSave.storeType,
        transaction_type: txToSave.transactionType,
        style_no: txToSave.styleNo,
        po_no: txToSave.poNo,
        colour: txToSave.colour,
        item_name: txToSave.itemName,
        quantity: txToSave.quantity,
        unit: txToSave.unit,
        supplier_or_dept: txToSave.supplierOrDept,
        grn_no: txToSave.grnNo || null,
        issued_to: txToSave.issuedTo || null,
        performed_by: txToSave.performedBy,
        remarks: txToSave.remarks || null
      });

      if (error) return { success: false, error: error.message };

      // Update or create store stock item
      const { data: existingStock } = await supabase
        .from('store_stock_items')
        .select('*')
        .eq('item_name', txToSave.itemName)
        .eq('style_no', txToSave.styleNo)
        .eq('colour', txToSave.colour)
        .maybeSingle();

      const delta = txToSave.transactionType === 'Receive' ? txToSave.quantity : -txToSave.quantity;

      if (existingStock) {
        const newStock = Math.max(0, Number(existingStock.current_stock || 0) + delta);
        await supabase
          .from('store_stock_items')
          .update({ current_stock: newStock, updated_at: new Date().toISOString() })
          .eq('id', existingStock.id);
      } else {
        await supabase.from('store_stock_items').insert({
          id: generateUUID(),
          store_type: txToSave.storeType,
          item_name: txToSave.itemName,
          style_no: txToSave.styleNo,
          po_no: txToSave.poNo,
          colour: txToSave.colour,
          current_stock: Math.max(0, delta),
          min_stock_level: 100,
          unit: txToSave.unit,
          location: 'Main Warehouse'
        });
      }

      // Re-fetch stock items to keep in perfect sync
      const { data: updatedStock } = await supabase.from('store_stock_items').select('*');
      if (updatedStock) {
        this.cache.storeStock = updatedStock.map(i => ({
          id: i.id,
          storeType: i.store_type,
          itemName: i.item_name,
          category: i.category || '',
          styleNo: i.style_no,
          poNo: i.po_no,
          colour: i.colour,
          currentStock: Number(i.current_stock || 0),
          minStockLevel: Number(i.min_stock_level || 0),
          unit: i.unit,
          location: i.location || '',
          unitPrice: Number(i.unit_price || 0)
        }));
      }
    }

    this.cache.storeTransactions = [txToSave, ...this.cache.storeTransactions];
    await this.addAuditLog(activeUser || 'Store In-charge', 'DEPT_USER', 'Store', 'Store Transaction', 'Store & Inventory', validId, undefined, `${txToSave.transactionType} ${txToSave.quantity} ${txToSave.unit} of ${txToSave.itemName}`);
    this.notify();
    return { success: true };
  }

  public async saveStoreStockItem(item: StoreStockItem, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    const validId = ensureValidUUID(item.id);
    const itemToSave = { ...item, id: validId };

    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('store_stock_items').upsert({
        id: validId,
        store_type: itemToSave.storeType,
        item_name: itemToSave.itemName,
        category: itemToSave.category,
        style_no: itemToSave.styleNo,
        po_no: itemToSave.poNo,
        colour: itemToSave.colour,
        current_stock: itemToSave.currentStock,
        min_stock_level: itemToSave.minStockLevel,
        unit: itemToSave.unit,
        location: itemToSave.location,
        unit_price: itemToSave.unitPrice || 0
      });

      if (error) return { success: false, error: error.message };
    }

    this.cache.storeStock = this.cache.storeStock.filter(i => i.id !== validId).concat(itemToSave);
    await this.addAuditLog(activeUser || 'Store In-charge', 'DEPT_USER', 'Store', 'Save Stock Item', 'Store & Inventory', validId, undefined, itemToSave.itemName);
    this.notify();
    return { success: true };
  }

  public async deleteStoreStockItem(id: string, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('store_stock_items').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
    }

    this.cache.storeStock = this.cache.storeStock.filter(i => i.id !== id);
    await this.addAuditLog(activeUser || 'Store In-charge', 'DEPT_USER', 'Store', 'Delete Stock Item', 'Store & Inventory', id);
    this.notify();
    return { success: true };
  }

  public async deleteStoreTransaction(id: string, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('store_transactions').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
    }

    this.cache.storeTransactions = this.cache.storeTransactions.filter(t => t.id !== id);
    await this.addAuditLog(activeUser || 'Store In-charge', 'DEPT_USER', 'Store', 'Delete Transaction', 'Store & Inventory', id);
    this.notify();
    return { success: true };
  }

  // ==========================================
  // CRUD: CUTTING
  // ==========================================
  public async saveCuttingEntry(cut: CuttingEntry, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    const validId = ensureValidUUID(cut.id);
    const cutToSave = { ...cut, id: validId };

    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('cutting_entries').upsert({
        id: validId,
        date: cutToSave.date,
        style_no: cutToSave.styleNo,
        po_no: cutToSave.poNo,
        colour: cutToSave.colour,
        size: cutToSave.size,
        order_qty: cutToSave.orderQty,
        fabric_allocated_yds: cutToSave.fabricAllocatedYds,
        marker_length_yds: cutToSave.markerLengthYds,
        marker_efficiency: cutToSave.markerEfficiency,
        lay_plies: cutToSave.layPlies,
        cut_qty: cutToSave.cutQty,
        shortage_qty: cutToSave.shortageQty,
        reject_qty: cutToSave.rejectQty,
        recut_qty: cutToSave.recutQty,
        bundle_count: cutToSave.bundleCount,
        cut_efficiency: cutToSave.cutEfficiency,
        operator: cutToSave.operator
      });

      if (error) {
        console.error('Supabase saveCuttingEntry error:', error);
        return { success: false, error: error.message };
      }
    }

    this.cache.cuttingEntries = [cutToSave, ...this.cache.cuttingEntries.filter(c => c.id !== validId)];
    await this.addAuditLog(activeUser || 'Cutting Master', 'DEPT_USER', 'Cutting', 'Save Cutting Entry', 'Cutting', validId, undefined, `Style: ${cutToSave.styleNo} Cut: ${cutToSave.cutQty} pcs`);
    this.notify();
    return { success: true };
  }

  public async deleteCuttingEntry(id: string, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('cutting_entries').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
    }

    this.cache.cuttingEntries = this.cache.cuttingEntries.filter(c => c.id !== id);
    await this.addAuditLog(activeUser || 'Cutting Master', 'DEPT_USER', 'Cutting', 'Delete Cutting Entry', 'Cutting', id);
    this.notify();
    return { success: true };
  }

  // ==========================================
  // CRUD: SEWING
  // ==========================================
  public async saveSewingProduction(prod: SewingProduction, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    const validId = ensureValidUUID(prod.id);
    const prodToSave = { ...prod, id: validId };

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('sewing_production').upsert({
          id: validId,
          date: prodToSave.date || new Date().toISOString().substring(0, 10),
          line_no: prodToSave.lineNo || 'Line 01',
          buyer: prodToSave.buyer || 'Unknown Buyer',
          style_no: prodToSave.styleNo || 'N/A',
          po_no: prodToSave.poNo || 'N/A',
          colour: prodToSave.colour || 'N/A',
          size: prodToSave.size || 'All Sizes',
          input_qty: Number(prodToSave.inputQty || 0),
          daily_target: Number(prodToSave.dailyTarget || 0),
          hourly_outputs: prodToSave.hourlyOutputs || [],
          total_output: Number(prodToSave.totalOutput || 0),
          alter_qty: Number(prodToSave.alterQty || 0),
          reject_qty: Number(prodToSave.rejectQty || 0),
          rework_qty: Number(prodToSave.reworkQty || 0),
          wip_qty: Number(prodToSave.wipQty || 0),
          remarks: prodToSave.remarks || null,
          submitted_by: prodToSave.submittedBy || 'Sewing Supervisor',
          submission_time: prodToSave.submissionTime || new Date().toTimeString().substring(0, 5)
        });

        if (error) {
          console.error('Supabase saveSewingProduction error:', error);
          return { success: false, error: error.message };
        }
      } catch (err: any) {
        console.error('Supabase exception saveSewingProduction:', err);
        return { success: false, error: err?.message || 'Failed to sync with Supabase database.' };
      }
    }

    this.cache.sewingProduction = [prodToSave, ...this.cache.sewingProduction.filter(p => p.id !== validId)];
    this.persistToLocalStore();

    await this.addAuditLog(activeUser || 'Sewing Supervisor', 'DEPT_USER', 'Sewing', 'Submit Sewing Production', 'Sewing', validId, undefined, `Line: ${prodToSave.lineNo} Output: ${prodToSave.totalOutput} pcs`);
    this.notify();
    return { success: true };
  }

  public async deleteSewingProduction(id: string, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('sewing_production').delete().eq('id', id);
        if (error) return { success: false, error: error.message };
      } catch (err: any) {
        console.error('Supabase deleteSewingProduction error:', err);
        return { success: false, error: err?.message || 'Failed to delete sewing production' };
      }
    }

    this.cache.sewingProduction = this.cache.sewingProduction.filter(p => p.id !== id);
    this.persistToLocalStore();
    await this.addAuditLog(activeUser || 'Sewing Supervisor', 'DEPT_USER', 'Sewing', 'Delete Sewing Production', 'Sewing', id);
    this.notify();
    return { success: true };
  }

  public async saveSewingTarget(target: SewingTarget, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    const validId = ensureValidUUID(target.id);
    const targetToSave = { ...target, id: validId };

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('sewing_targets').upsert({
          id: validId,
          line_no: targetToSave.lineNo || 'Line 01',
          date: targetToSave.date || new Date().toISOString().substring(0, 10),
          month: targetToSave.month || '',
          style_no: targetToSave.styleNo || 'N/A',
          po_no: targetToSave.poNo || 'N/A',
          colour: targetToSave.colour || 'N/A',
          daily_target_qty: Number(targetToSave.dailyTargetQty || 0),
          hourly_target_qty: Number(targetToSave.hourlyTargetQty || 0),
          working_days: Number(targetToSave.workingDays || 26),
          monthly_target_qty: Number(targetToSave.monthlyTargetQty || 0)
        });

        if (error) {
          console.error('Supabase saveSewingTarget error:', error);
          return { success: false, error: error.message };
        }
      } catch (err: any) {
        console.error('Supabase exception saveSewingTarget:', err);
        return { success: false, error: err?.message || 'Failed to save sewing target' };
      }
    }

    this.cache.sewingTargets = [targetToSave, ...this.cache.sewingTargets.filter(t => t.id !== validId)];
    this.persistToLocalStore();

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('sewing_targets').upsert({
          id: validId,
          line_no: targetToSave.lineNo,
          date: targetToSave.date,
          month: targetToSave.month,
          style_no: targetToSave.styleNo,
          po_no: targetToSave.poNo,
          colour: targetToSave.colour,
          daily_target_qty: targetToSave.dailyTargetQty,
          hourly_target_qty: targetToSave.hourlyTargetQty,
          working_days: targetToSave.workingDays,
          monthly_target_qty: targetToSave.monthlyTargetQty
        });

        if (error) {
          console.warn('Supabase saveSewingTarget warning:', error);
        }
      } catch (err) {
        console.warn('Supabase exception saveSewingTarget:', err);
      }
    }

    await this.addAuditLog(activeUser || 'Sewing Manager', 'DEPT_USER', 'Sewing', 'Set Sewing Target', 'Sewing', validId, undefined, `Line ${targetToSave.lineNo}: Target ${targetToSave.dailyTargetQty} pcs`);
    this.notify();
    return { success: true };
  }

  public async deleteSewingTarget(id: string, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('sewing_targets').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
    }

    this.cache.sewingTargets = this.cache.sewingTargets.filter(t => t.id !== id);
    await this.addAuditLog(activeUser || 'Sewing Manager', 'DEPT_USER', 'Sewing', 'Delete Sewing Target', 'Sewing', id);
    this.notify();
    return { success: true };
  }

  public async saveSewingLine(line: SewingLine, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    const validId = ensureValidUUID(line.id);
    const lineToSave = { ...line, id: validId };

    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('sewing_lines').upsert({
        id: validId,
        line_no: lineToSave.lineNo,
        line_name: lineToSave.lineName,
        capacity_per_day: lineToSave.capacityPerDay,
        supervisor_name: lineToSave.supervisorName,
        status: lineToSave.status
      });

      if (error) return { success: false, error: error.message };
    }

    this.cache.sewingLines = this.cache.sewingLines.filter(l => l.id !== validId).concat(lineToSave);
    await this.addAuditLog(activeUser || 'Admin', 'SUPER_ADMIN', 'Sewing', 'Save Sewing Line', 'Sewing', validId, undefined, lineToSave.lineNo);
    this.notify();
    return { success: true };
  }

  public async deleteSewingLine(id: string, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('sewing_lines').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
    }

    this.cache.sewingLines = this.cache.sewingLines.filter(l => l.id !== id);
    await this.addAuditLog(activeUser || 'Admin', 'SUPER_ADMIN', 'Sewing', 'Delete Sewing Line', 'Sewing', id);
    this.notify();
    return { success: true };
  }

  // ==========================================
  // CRUD: WASHING
  // ==========================================
  public async saveWashingRecord(wash: WashingRecord, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    const validId = ensureValidUUID(wash.id);
    const washToSave = { ...wash, id: validId };

    // Format remarks to preserve items JSON and metadata
    let cleanRemarks = (washToSave.remarks || '').split('__ITEMS_JSON__:')[0].split('__EXTRA_META__:')[0].trim();
    const extraMeta = {
      buyer: washToSave.buyer,
      size: washToSave.size,
      vehicleNo: washToSave.vehicleNo,
      driverName: washToSave.driverName,
      driverPhone: washToSave.driverPhone,
      vendorAddress: washToSave.vendorAddress,
      expectedReturnDate: washToSave.expectedReturnDate,
      sourceTransferId: washToSave.sourceTransferId,
      authorizedBy: washToSave.authorizedBy,
      processInstructions: washToSave.processInstructions,
      returnDate: washToSave.returnDate,
      receivedBy: washToSave.receivedBy
    };

    let remarksWithItems = cleanRemarks;
    if (Object.values(extraMeta).some(v => v !== undefined && v !== '')) {
      remarksWithItems = `${remarksWithItems} __EXTRA_META__:${JSON.stringify(extraMeta)}`.trim();
    }
    if (washToSave.items && washToSave.items.length > 0) {
      remarksWithItems = `${remarksWithItems} __ITEMS_JSON__:${JSON.stringify(washToSave.items)}`.trim();
    }

    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('washing_records').upsert({
        id: validId,
        challan_no: washToSave.challanNo,
        date: washToSave.date,
        vendor_name: washToSave.vendorName,
        wash_type: washToSave.washType,
        style_no: washToSave.styleNo,
        po_no: washToSave.poNo,
        colour: washToSave.colour,
        sent_qty: washToSave.sentQty,
        received_qty: washToSave.receivedQty,
        damage_qty: washToSave.damageQty,
        reject_qty: washToSave.rejectQty,
        balance_qty: washToSave.balanceQty,
        status: washToSave.status,
        remarks: remarksWithItems
      });

      if (error) return { success: false, error: error.message };
    }

    this.cache.washingRecords = [washToSave, ...this.cache.washingRecords.filter(w => w.id !== validId)];
    await this.addAuditLog(activeUser || 'Washing Supervisor', 'DEPT_USER', 'Washing', 'Save Washing Challan', 'Washing', validId, undefined, `Challan: ${washToSave.challanNo}`);
    this.notify();
    return { success: true };
  }

  public async deleteWashingRecord(id: string, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('washing_records').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
    }

    this.cache.washingRecords = this.cache.washingRecords.filter(w => w.id !== id);
    await this.addAuditLog(activeUser || 'Washing Supervisor', 'DEPT_USER', 'Washing', 'Delete Washing Challan', 'Washing', id);
    this.notify();
    return { success: true };
  }

  // ==========================================
  // CRUD: FINISHING
  // ==========================================
  public async saveFinishingRecord(fin: FinishingRecord, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    const validId = ensureValidUUID(fin.id);
    const finToSave = { ...fin, id: validId };

    if (isSupabaseConfigured()) {
      try {
        const extraMeta = {
          getUpQty: finToSave.getUpQty || 0,
          cartonQty: finToSave.cartonQty || 0,
          polyQty: finToSave.polyQty ?? finToSave.packedQty ?? 0,
          threadCutQty: finToSave.threadCutQty ?? finToSave.sewingReceiveQty ?? 0,
          readyForShipmentQty: finToSave.readyForShipmentQty || 0,
          isReadyForShipment: finToSave.isReadyForShipment || false,
          readyForShipmentDate: finToSave.readyForShipmentDate || null,
          shipmentStatus: finToSave.shipmentStatus || 'In Finishing',
          buyer: finToSave.buyer || null
        };

        const cleanOriginalRemarks = finToSave.remarks ? finToSave.remarks.split('__EXTRA_META__:')[0].trim() : '';
        const encodedRemarks = `${cleanOriginalRemarks ? cleanOriginalRemarks + ' ' : ''}__EXTRA_META__:${JSON.stringify(extraMeta)}`;

        const fullPayload = {
          id: validId,
          date: finToSave.date,
          buyer: finToSave.buyer || null,
          style_no: finToSave.styleNo,
          po_no: finToSave.poNo,
          colour: finToSave.colour,
          size: finToSave.size,
          sewing_receive_qty: finToSave.sewingReceiveQty,
          finishing_input_qty: finToSave.finishingInputQty,
          thread_cut_qty: finToSave.threadCutQty ?? finToSave.sewingReceiveQty ?? 0,
          get_up_qty: finToSave.getUpQty || 0,
          ironed_qty: finToSave.ironedQty,
          folded_qty: finToSave.foldedQty || 0,
          tagged_qty: finToSave.taggedQty,
          packed_qty: finToSave.packedQty,
          poly_qty: finToSave.polyQty ?? finToSave.packedQty ?? 0,
          carton_qty: finToSave.cartonQty || 0,
          rework_qty: finToSave.reworkQty || 0,
          reject_qty: finToSave.rejectQty || 0,
          finished_qty: finToSave.finishedQty,
          operator: finToSave.operator,
          hang_tag_status: finToSave.hangTagStatus || 'Pending',
          transferred_to_packing_qty: finToSave.transferredToPackingQty || 0,
          is_ready_for_shipment: finToSave.isReadyForShipment || false,
          ready_for_shipment_qty: finToSave.readyForShipmentQty || 0,
          ready_for_shipment_date: finToSave.readyForShipmentDate || null,
          shipment_status: finToSave.shipmentStatus || 'In Finishing',
          remarks: encodedRemarks
        };

        const { error } = await supabase.from('finishing_records').upsert(fullPayload);

        if (error) {
          console.warn('Supabase saveFinishingRecord primary upsert warning:', error.message);
          if (error.message.includes('column') || error.message.includes('schema cache')) {
            // Fallback payload with core legacy columns to support existing Supabase schemas
            const fallbackPayload = {
              id: validId,
              date: finToSave.date,
              style_no: finToSave.styleNo,
              po_no: finToSave.poNo,
              colour: finToSave.colour,
              size: finToSave.size,
              sewing_receive_qty: finToSave.sewingReceiveQty,
              finishing_input_qty: finToSave.finishingInputQty,
              ironed_qty: finToSave.ironedQty,
              folded_qty: finToSave.foldedQty,
              tagged_qty: finToSave.taggedQty,
              packed_qty: finToSave.packedQty,
              rework_qty: finToSave.reworkQty,
              reject_qty: finToSave.rejectQty,
              finished_qty: finToSave.finishedQty,
              operator: finToSave.operator,
              remarks: encodedRemarks
            };
            const fallbackRes = await supabase.from('finishing_records').upsert(fallbackPayload);
            if (fallbackRes.error) {
              console.warn('Supabase saveFinishingRecord fallback warning:', fallbackRes.error.message);
            }
          }
        }
      } catch (err) {
        console.warn('Supabase exception in saveFinishingRecord:', err);
      }
    }

    // Deduplicate cache so we never keep stale/duplicate records for the exact same style/po/colour/size
    this.cache.finishingRecords = [
      finToSave,
      ...this.cache.finishingRecords.filter(f => {
        if (f.id === validId) return false;
        const sameStyle = f.styleNo?.trim().toUpperCase() === finToSave.styleNo?.trim().toUpperCase();
        const samePo = (!f.poNo && !finToSave.poNo) || (f.poNo?.trim().toUpperCase() === finToSave.poNo?.trim().toUpperCase());
        const sameColour = (!f.colour && !finToSave.colour) || (f.colour?.trim().toUpperCase() === finToSave.colour?.trim().toUpperCase());
        const sameSize = (!f.size && !finToSave.size) || (f.size?.trim().toUpperCase() === finToSave.size?.trim().toUpperCase());
        return !(sameStyle && samePo && sameColour && sameSize);
      })
    ];

    // Sync with Packing Records for full backward compatibility
    if (finToSave.packedQty > 0 || finToSave.cartonQty) {
      const packId = `pack-fin-${finToSave.styleNo}-${finToSave.poNo}-${finToSave.colour}-${finToSave.size}`;
      const existingPack = this.cache.packingRecords.find(p => p.id === packId || (p.styleNo === finToSave.styleNo && p.poNo === finToSave.poNo && p.colour === finToSave.colour));
      const updatedPack: PackingRecord = {
        id: existingPack ? existingPack.id : packId,
        date: finToSave.date,
        styleNo: finToSave.styleNo,
        poNo: finToSave.poNo,
        colour: finToSave.colour,
        size: finToSave.size,
        cartonCount: finToSave.cartonQty || Math.ceil((finToSave.packedQty || 0) / 20) || 1,
        packedQty: finToSave.packedQty,
        orderQty: finToSave.sewingReceiveQty || finToSave.finishedQty,
        balanceQty: Math.max(0, (finToSave.sewingReceiveQty || finToSave.finishedQty) - finToSave.packedQty),
        cartons: [],
        packingOfficer: finToSave.operator || activeUser || 'Finishing Officer'
      };
      this.cache.packingRecords = [updatedPack, ...this.cache.packingRecords.filter(p => p.id !== updatedPack.id)];
    }

    this.persistToLocalStore();
    await this.addAuditLog(activeUser || 'Finishing Supervisor', 'DEPT_USER', 'Finishing', 'Save Finishing Record', 'Finishing', validId, undefined, `Finished: ${finToSave.finishedQty} pcs, Packed: ${finToSave.packedQty} pcs, Carton: ${finToSave.cartonQty || 0} ctns`);
    this.notify();
    return { success: true };
  }

  public async saveFinishingRecordsBatch(records: FinishingRecord[], activeUser?: string): Promise<{ success: boolean; error?: string }> {
    if (!records || records.length === 0) return { success: true };

    const validRecords = records.map(fin => {
      const validId = ensureValidUUID(fin.id);
      return { ...fin, id: validId };
    });

    if (isSupabaseConfigured()) {
      try {
        const fullPayloads = validRecords.map(finToSave => {
          const extraMeta = {
            getUpQty: finToSave.getUpQty || 0,
            cartonQty: finToSave.cartonQty || 0,
            polyQty: finToSave.polyQty ?? finToSave.packedQty ?? 0,
            threadCutQty: finToSave.threadCutQty ?? finToSave.sewingReceiveQty ?? 0,
            readyForShipmentQty: finToSave.readyForShipmentQty || 0,
            isReadyForShipment: finToSave.isReadyForShipment || false,
            readyForShipmentDate: finToSave.readyForShipmentDate || null,
            shipmentStatus: finToSave.shipmentStatus || 'In Finishing',
            buyer: finToSave.buyer || null
          };

          const cleanOriginalRemarks = finToSave.remarks ? finToSave.remarks.split('__EXTRA_META__:')[0].trim() : '';
          const encodedRemarks = `${cleanOriginalRemarks ? cleanOriginalRemarks + ' ' : ''}__EXTRA_META__:${JSON.stringify(extraMeta)}`;

          return {
            id: finToSave.id,
            date: finToSave.date,
            buyer: finToSave.buyer || null,
            style_no: finToSave.styleNo,
            po_no: finToSave.poNo,
            colour: finToSave.colour,
            size: finToSave.size,
            sewing_receive_qty: finToSave.sewingReceiveQty,
            finishing_input_qty: finToSave.finishingInputQty,
            thread_cut_qty: finToSave.threadCutQty ?? finToSave.sewingReceiveQty ?? 0,
            get_up_qty: finToSave.getUpQty || 0,
            ironed_qty: finToSave.ironedQty,
            folded_qty: finToSave.foldedQty || 0,
            tagged_qty: finToSave.taggedQty,
            packed_qty: finToSave.packedQty,
            poly_qty: finToSave.polyQty ?? finToSave.packedQty ?? 0,
            carton_qty: finToSave.cartonQty || 0,
            rework_qty: finToSave.reworkQty || 0,
            reject_qty: finToSave.rejectQty || 0,
            finished_qty: finToSave.finishedQty,
            operator: finToSave.operator,
            hang_tag_status: finToSave.hangTagStatus || 'Pending',
            transferred_to_packing_qty: finToSave.transferredToPackingQty || 0,
            is_ready_for_shipment: finToSave.isReadyForShipment || false,
            ready_for_shipment_qty: finToSave.readyForShipmentQty || 0,
            ready_for_shipment_date: finToSave.readyForShipmentDate || null,
            shipment_status: finToSave.shipmentStatus || 'In Finishing',
            remarks: encodedRemarks
          };
        });

        const { error } = await supabase.from('finishing_records').upsert(fullPayloads);
        if (error) {
          console.warn('Supabase saveFinishingRecordsBatch primary upsert warning:', error.message);
          if (error.message.includes('column') || error.message.includes('schema cache')) {
            const fallbackPayloads = validRecords.map(finToSave => {
              const extraMeta = {
                getUpQty: finToSave.getUpQty || 0,
                cartonQty: finToSave.cartonQty || 0,
                polyQty: finToSave.polyQty ?? finToSave.packedQty ?? 0,
                threadCutQty: finToSave.threadCutQty ?? finToSave.sewingReceiveQty ?? 0,
                readyForShipmentQty: finToSave.readyForShipmentQty || 0,
                isReadyForShipment: finToSave.isReadyForShipment || false,
                readyForShipmentDate: finToSave.readyForShipmentDate || null,
                shipmentStatus: finToSave.shipmentStatus || 'In Finishing',
                buyer: finToSave.buyer || null
              };
              const cleanOriginalRemarks = finToSave.remarks ? finToSave.remarks.split('__EXTRA_META__:')[0].trim() : '';
              const encodedRemarks = `${cleanOriginalRemarks ? cleanOriginalRemarks + ' ' : ''}__EXTRA_META__:${JSON.stringify(extraMeta)}`;
              return {
                id: finToSave.id,
                date: finToSave.date,
                style_no: finToSave.styleNo,
                po_no: finToSave.poNo,
                colour: finToSave.colour,
                size: finToSave.size,
                sewing_receive_qty: finToSave.sewingReceiveQty,
                finishing_input_qty: finToSave.finishingInputQty,
                ironed_qty: finToSave.ironedQty,
                folded_qty: finToSave.foldedQty,
                tagged_qty: finToSave.taggedQty,
                packed_qty: finToSave.packedQty,
                rework_qty: finToSave.reworkQty,
                reject_qty: finToSave.rejectQty,
                finished_qty: finToSave.finishedQty,
                operator: finToSave.operator,
                remarks: encodedRemarks
              };
            });
            await supabase.from('finishing_records').upsert(fallbackPayloads);
          }
        }
      } catch (err) {
        console.warn('Supabase exception in saveFinishingRecordsBatch:', err);
      }
    }

    // Update local cache cleanly
    const idsToReplace = new Set(validRecords.map(r => r.id));
    const cleanCache = this.cache.finishingRecords.filter(f => {
      if (idsToReplace.has(f.id)) return false;
      const match = validRecords.some(r =>
        f.styleNo?.trim().toUpperCase() === r.styleNo?.trim().toUpperCase() &&
        (!f.poNo && !r.poNo || f.poNo?.trim().toUpperCase() === r.poNo?.trim().toUpperCase()) &&
        (!f.colour && !r.colour || f.colour?.trim().toUpperCase() === r.colour?.trim().toUpperCase()) &&
        (!f.size && !r.size || f.size?.trim().toUpperCase() === r.size?.trim().toUpperCase())
      );
      return !match;
    });

    this.cache.finishingRecords = [...validRecords, ...cleanCache];

    // Sync with Packing records
    validRecords.forEach(finToSave => {
      if (finToSave.packedQty > 0 || finToSave.cartonQty) {
        const packId = `pack-fin-${finToSave.styleNo}-${finToSave.poNo}-${finToSave.colour}-${finToSave.size}`;
        const existingPack = this.cache.packingRecords.find(p => p.id === packId || (p.styleNo === finToSave.styleNo && p.poNo === finToSave.poNo && p.colour === finToSave.colour));
        const updatedPack: PackingRecord = {
          id: existingPack ? existingPack.id : packId,
          date: finToSave.date,
          styleNo: finToSave.styleNo,
          poNo: finToSave.poNo,
          colour: finToSave.colour,
          size: finToSave.size,
          cartonCount: finToSave.cartonQty || Math.ceil((finToSave.packedQty || 0) / 20) || 1,
          packedQty: finToSave.packedQty,
          orderQty: finToSave.sewingReceiveQty || finToSave.finishedQty,
          balanceQty: Math.max(0, (finToSave.sewingReceiveQty || finToSave.finishedQty) - finToSave.packedQty),
          cartons: [],
          packingOfficer: finToSave.operator || activeUser || 'Finishing Officer'
        };
        this.cache.packingRecords = [updatedPack, ...this.cache.packingRecords.filter(p => p.id !== updatedPack.id)];
      }
    });

    this.persistToLocalStore();
    await this.addAuditLog(activeUser || 'Finishing Supervisor', 'DEPT_USER', 'Finishing', 'Batch Save Finishing Records', 'Finishing', validRecords[0].id, undefined, `Saved ${validRecords.length} size records`);
    this.notify();
    return { success: true };
  }

  public async deleteFinishingRecord(id: string, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('finishing_records').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
    }

    this.cache.finishingRecords = this.cache.finishingRecords.filter(f => f.id !== id);
    this.persistToLocalStore();
    await this.addAuditLog(activeUser || 'Finishing Supervisor', 'DEPT_USER', 'Finishing', 'Delete Finishing Record', 'Finishing', id);
    this.notify();
    return { success: true };
  }

  // ==========================================
  // CRUD: QUALITY CONTROL (QC)
  // ==========================================
  public async saveQCInspection(qc: QCInspection, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    const validId = ensureValidUUID(qc.id);
    const qcToSave = { ...qc, id: validId };

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('qc_inspections').upsert({
          id: validId,
          date: qcToSave.date,
          inspection_type: qcToSave.inspectionType,
          style_no: qcToSave.styleNo,
          po_no: qcToSave.poNo,
          colour: qcToSave.colour,
          line_no: qcToSave.lineNo,
          inspected_qty: qcToSave.inspectedQty,
          passed_qty: qcToSave.passedQty,
          rework_qty: qcToSave.reworkQty,
          reject_qty: qcToSave.rejectQty,
          dhu: qcToSave.dhu,
          defects: qcToSave.defects,
          inspector_name: qcToSave.inspectorName,
          result: qcToSave.result
        });

        if (error) {
          console.warn('Supabase saveQCInspection error:', error.message);
        }
      } catch (err) {
        console.warn('Supabase saveQCInspection exception:', err);
      }
    }

    this.cache.qcInspections = [qcToSave, ...this.cache.qcInspections.filter(q => q.id !== validId)];
    this.persistToLocalStore();
    await this.addAuditLog(activeUser || 'QC Inspector', 'DEPT_USER', 'QC', 'Submit QC Inspection', 'QC', validId, undefined, `${qcToSave.inspectionType} - Style: ${qcToSave.styleNo}, Passed: ${qcToSave.passedQty} pcs, DHU: ${qcToSave.dhu}%`);
    this.notify();
    return { success: true };
  }

  public async saveQCInspectionsBatch(records: QCInspection[], activeUser?: string): Promise<{ success: boolean; error?: string }> {
    if (!records || records.length === 0) return { success: true };

    const validRecords = records.map(qc => {
      const validId = ensureValidUUID(qc.id);
      return { ...qc, id: validId };
    });

    if (isSupabaseConfigured()) {
      try {
        const payloads = validRecords.map(qcToSave => ({
          id: qcToSave.id,
          date: qcToSave.date,
          inspection_type: qcToSave.inspectionType,
          style_no: qcToSave.styleNo,
          po_no: qcToSave.poNo,
          colour: qcToSave.colour,
          line_no: qcToSave.lineNo,
          inspected_qty: qcToSave.inspectedQty,
          passed_qty: qcToSave.passedQty,
          rework_qty: qcToSave.reworkQty,
          reject_qty: qcToSave.rejectQty,
          dhu: qcToSave.dhu,
          defects: qcToSave.defects,
          inspector_name: qcToSave.inspectorName,
          result: qcToSave.result
        }));

        const { error } = await supabase.from('qc_inspections').upsert(payloads);
        if (error) {
          console.warn('Supabase saveQCInspectionsBatch warning:', error.message);
        }
      } catch (err) {
        console.warn('Supabase saveQCInspectionsBatch exception:', err);
      }
    }

    const idsToReplace = new Set(validRecords.map(r => r.id));
    const cleanCache = this.cache.qcInspections.filter(q => !idsToReplace.has(q.id));
    this.cache.qcInspections = [...validRecords, ...cleanCache];
    this.persistToLocalStore();
    await this.addAuditLog(activeUser || 'QC Inspector', 'DEPT_USER', 'QC', 'Batch Submit QC Inspections', 'QC', validRecords[0].id, undefined, `Saved ${validRecords.length} QC inspection records`);
    this.notify();
    return { success: true };
  }

  public async deleteQCInspection(id: string, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('qc_inspections').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
    }

    this.cache.qcInspections = this.cache.qcInspections.filter(q => q.id !== id);
    this.persistToLocalStore();
    await this.addAuditLog(activeUser || 'QC Inspector', 'DEPT_USER', 'QC', 'Delete QC Inspection', 'QC', id);
    this.notify();
    return { success: true };
  }

  // ==========================================
  // CRUD: PACKING
  // ==========================================
  public async savePackingRecord(pack: PackingRecord, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    const validId = ensureValidUUID(pack.id);
    const packToSave = { ...pack, id: validId };

    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('packing_records').upsert({
        id: validId,
        date: packToSave.date,
        style_no: packToSave.styleNo,
        po_no: packToSave.poNo,
        colour: packToSave.colour,
        order_qty: packToSave.orderQty,
        packed_qty: packToSave.packedQty,
        balance_qty: packToSave.balanceQty,
        carton_count: packToSave.cartonCount,
        cartons: packToSave.cartons,
        packing_officer: packToSave.packingOfficer
      });

      if (error) return { success: false, error: error.message };
    }

    this.cache.packingRecords = [packToSave, ...this.cache.packingRecords.filter(p => p.id !== validId)];
    await this.addAuditLog(activeUser || 'Packing Officer', 'DEPT_USER', 'Packing', 'Save Packing Record', 'Packing', validId, undefined, `${packToSave.cartonCount} cartons (${packToSave.packedQty} pcs)`);
    this.notify();
    return { success: true };
  }

  public async deletePackingRecord(id: string, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('packing_records').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
    }

    this.cache.packingRecords = this.cache.packingRecords.filter(p => p.id !== id);
    await this.addAuditLog(activeUser || 'Packing Officer', 'DEPT_USER', 'Packing', 'Delete Packing Record', 'Packing', id);
    this.notify();
    return { success: true };
  }

  // ==========================================
  // CRUD: SHIPMENT
  // ==========================================
  public async saveShipmentRecord(ship: ShipmentRecord, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    const validId = ensureValidUUID(ship.id);
    const shipToSave = { ...ship, id: validId };

    const itemsJson = (shipToSave.items && shipToSave.items.length > 0)
      ? JSON.stringify(shipToSave.items)
      : null;

    const cleanRemarks = shipToSave.remarks ? shipToSave.remarks.split('__ITEMS_JSON__:')[0].trim() : '';
    const encodedRemarks = itemsJson ? `${cleanRemarks ? cleanRemarks + ' ' : ''}__ITEMS_JSON__:${itemsJson}` : (cleanRemarks || null);

    console.groupCollapsed(`%c[MJAL ERP Supabase DataService] saveShipmentRecord: Invoice #${shipToSave.invoiceNo}`, 'color: #2563eb; font-weight: bold;');
    console.log('Record ID (UUID v4):', validId);
    console.log('Active User / Officer:', activeUser || 'Shipment Officer');
    console.log('Structured Payload:', {
      id: validId,
      invoiceNo: shipToSave.invoiceNo,
      packingListNo: shipToSave.packingListNo,
      shipmentDate: shipToSave.shipmentDate,
      buyer: shipToSave.buyer,
      styleNo: shipToSave.styleNo,
      poNo: shipToSave.poNo,
      colour: shipToSave.colour,
      size: shipToSave.size,
      shippedQty: shipToSave.shippedQty,
      orderQty: shipToSave.orderQty,
      balanceQty: shipToSave.balanceQty,
      cartonCount: shipToSave.cartonCount,
      vesselOrFlight: shipToSave.vesselOrFlight,
      containerNo: shipToSave.containerNo,
      portOfLoading: shipToSave.portOfLoading,
      portOfDischarge: shipToSave.portOfDischarge,
      status: shipToSave.status,
      itemsCount: shipToSave.items?.length || 0,
      remarks: cleanRemarks
    });

    let supabasePersistenceSuccess = false;
    let lastSupabaseError: any = null;

    if (isSupabaseConfigured()) {
      // 1. Try 'shipment_records' table (Tier 1: Full payload)
      try {
        console.log('[Supabase Operation] Attempting Tier 1 upsert to public.shipment_records (Full Schema)...');
        const { error, data } = await supabase.from('shipment_records').upsert({
          id: validId,
          invoice_no: shipToSave.invoiceNo,
          packing_list_no: shipToSave.packingListNo,
          shipment_date: shipToSave.shipmentDate,
          buyer: shipToSave.buyer,
          style_no: shipToSave.styleNo,
          po_no: shipToSave.poNo,
          colour: shipToSave.colour,
          size: shipToSave.size || 'All Sizes',
          shipped_qty: shipToSave.shippedQty,
          order_qty: shipToSave.orderQty,
          balance_qty: shipToSave.balanceQty,
          carton_count: shipToSave.cartonCount,
          vessel_or_flight: shipToSave.vesselOrFlight || null,
          container_no: shipToSave.containerNo || null,
          port_of_loading: shipToSave.portOfLoading || null,
          port_of_discharge: shipToSave.portOfDischarge || null,
          status: shipToSave.status,
          prepared_by: shipToSave.preparedBy || null,
          remarks: encodedRemarks
        }).select();

        if (error) {
          lastSupabaseError = error;
          console.warn('[Supabase Warning] Tier 1 upsert to shipment_records rejected:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          });

          // Check if RLS policy blocked the write
          if (error.code === '42501' || error.message?.toLowerCase().includes('row-level security') || error.message?.toLowerCase().includes('permission denied')) {
            console.error('%c[Supabase RLS Policy Block] Write permission denied on table "shipment_records". Ensure RLS policy allows authenticated/anon INSERT and UPDATE.', 'color: #dc2626; font-weight: bold;');
          }

          // Retry Tier 2: Base schema columns (omitting size/remarks in case older table without ALTER TABLE)
          console.log('[Supabase Operation] Retrying Tier 2 upsert to public.shipment_records (Base Schema)...');
          const { error: tier2Err } = await supabase.from('shipment_records').upsert({
            id: validId,
            invoice_no: shipToSave.invoiceNo,
            packing_list_no: shipToSave.packingListNo,
            shipment_date: shipToSave.shipmentDate,
            buyer: shipToSave.buyer,
            style_no: shipToSave.styleNo,
            po_no: shipToSave.poNo,
            colour: shipToSave.colour,
            shipped_qty: shipToSave.shippedQty,
            order_qty: shipToSave.orderQty,
            balance_qty: shipToSave.balanceQty,
            carton_count: shipToSave.cartonCount,
            vessel_or_flight: shipToSave.vesselOrFlight || null,
            container_no: shipToSave.containerNo || null,
            port_of_loading: shipToSave.portOfLoading || null,
            port_of_discharge: shipToSave.portOfDischarge || null,
            status: shipToSave.status,
            prepared_by: shipToSave.preparedBy || null
          });

          if (tier2Err) {
            lastSupabaseError = tier2Err;
            console.warn('[Supabase Warning] Tier 2 upsert to shipment_records rejected:', {
              code: tier2Err.code,
              message: tier2Err.message
            });

            // Tier 3: minimal essential columns
            console.log('[Supabase Operation] Retrying Tier 3 upsert to public.shipment_records (Essential columns)...');
            const { error: tier3Err } = await supabase.from('shipment_records').upsert({
              id: validId,
              invoice_no: shipToSave.invoiceNo,
              packing_list_no: shipToSave.packingListNo,
              shipment_date: shipToSave.shipmentDate,
              buyer: shipToSave.buyer,
              style_no: shipToSave.styleNo,
              po_no: shipToSave.poNo,
              colour: shipToSave.colour,
              shipped_qty: shipToSave.shippedQty,
              order_qty: shipToSave.orderQty,
              balance_qty: shipToSave.balanceQty,
              carton_count: shipToSave.cartonCount,
              status: shipToSave.status
            });

            if (tier3Err) {
              lastSupabaseError = tier3Err;
              console.warn('[Supabase Warning] Tier 3 upsert rejected:', tier3Err.message);
            } else {
              supabasePersistenceSuccess = true;
              console.log('%c[Supabase Success] Record saved to public.shipment_records via Tier 3 fallback.', 'color: #16a34a;');
            }
          } else {
            supabasePersistenceSuccess = true;
            console.log('%c[Supabase Success] Record saved to public.shipment_records via Tier 2 fallback.', 'color: #16a34a;');
          }
        } else {
          supabasePersistenceSuccess = true;
          console.log('%c[Supabase Success] Record saved to public.shipment_records with full schema.', 'color: #16a34a;', data);
        }
      } catch (err: any) {
        lastSupabaseError = err;
        console.warn('Supabase saveShipmentRecord shipment_records exception:', err);
      }

      // 2. Also try 'shipments' table (supporting alternative table name in Supabase schema)
      try {
        console.log('[Supabase Operation] Attempting sync to alternative table public.shipments...');
        const { error: shipmentsErr } = await supabase.from('shipments').upsert({
          id: validId,
          invoice_no: shipToSave.invoiceNo,
          packing_list_no: shipToSave.packingListNo,
          shipment_date: shipToSave.shipmentDate,
          buyer: shipToSave.buyer,
          style_no: shipToSave.styleNo,
          po_no: shipToSave.poNo,
          colour: shipToSave.colour,
          size: shipToSave.size || 'All Sizes',
          shipped_qty: shipToSave.shippedQty,
          order_qty: shipToSave.orderQty,
          balance_qty: shipToSave.balanceQty,
          carton_count: shipToSave.cartonCount,
          vessel_or_flight: shipToSave.vesselOrFlight || null,
          container_no: shipToSave.containerNo || null,
          port_of_loading: shipToSave.portOfLoading || null,
          port_of_discharge: shipToSave.portOfDischarge || null,
          status: shipToSave.status,
          prepared_by: shipToSave.preparedBy || null,
          remarks: encodedRemarks
        });

        if (shipmentsErr) {
          // Retry with alternative column names in shipments table
          await supabase.from('shipments').upsert({
            id: validId,
            invoice_no: shipToSave.invoiceNo,
            packing_list_no: shipToSave.packingListNo,
            shipment_date: shipToSave.shipmentDate,
            date: shipToSave.shipmentDate,
            buyer: shipToSave.buyer,
            style_no: shipToSave.styleNo,
            po_no: shipToSave.poNo,
            colour: shipToSave.colour,
            shipped_qty: shipToSave.shippedQty,
            quantity: shipToSave.shippedQty,
            order_qty: shipToSave.orderQty,
            balance_qty: shipToSave.balanceQty,
            carton_count: shipToSave.cartonCount,
            cartons: shipToSave.cartonCount,
            status: shipToSave.status
          });
        }
      } catch (err: any) {
        console.warn('Supabase saveShipmentRecord shipments exception:', err);
      }
    }

    this.cache.shipmentRecords = [shipToSave, ...this.cache.shipmentRecords.filter(s => s.id !== validId)];

    // Check and auto-update order completion status
    const targetStyleNo = (shipToSave.styleNo || '').trim().toUpperCase();
    const existingOrder = this.cache.orders.find(o => (o.styleNo || '').trim().toUpperCase() === targetStyleNo);
    if (existingOrder) {
      const allUpdatedOrders = this.getOrders();
      const updatedOrder = allUpdatedOrders.find(o => (o.styleNo || '').trim().toUpperCase() === targetStyleNo);
      if (updatedOrder && (updatedOrder.status === 'Shipment Complete' || updatedOrder.status === 'Completed')) {
        existingOrder.status = 'Shipment Complete';
        existingOrder.purchaseOrders = updatedOrder.purchaseOrders;
        if (isSupabaseConfigured()) {
          try {
            await supabase.from('order_styles').upsert({
              id: existingOrder.id,
              status: 'Shipment Complete'
            });
            await supabase.from('orders').upsert({
              id: existingOrder.id,
              status: 'Shipment Complete'
            });
          } catch (err: any) {
            console.warn('Supabase update order status exception:', err);
          }
        }
      }
    }

    this.persistToLocalStore();
    await this.addAuditLog(
      activeUser || 'Shipment Officer',
      'DEPT_USER',
      'Shipment',
      'Save Shipment Consignment Entry',
      'Shipment',
      validId,
      undefined,
      `Consignment: ${shipToSave.invoiceNo} (${shipToSave.shippedQty} pcs) Style: ${shipToSave.styleNo}`
    );
    this.notify();
    console.log('%c[MJAL ERP DB Service] saveShipmentRecord completed successfully.', 'color: #2563eb; font-weight: bold;');
    console.groupEnd();
    return { success: true };
  }

  public async deleteShipmentRecord(id: string, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    console.groupCollapsed(`%c[MJAL ERP Supabase DataService] deleteShipmentRecord: ID ${id}`, 'color: #dc2626; font-weight: bold;');
    console.log('Deleting shipment record ID:', id);

    if (isSupabaseConfigured()) {
      try {
        const { error: delErr } = await supabase.from('shipment_records').delete().eq('id', id);
        if (delErr) {
          console.warn('[Supabase Warning] Delete from shipment_records:', delErr);
          if (delErr.code === '42501' || delErr.message?.toLowerCase().includes('row-level security')) {
            console.error('%c[Supabase RLS Block] Delete blocked by RLS on shipment_records.', 'color: #dc2626;');
          }
        } else {
          console.log('[Supabase Success] Deleted from shipment_records');
        }
      } catch (err: any) {
        console.warn('Supabase delete from shipment_records exception:', err);
      }
      try {
        await supabase.from('shipments').delete().eq('id', id);
      } catch (err: any) {
        console.warn('Supabase delete from shipments exception:', err);
      }
    }

    this.cache.shipmentRecords = this.cache.shipmentRecords.filter(s => s.id !== id);
    this.persistToLocalStore();
    await this.addAuditLog(activeUser || 'Shipment Officer', 'DEPT_USER', 'Shipment', 'Delete Shipment Consignment', 'Shipment', id);
    this.notify();
    console.groupEnd();
    return { success: true };
  }

  // ==========================================
  // CRUD: INTER-DEPARTMENT TRANSFERS & HANDOVERS
  // ==========================================
  public async saveTransfer(transfer: InterDeptTransfer, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    const validId = ensureValidUUID(transfer.id);
    const transferToSave: InterDeptTransfer = {
      ...transfer,
      id: validId,
      transferType: transfer.transferType || 'Transfer',
      authorizedBy: transfer.authorizedBy || 'Md Myeedul Islam',
      authorizedDesignation: transfer.authorizedDesignation || 'General Manager',
      authorizedDate: transfer.authorizedDate || transfer.transferDate || new Date().toISOString().split('T')[0],
      createdAt: transfer.createdAt || new Date().toISOString()
    };

    // SERVER / DATABASE-SIDE VALIDATION:
    // Prevent UI bypass: Check output/3P-wash availability before saving any forward transfer
    if (transferToSave.transferType === 'Transfer' && transferToSave.status !== 'Rejected') {
      const itemsToValidate = (transferToSave.items && transferToSave.items.length > 0)
        ? transferToSave.items.map(it => ({
            styleNo: it.styleNo || transferToSave.styleNo || '',
            poNo: it.poNo || transferToSave.poNo || '',
            colour: it.colour || transferToSave.colour || '',
            size: it.size || transferToSave.size || 'All Sizes',
            quantity: it.quantity || 0
          }))
        : [{
            styleNo: transferToSave.styleNo || '',
            poNo: transferToSave.poNo || '',
            colour: transferToSave.colour || '',
            size: transferToSave.size || 'All Sizes',
            quantity: transferToSave.quantity || 0
          }];

      const validation = validateDepartmentTransfer(
        transferToSave.fromDepartment,
        itemsToValidate,
        'Transfer',
        transferToSave.id
      );

      if (!validation.isValid) {
        const errorMsg = validation.errors[0] || 'Transfer quantity exceeds available output quantity.';
        console.error('[Database Transfer Validation Blocked]', errorMsg);
        globalToast.error(errorMsg);
        return { success: false, error: errorMsg };
      }
    }

    if (isSupabaseConfigured()) {
      try {
        const remarksWithJson = (transferToSave.items && transferToSave.items.length > 0)
          ? `${(transferToSave.remarks || '').split('__ITEMS_JSON__:')[0].trim()} __ITEMS_JSON__:${JSON.stringify(transferToSave.items)}`.trim()
          : (transferToSave.remarks || null);

        const { error } = await supabase.from('inter_dept_transfers').upsert({
          id: validId,
          challan_no: transferToSave.challanNo,
          transfer_date: transferToSave.transferDate,
          from_department: transferToSave.fromDepartment,
          to_department: transferToSave.toDepartment,
          buyer: transferToSave.buyer,
          style_no: transferToSave.styleNo,
          po_no: transferToSave.poNo,
          colour: transferToSave.colour,
          size: transferToSave.size,
          garment_type: transferToSave.garmentType,
          is_wash_garment: transferToSave.isWashGarment,
          quantity: transferToSave.quantity,
          bundle_count: transferToSave.bundleCount || null,
          line_no: transferToSave.lineNo || null,
          vendor_name: transferToSave.vendorName || null,
          vehicle_no: transferToSave.vehicleNo || null,
          driver_name: transferToSave.driverName || null,
          sender_name: transferToSave.senderName,
          receiver_name: transferToSave.receiverName || null,
          status: transferToSave.status,
          receive_date: transferToSave.receiveDate || null,
          remarks: remarksWithJson
        });

        if (error) {
          console.warn('Supabase transfer sync warning:', error.message);
        }
      } catch (err: any) {
        console.warn('Supabase transfer sync exception:', err);
      }
    }

    this.cache.transfers = [transferToSave, ...this.cache.transfers.filter(t => t.id !== validId)];
    
    if (transferToSave.status === 'Received') {
      this.autoReceiveTransferToDepartmentRecords(
        transferToSave,
        transferToSave.receiverName || transferToSave.senderName,
        transferToSave.receiveDate || transferToSave.transferDate
      );
    }

    this.persistToLocalStore();

    const isReturn = transferToSave.transferType === 'Return';
    await this.addAuditLog(
      activeUser || transferToSave.senderName,
      'DEPT_USER',
      transferToSave.fromDepartment as any,
      isReturn
        ? `Product Return from ${transferToSave.fromDepartment} to ${transferToSave.toDepartment}`
        : `Transfer from ${transferToSave.fromDepartment} to ${transferToSave.toDepartment}`,
      'Production Flow',
      validId,
      undefined,
      `${isReturn ? 'Return Challan' : 'Challan'}: ${transferToSave.challanNo} - ${transferToSave.quantity} pcs (${transferToSave.styleNo}) | Authorized: ${transferToSave.authorizedBy}`
    );

    // Auto-generate notification for the receiver department if newly dispatched / in transit
    if (transferToSave.status === 'Dispatched' || transferToSave.status === 'In Transit') {
      await this.addNotification({
        title: `Incoming ${isReturn ? 'Return' : 'Handover'}: Challan #${transferToSave.challanNo}`,
        message: `${transferToSave.fromDepartment} dispatched ${transferToSave.quantity.toLocaleString()} pcs for Style ${transferToSave.styleNo} (PO: ${transferToSave.poNo}) to ${transferToSave.toDepartment}. Pending receiver inspection.`,
        type: isReturn ? 'warning' : 'info',
        linkModule: 'transfers'
      });
      globalToast.success(
        `Challan #${transferToSave.challanNo} dispatched to ${transferToSave.toDepartment} (${transferToSave.quantity.toLocaleString()} pcs). Receiver notified.`,
        isReturn ? 'Return Challan Dispatched' : 'Handover Dispatched'
      );
    } else if (transferToSave.status === 'Received') {
      globalToast.success(
        `Challan #${transferToSave.challanNo} marked as received (${transferToSave.quantity.toLocaleString()} pcs).`,
        'Transfer Recorded'
      );
    }

    this.notify();
    return { success: true };
  }

  public async receiveTransfer(
    id: string,
    receiverName: string,
    activeUser?: string,
    receivedQty?: number
  ): Promise<{ success: boolean; error?: string }> {
    const existing = this.cache.transfers.find(t => t.id === id);
    if (!existing) return { success: false, error: 'Transfer not found' };

    const receiveDate = new Date().toISOString().split('T')[0];
    const receiver = receiverName || activeUser || 'Department Receiver';
    const totalQty = Number(existing.quantity) || 0;
    const actualReceived = (receivedQty !== undefined && receivedQty !== null && Number(receivedQty) > 0)
      ? Math.min(Number(receivedQty), totalQty)
      : totalQty;

    const isPartial = actualReceived < totalQty && actualReceived > 0;
    const remainingQty = totalQty - actualReceived;

    // Distribute items for partial receive if items exist
    let receivedItems = existing.items;
    let remainingItems = existing.items;

    if (isPartial && existing.items && existing.items.length > 0) {
      let allocatedRecv = 0;
      receivedItems = existing.items.map((it, idx) => {
        const portion = (idx === existing.items!.length - 1)
          ? Math.max(0, actualReceived - allocatedRecv)
          : Math.round((actualReceived * (it.quantity || 0)) / (totalQty || 1));
        allocatedRecv += portion;
        return {
          ...it,
          quantity: portion
        };
      });

      let allocatedRem = 0;
      remainingItems = existing.items.map((it, idx) => {
        const portion = (idx === existing.items!.length - 1)
          ? Math.max(0, remainingQty - allocatedRem)
          : Math.round((remainingQty * (it.quantity || 0)) / (totalQty || 1));
        allocatedRem += portion;
        return {
          ...it,
          quantity: portion
        };
      });
    }

    // 1. Prepare Received Record
    const receivedRecordId = isPartial ? `${existing.id}-recv-${Date.now()}` : existing.id;
    const receivedTransfer: InterDeptTransfer = {
      ...existing,
      id: receivedRecordId,
      quantity: actualReceived,
      items: receivedItems,
      status: 'Received',
      receiverName: receiver,
      receiveDate,
      remarks: isPartial
        ? `${existing.remarks ? existing.remarks + ' | ' : ''}Partial receive: ${actualReceived} pcs of ${totalQty} pcs`
        : existing.remarks
    };

    // 2. If Partial, prepare Remaining Balance Record (keeps status 'Dispatched' so it stays in Inbound Review queue)
    let remainingTransfer: InterDeptTransfer | null = null;
    if (isPartial) {
      remainingTransfer = {
        ...existing,
        id: existing.id,
        quantity: remainingQty,
        items: remainingItems,
        status: 'Dispatched',
        receiverName: undefined,
        receiveDate: undefined,
        remarks: `${existing.remarks ? existing.remarks + ' | ' : ''}Remaining balance: ${remainingQty} pcs (after ${actualReceived} pcs received)`
      };
    }

    if (isSupabaseConfigured()) {
      try {
        if (isPartial && remainingTransfer) {
          const remRemarksWithJson = (remainingTransfer.items && remainingTransfer.items.length > 0)
            ? `${(remainingTransfer.remarks || '').split('__ITEMS_JSON__:')[0].trim()} __ITEMS_JSON__:${JSON.stringify(remainingTransfer.items)}`.trim()
            : (remainingTransfer.remarks || null);

          const recvRemarksWithJson = (receivedTransfer.items && receivedTransfer.items.length > 0)
            ? `${(receivedTransfer.remarks || '').split('__ITEMS_JSON__:')[0].trim()} __ITEMS_JSON__:${JSON.stringify(receivedTransfer.items)}`.trim()
            : (receivedTransfer.remarks || null);

          // Update original record with remaining quantity
          await supabase.from('inter_dept_transfers').update({
            quantity: remainingTransfer.quantity,
            status: 'Dispatched',
            remarks: remRemarksWithJson
          }).eq('id', existing.id);

          // Insert new received portion record
          await supabase.from('inter_dept_transfers').insert({
            id: receivedTransfer.id,
            challan_no: `${receivedTransfer.challanNo}-R`,
            transfer_date: receivedTransfer.transferDate,
            from_department: receivedTransfer.fromDepartment,
            to_department: receivedTransfer.toDepartment,
            buyer: receivedTransfer.buyer,
            style_no: receivedTransfer.styleNo,
            po_no: receivedTransfer.poNo,
            colour: receivedTransfer.colour,
            size: receivedTransfer.size,
            garment_type: receivedTransfer.garmentType,
            is_wash_garment: receivedTransfer.isWashGarment,
            quantity: receivedTransfer.quantity,
            bundle_count: receivedTransfer.bundleCount || null,
            line_no: receivedTransfer.lineNo || null,
            vendor_name: receivedTransfer.vendorName || null,
            vehicle_no: receivedTransfer.vehicleNo || null,
            driver_name: receivedTransfer.driverName || null,
            sender_name: receivedTransfer.senderName,
            receiver_name: receivedTransfer.receiverName,
            status: 'Received',
            receive_date: receivedTransfer.receiveDate,
            remarks: recvRemarksWithJson
          });
        } else {
          await supabase.from('inter_dept_transfers').update({
            status: 'Received',
            receiver_name: receivedTransfer.receiverName,
            receive_date: receivedTransfer.receiveDate
          }).eq('id', id);
        }
      } catch (err) {
        console.warn('Supabase receive transfer error:', err);
      }
    }

    // Update Cache
    if (isPartial && remainingTransfer) {
      this.cache.transfers = [
        receivedTransfer,
        ...this.cache.transfers.map(t => t.id === existing.id ? remainingTransfer! : t)
      ];
    } else {
      this.cache.transfers = this.cache.transfers.map(t => t.id === id ? receivedTransfer : t);
    }

    // Automatically register and match received products by Buyer, Style, PO, Colour and Size
    this.autoReceiveTransferToDepartmentRecords(receivedTransfer, receiver, receiveDate);

    await this.addAuditLog(
      activeUser || receiver,
      'DEPT_USER',
      receivedTransfer.toDepartment as any,
      isPartial
        ? `Partial Receive from ${receivedTransfer.fromDepartment} (${actualReceived} of ${totalQty} pcs)`
        : `Receive Handover from ${receivedTransfer.fromDepartment}`,
      'Production Flow',
      id,
      undefined,
      `Received Challan ${receivedTransfer.challanNo} (${actualReceived} pcs of ${receivedTransfer.styleNo})${isPartial ? `. Remaining balance: ${remainingQty} pcs in inbound queue.` : ''}`
    );

    // Notify sender department that goods have been received
    await this.addNotification({
      title: `Handover Acknowledged: Challan #${receivedTransfer.challanNo}`,
      message: `${receivedTransfer.toDepartment} (${receiver}) confirmed receipt of ${actualReceived.toLocaleString()} pcs from ${receivedTransfer.fromDepartment}.${isPartial ? ` (${remainingQty.toLocaleString()} pcs remaining balance)` : ''}`,
      type: 'success',
      linkModule: 'transfers'
    });

    globalToast.success(
      `Received Challan #${receivedTransfer.challanNo} (${actualReceived.toLocaleString()} pcs) in ${receivedTransfer.toDepartment}.`,
      'Handover Confirmed'
    );

    this.notify();
    return { success: true };
  }

  public async deleteTransfer(id: string, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('inter_dept_transfers').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase delete transfer error:', err);
      }
    }

    this.cache.transfers = this.cache.transfers.filter(t => t.id !== id);
    await this.addAuditLog(activeUser || 'Admin', 'DEPT_USER', 'Production Planning' as any, 'Delete Transfer Challan', 'Production Flow', id);
    this.notify();
    return { success: true };
  }

  public async clearAllTransfers(activeUser?: string): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('inter_dept_transfers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (err) {
        console.warn('Supabase clear transfers error:', err);
      }
    }

    this.cache.transfers = [];
    await this.addAuditLog(activeUser || 'Admin', 'DEPT_USER', 'Production Planning' as any, 'Clear All Transfer Challans', 'Production Flow', 'ALL');
    this.notify();
    return { success: true };
  }

  // ==========================================
  // CRUD: EMPLOYEES & HR
  // ==========================================
  public async saveEmployee(emp: Employee, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    const startTime = Date.now();
    const validId = ensureValidUUID(emp.id);
    const empToSave = { ...emp, id: validId };

    if (isSupabaseConfigured()) {
      const payload = {
        id: validId,
        emp_id: empToSave.empId,
        name: empToSave.name,
        designation: empToSave.designation,
        department: empToSave.department,
        section: empToSave.section,
        shift: empToSave.shift,
        joining_date: empToSave.joiningDate || null,
        phone: empToSave.phone,
        email: empToSave.email || null,
        basic_salary: empToSave.basicSalary,
        ot_rate_per_hour: empToSave.otRatePerHour,
        status: empToSave.status
      };

      const { error } = await supabase.from('employees').upsert(payload);

      if (error) {
        supabaseLogger.logError('employees', 'UPSERT', error, payload, {
          module: 'HR & Admin',
          user: activeUser || 'HR Admin',
          durationMs: Date.now() - startTime
        });
        return { success: false, error: error.message };
      }

      supabaseLogger.logSuccess('employees', 'UPSERT', payload, {
        module: 'HR & Admin',
        user: activeUser || 'HR Admin',
        durationMs: Date.now() - startTime
      });
    }

    this.cache.employees = this.cache.employees.filter(e => e.id !== validId).concat(empToSave);
    await this.addAuditLog(activeUser || 'HR Admin', 'SUPER_ADMIN', 'HR & Admin', 'Save Employee', 'HR & Admin', validId, undefined, `${empToSave.name} (${empToSave.empId})`);
    this.notify();
    return { success: true };
  }

  public async deleteEmployee(id: string, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    const startTime = Date.now();
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) {
        supabaseLogger.logError('employees', 'DELETE', error, { id }, {
          module: 'HR & Admin',
          user: activeUser || 'HR Admin',
          durationMs: Date.now() - startTime
        });
        return { success: false, error: error.message };
      }
      supabaseLogger.logSuccess('employees', 'DELETE', { id }, {
        module: 'HR & Admin',
        user: activeUser || 'HR Admin',
        durationMs: Date.now() - startTime
      });
    }

    this.cache.employees = this.cache.employees.filter(e => e.id !== id);
    await this.addAuditLog(activeUser || 'HR Admin', 'SUPER_ADMIN', 'HR & Admin', 'Delete Employee', 'HR & Admin', id);
    this.notify();
    return { success: true };
  }

  public async saveAttendance(att: AttendanceRecord, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    const startTime = Date.now();
    const validId = ensureValidUUID(att.id);
    const attToSave = { ...att, id: validId };

    if (isSupabaseConfigured()) {
      const payload: any = {
        id: validId,
        date: attToSave.date,
        emp_id: attToSave.empId,
        emp_name: attToSave.empName,
        name: attToSave.empName,
        department: attToSave.department,
        in_time: attToSave.inTime,
        out_time: attToSave.outTime,
        ot_hours: attToSave.otHours,
        status: attToSave.status
      };

      let { error } = await supabase.from('attendance_records').upsert(payload);

      if (error && error.message?.includes('column')) {
        delete payload.emp_name;
        const retry = await supabase.from('attendance_records').upsert(payload);
        error = retry.error;
      }

      if (error) {
        supabaseLogger.logError('attendance_records', 'UPSERT', error, payload, {
          module: 'HR & Admin',
          user: activeUser || 'HR Admin',
          durationMs: Date.now() - startTime
        });
        return { success: false, error: error.message };
      }

      supabaseLogger.logSuccess('attendance_records', 'UPSERT', payload, {
        module: 'HR & Admin',
        user: activeUser || 'HR Admin',
        durationMs: Date.now() - startTime
      });
    }

    this.cache.attendance = [attToSave, ...this.cache.attendance.filter(a => a.id !== validId)];
    await this.addAuditLog(activeUser || 'HR Admin', 'SUPER_ADMIN', 'HR & Admin', 'Save Attendance', 'HR & Admin', validId, undefined, `${attToSave.empName} - ${attToSave.status}`);
    this.notify();
    return { success: true };
  }

  public async deleteAttendance(id: string, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    const startTime = Date.now();
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('attendance_records').delete().eq('id', id);
      if (error) {
        supabaseLogger.logError('attendance_records', 'DELETE', error, { id }, {
          module: 'HR & Admin',
          user: activeUser || 'HR Admin',
          durationMs: Date.now() - startTime
        });
        return { success: false, error: error.message };
      }
      supabaseLogger.logSuccess('attendance_records', 'DELETE', { id }, {
        module: 'HR & Admin',
        user: activeUser || 'HR Admin',
        durationMs: Date.now() - startTime
      });
    }

    this.cache.attendance = this.cache.attendance.filter(a => a.id !== id);
    await this.addAuditLog(activeUser || 'HR Admin', 'SUPER_ADMIN', 'HR & Admin', 'Delete Attendance', 'HR & Admin', id);
    this.notify();
    return { success: true };
  }

  public async savePayroll(pay: PayrollRecord, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    const startTime = Date.now();
    const validId = ensureValidUUID(pay.id);
    const payToSave = { ...pay, id: validId };

    if (isSupabaseConfigured()) {
      const payload: any = {
        id: validId,
        month: payToSave.month,
        emp_id: payToSave.empId,
        emp_name: payToSave.empName,
        name: payToSave.empName,
        department: payToSave.department,
        basic_salary: Number(payToSave.basicSalary || 0),
        house_rent: Number(payToSave.houseRent || 0),
        medical_allowance: Number(payToSave.medicalAllowance || 0),
        ot_hours: Number(payToSave.otHours || 0),
        ot_amount: Number(payToSave.otAmount || 0),
        deductions: Number(payToSave.deductions || 0),
        net_salary: Number(payToSave.netSalary || 0),
        status: payToSave.status || 'Pending'
      };

      let { error } = await supabase.from('payroll_records').upsert(payload);

      // Resilient fallback if emp_name column does not exist or schema has variance
      if (error && (error.message?.includes('column') || error.code === '42703')) {
        supabaseLogger.logWarning('payroll_records', 'UPSERT', `Schema variance detected (${error.message}). Attempting adaptive column mapping.`, payload, {
          module: 'HR & Admin / Payroll Allowance',
          user: activeUser || 'HR Admin'
        });

        const fallbackPayload: any = {
          id: validId,
          month: payToSave.month,
          emp_id: payToSave.empId,
          name: payToSave.empName,
          department: payToSave.department,
          basic_salary: Number(payToSave.basicSalary || 0),
          house_rent: Number(payToSave.houseRent || 0),
          medical_allowance: Number(payToSave.medicalAllowance || 0),
          ot_hours: Number(payToSave.otHours || 0),
          ot_amount: Number(payToSave.otAmount || 0),
          deductions: Number(payToSave.deductions || 0),
          net_salary: Number(payToSave.netSalary || 0),
          status: payToSave.status || 'Pending'
        };

        const retry = await supabase.from('payroll_records').upsert(fallbackPayload);
        error = retry.error;
      }

      if (error) {
        supabaseLogger.logError('payroll_records', 'UPSERT', error, payload, {
          module: 'HR & Admin / Payroll Allowance',
          user: activeUser || 'HR Admin',
          durationMs: Date.now() - startTime
        });
        return { success: false, error: error.message };
      }

      supabaseLogger.logSuccess('payroll_records', 'UPSERT', payload, {
        module: 'HR & Admin / Payroll Allowance',
        user: activeUser || 'HR Admin',
        durationMs: Date.now() - startTime
      });
    }

    this.cache.payroll = [payToSave, ...this.cache.payroll.filter(p => p.id !== validId)];
    await this.addAuditLog(activeUser || 'HR Admin', 'SUPER_ADMIN', 'HR & Admin', 'Save Payroll', 'HR & Admin', validId, undefined, `${payToSave.empName} (${payToSave.month})`);
    this.notify();
    return { success: true };
  }

  // Auto-receive and synchronize department records matching Buyer, Style, PO, Colour and Size
  public autoReceiveTransferToDepartmentRecords(
    receivedTransfer: InterDeptTransfer,
    receiver: string,
    receiveDate: string
  ) {
    const orders = this.cache.orders;
    const targetDept = receivedTransfer.toDepartment;
    
    // 1. Resolve exact 5-point items: (buyer, styleNo, poNo, colour, size, quantity)
    interface ResolvedReceiveItem {
      buyer: string;
      styleNo: string;
      poNo: string;
      colour: string;
      size: string;
      quantity: number;
    }
    const resolvedItems: ResolvedReceiveItem[] = [];

    if (receivedTransfer.items && receivedTransfer.items.length > 0) {
      receivedTransfer.items.forEach(it => {
        const qty = Number(it.quantity) || 0;
        if (qty <= 0) return;
        resolvedItems.push({
          buyer: it.buyer || receivedTransfer.buyer || '',
          styleNo: (it.styleNo || receivedTransfer.styleNo || '').trim(),
          poNo: (it.poNo || receivedTransfer.poNo || '').trim(),
          colour: (it.colour || receivedTransfer.colour || '').trim(),
          size: it.size || receivedTransfer.size || 'All Sizes',
          quantity: qty
        });
      });
    } else {
      // Deconstruct header into matching style/po/colour/sizes from master orders
      const sNo = (receivedTransfer.styleNo || '').trim();
      const pos = splitMultipleValues(receivedTransfer.poNo);
      const colours = splitMultipleValues(receivedTransfer.colour);
      const totalTransferQty = Number(receivedTransfer.quantity) || 0;

      const matchingOrder = orders.find(o => (o.styleNo || '').trim().toUpperCase() === sNo.toUpperCase());
      if (matchingOrder) {
        const buyer = matchingOrder.buyer || receivedTransfer.buyer || '';
        // Find matching POs & Colours
        const targetPos = (matchingOrder.purchaseOrders || []).filter(p => 
          pos.length === 0 || pos.some(po => matchesCandidateOrList(p.poNo, po))
        );

        const candidateColours: Array<{ poNo: string; colour: string; sizeQuantities: Record<string, number>; totalQty: number }> = [];
        targetPos.forEach(po => {
          (po.colours || []).forEach(col => {
            if (colours.length === 0 || colours.some(c => matchesCandidateOrList(col.colour, c))) {
              candidateColours.push({
                poNo: po.poNo,
                colour: col.colour,
                sizeQuantities: col.sizeQuantities || {},
                totalQty: col.totalQty || 0
              });
            }
          });
        });

        if (candidateColours.length > 0) {
          const totalTarget = candidateColours.reduce((s, c) => s + (c.totalQty || 0), 0) || totalTransferQty || 1;
          let allocatedTotal = 0;
          candidateColours.forEach((cand, cIdx) => {
            const colourQty = (cIdx === candidateColours.length - 1)
              ? Math.max(0, totalTransferQty - allocatedTotal)
              : Math.round((totalTransferQty * (cand.totalQty || 1)) / totalTarget);
            allocatedTotal += colourQty;

            const sizeEntries = Object.entries(cand.sizeQuantities);
            const totalSizeTarget = sizeEntries.reduce((s, [, q]) => s + (Number(q) || 0), 0) || colourQty || 1;
            
            if (sizeEntries.length > 0) {
              let allocatedSize = 0;
              sizeEntries.forEach(([sz, q], sIdx) => {
                const szQty = (sIdx === sizeEntries.length - 1)
                  ? Math.max(0, colourQty - allocatedSize)
                  : Math.round((colourQty * (Number(q) || 0)) / totalSizeTarget);
                allocatedSize += szQty;
                if (szQty > 0) {
                  resolvedItems.push({
                    buyer,
                    styleNo: sNo,
                    poNo: cand.poNo,
                    colour: cand.colour,
                    size: sz,
                    quantity: szQty
                  });
                }
              });
            } else {
              resolvedItems.push({
                buyer,
                styleNo: sNo,
                poNo: cand.poNo,
                colour: cand.colour,
                size: receivedTransfer.size || 'All Sizes',
                quantity: colourQty
              });
            }
          });
        }
      }

      // Fallback if no matching order found
      if (resolvedItems.length === 0 && totalTransferQty > 0) {
        resolvedItems.push({
          buyer: receivedTransfer.buyer || '',
          styleNo: sNo,
          poNo: receivedTransfer.poNo || '',
          colour: receivedTransfer.colour || '',
          size: receivedTransfer.size || 'All Sizes',
          quantity: totalTransferQty
        });
      }
    }

    // 2. Synchronize into target department records
    if (targetDept === 'Finishing') {
      resolvedItems.forEach(item => {
        const normStyle = item.styleNo.toUpperCase();
        const normPo = item.poNo.toUpperCase();
        const normCol = item.colour.toUpperCase();
        const normSz = normalizeSizeName(item.size);

        const existingFin = this.cache.finishingRecords.find(f => 
          (f.styleNo || '').trim().toUpperCase() === normStyle &&
          (f.poNo || '').trim().toUpperCase() === normPo &&
          (f.colour || '').trim().toUpperCase() === normCol &&
          (normalizeSizeName(f.size) === normSz || (!f.size && normSz === 'ALL SIZES'))
        );

        if (existingFin) {
          const updatedFin: FinishingRecord = {
            ...existingFin,
            buyer: existingFin.buyer || item.buyer,
            sewingReceiveQty: (existingFin.sewingReceiveQty || 0) + item.quantity,
            finishingInputQty: (existingFin.finishingInputQty || 0) + item.quantity
          };
          this.cache.finishingRecords = this.cache.finishingRecords.map(f => f.id === existingFin.id ? updatedFin : f);
        } else {
          const newFin: FinishingRecord = {
            id: 'fin-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
            date: receiveDate,
            buyer: item.buyer,
            styleNo: item.styleNo,
            poNo: item.poNo,
            colour: item.colour,
            size: item.size,
            sewingReceiveQty: item.quantity,
            finishingInputQty: item.quantity,
            ironedQty: 0,
            foldedQty: 0,
            taggedQty: 0,
            packedQty: 0,
            reworkQty: 0,
            rejectQty: 0,
            finishedQty: 0,
            operator: receiver
          };
          this.cache.finishingRecords = [newFin, ...this.cache.finishingRecords];
        }
      });
    } else if (targetDept === 'Washing') {
      resolvedItems.forEach(item => {
        const normStyle = item.styleNo.toUpperCase();
        const normPo = item.poNo.toUpperCase();
        const normCol = item.colour.toUpperCase();
        const normSz = normalizeSizeName(item.size);

        const existingWash = this.cache.washingRecords.find(w => 
          (w.styleNo || '').trim().toUpperCase() === normStyle &&
          (w.poNo || '').trim().toUpperCase() === normPo &&
          (w.colour || '').trim().toUpperCase() === normCol &&
          (normalizeSizeName(w.size) === normSz || (!w.size && normSz === 'ALL SIZES'))
        );

        if (existingWash) {
          const updatedWash: WashingRecord = {
            ...existingWash,
            buyer: existingWash.buyer || item.buyer,
            receivedQty: (existingWash.receivedQty || 0) + item.quantity
          };
          this.cache.washingRecords = this.cache.washingRecords.map(w => w.id === existingWash.id ? updatedWash : w);
        } else {
          const newWash: WashingRecord = {
            id: 'wash-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
            challanNo: receivedTransfer.challanNo || ('WASH-' + Date.now()),
            date: receiveDate,
            vendorName: receivedTransfer.vendorName || 'In-house Wash',
            washType: 'Normal',
            buyer: item.buyer,
            styleNo: item.styleNo,
            poNo: item.poNo,
            colour: item.colour,
            size: item.size,
            sentQty: item.quantity,
            receivedQty: item.quantity,
            damageQty: 0,
            rejectQty: 0,
            balanceQty: 0,
            status: 'Received'
          };
          this.cache.washingRecords = [newWash, ...this.cache.washingRecords];
        }
      });
    }
  }

  public async deletePayroll(id: string, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    const startTime = Date.now();
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('payroll_records').delete().eq('id', id);
      if (error) {
        supabaseLogger.logError('payroll_records', 'DELETE', error, { id }, {
          module: 'HR & Admin / Payroll Allowance',
          user: activeUser || 'HR Admin',
          durationMs: Date.now() - startTime
        });
        return { success: false, error: error.message };
      }
      supabaseLogger.logSuccess('payroll_records', 'DELETE', { id }, {
        module: 'HR & Admin / Payroll Allowance',
        user: activeUser || 'HR Admin',
        durationMs: Date.now() - startTime
      });
    }

    this.cache.payroll = this.cache.payroll.filter(p => p.id !== id);
    await this.addAuditLog(activeUser || 'HR Admin', 'SUPER_ADMIN', 'HR & Admin', 'Delete Payroll', 'HR & Admin', id);
    this.notify();
    return { success: true };
  }

  // ==========================================
  // CRUD: MASTER DATA
  // ==========================================
  public async saveMasterItem(
    item: MasterDataItem,
    activeUser?: string,
    userEmail?: string,
    userDept?: string
  ): Promise<{ success: boolean; error?: string }> {
    const validId = ensureValidUUID(item.id);
    const createdBy = item.createdBy || activeUser || 'Admin';
    const creatorEmail = item.creatorEmail || userEmail;
    const createdDepartment = item.createdDepartment || userDept || 'Merchandising';

    const metaObj: Record<string, any> = {};
    if (createdBy) metaObj.createdBy = createdBy;
    if (creatorEmail) metaObj.creatorEmail = creatorEmail;
    if (createdDepartment) metaObj.createdDepartment = createdDepartment;
    metaObj.createdAt = item.createdAt || new Date().toISOString();

    const rawDesc = item.description || '';
    const cleanDesc = rawDesc.includes('__CREATOR_META__:')
      ? rawDesc.split('__CREATOR_META__:')[0].trim()
      : rawDesc.trim();

    const descWithMeta = cleanDesc
      ? `${cleanDesc} __CREATOR_META__:${JSON.stringify(metaObj)}`
      : `__CREATOR_META__:${JSON.stringify(metaObj)}`;

    const itemToSave: MasterDataItem = {
      ...item,
      id: validId,
      createdBy,
      creatorEmail,
      createdDepartment,
      createdAt: metaObj.createdAt,
      description: cleanDesc || undefined
    };

    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('master_data').upsert({
        id: validId,
        category: itemToSave.category,
        code: itemToSave.code,
        name: itemToSave.name,
        description: descWithMeta || null,
        status: itemToSave.status
      });

      if (error) return { success: false, error: error.message };
    }

    this.cache.masterData = this.cache.masterData.filter(m => m.id !== validId).concat(itemToSave);
    await this.addAuditLog(activeUser || 'Admin', 'SUPER_ADMIN', 'HR & Admin', 'Save Master Data', 'Master Data', validId, undefined, itemToSave.name);
    this.notify();
    return { success: true };
  }

  public async deleteMasterItem(id: string, activeUser?: string): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('master_data').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
    }

    this.cache.masterData = this.cache.masterData.filter(m => m.id !== id);
    await this.addAuditLog(activeUser || 'Admin', 'SUPER_ADMIN', 'HR & Admin', 'Delete Master Data', 'Master Data', id);
    this.notify();
    return { success: true };
  }
}

export const supabaseDataService = new SupabaseDataService();
