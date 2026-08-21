import { User, Department, Permission, CuttingEntry, SewingProduction, StoreStockItem, MasterDataItem, OrderStyle } from '../types';

export const isSuperAdmin = (user: User | null): boolean => {
  if (!user) return false;
  return user.role === 'SUPER_ADMIN';
};

export const isHRAdmin = (user: User | null): boolean => {
  if (!user) return false;
  return (
    user.role === 'HR_ADMIN' ||
    (user.role === 'SUPER_ADMIN' && user.department === 'HR & Admin')
  );
};

export const isMD = (user: User | null): boolean => {
  if (!user) return false;
  const role = (user.role || '').trim();
  return (
    role === 'MD' ||
    role === 'Managing Director (MD)' ||
    role === 'Managing Director' ||
    role.toUpperCase() === 'MD' ||
    role.toUpperCase().includes('MANAGING DIRECTOR')
  );
};

export const isManagement = (user: User | null): boolean => {
  if (!user) return false;
  return ['MD', 'DIRECTOR', 'GM', 'Managing Director (MD)', 'Director', 'General Manager (GM)'].includes(user.role);
};

export const isGlobalUser = (user: User | null): boolean => {
  return isSuperAdmin(user) || isHRAdmin(user) || isManagement(user);
};

export const canViewExecutiveOrderSummary = (user: User | null): boolean => {
  if (!user) return false;
  return isSuperAdmin(user) || isHRAdmin(user) || isManagement(user);
};

export const isDepartmentUser = (user: User | null): boolean => {
  if (!user) return false;
  return user.role === 'DEPT_USER';
};

export const isSectionUser = (user: User | null): boolean => {
  if (!user) return false;
  return user.role === 'SECTION_USER';
};

export const isLineUser = (user: User | null): boolean => {
  if (!user) return false;
  return user.role === 'LINE_USER';
};

export const hasValidScope = (user: User | null): boolean => {
  if (!user) return false;
  if (isGlobalUser(user)) return true;
  return Boolean(user.department && user.department.trim().length > 0);
};

export const getDefaultModuleForUser = (user: User | null): string => {
  if (!user) return 'dashboard';
  return 'dashboard';
};

export const canAccessDepartment = (user: User | null, dept: Department): boolean => {
  if (!user) return false;
  if (isGlobalUser(user)) return true;
  return user.department === dept;
};

export const canAccessSection = (user: User | null, dept: Department, section?: string): boolean => {
  if (!user) return false;
  if (isGlobalUser(user)) return true;
  if (user.department !== dept) return false;
  if (!section || !user.section) return true;
  return (user.section || '').toLowerCase() === (section || '').toLowerCase();
};

export const canAccessLine = (user: User | null, dept: Department, lineNo?: string): boolean => {
  if (!user) return false;
  if (isGlobalUser(user)) return true;
  if (user.department !== dept) return false;
  const userLine = user.line_no || user.section;
  if (!lineNo || !userLine) return true;
  return (userLine || '').toLowerCase() === (lineNo || '').toLowerCase();
};

export const canAccessModule = (user: User | null, moduleId: string): boolean => {
  if (!user) return false;
  if (!hasValidScope(user)) return false;

  // Super Admin has unrestricted access across all modules
  if (isSuperAdmin(user)) return true;

  // MD (Managing Director) - Access granted strictly to the selected navigation panels:
  // 1. Main Executive Dashboard
  // 2. Order Management (orders)
  // 3. Merchandising & BOM (merchandising)
  // 4. Sample Follow-up (sample)
  // 5. Department Reports (all rpt_* reports)
  if (isMD(user)) {
    if (
      moduleId === 'dashboard' ||
      moduleId === 'dashboard_md' ||
      moduleId === 'orders' ||
      moduleId === 'merchandising' ||
      moduleId === 'sample' ||
      moduleId.startsWith('rpt_') ||
      moduleId === 'reports'
    ) {
      return true;
    }
    return false;
  }

  // HR Admin (Cannot manage users or master data, but can access employee directory & payroll)
  if (isHRAdmin(user)) {
    if (['hr_employees', 'hr_payroll', 'hr', 'dashboard', 'rpt_hr'].includes(moduleId)) return true;
    if (['hr_users', 'users', 'master_data', 'master'].includes(moduleId)) return false;
  }

  // Other Management (Director, GM) - Full access across Operations, Planning, Reports & Directory
  if (isManagement(user)) {
    if (['hr_users', 'users'].includes(moduleId)) return false;
    return true;
  }

  // Non-global Department Users (DEPT_USER, SECTION_USER, LINE_USER)
  // 1. Dashboard module is ALLOWED: It renders their own dedicated Department Section Dashboard
  if (moduleId === 'dashboard') return true;

  // 2. Executive dashboards forbidden
  if (['dashboard_md', 'dashboard_director', 'dashboard_gm'].includes(moduleId)) return false;

  // 3. Settings & User Management strictly forbidden
  if (['master_data', 'master', 'hr_users', 'users'].includes(moduleId)) return false;

  // 4. Monthly & Yearly Reporting System is accessible to all users (Department Users are strictly scoped to their own department)
  if (moduleId === 'rpt_monthly_yearly' || moduleId === 'rpt_monthly' || moduleId === 'reports') {
    return true;
  }

  // Department-specific reports allowed for users of that department
  if (moduleId.startsWith('rpt_')) {
    const dept = user.department;
    if (moduleId === 'rpt_cutting' && dept === 'Cutting') return true;
    if (moduleId === 'rpt_sewing' && (dept === 'Sewing' || dept === 'Production Planning')) return true;
    if (moduleId === 'rpt_washing' && dept === 'Washing') return true;
    if (moduleId === 'rpt_finishing' && dept === 'Finishing') return true;
    if (moduleId === 'rpt_qc' && dept === 'QC') return true;
    if (moduleId === 'rpt_packing' && (dept === 'Packing' || dept === 'Finishing')) return true;
    if (moduleId === 'rpt_store' && dept === 'Store') return true;
    if (moduleId === 'rpt_shipment' && (dept === 'Shipment' || dept === 'Packing')) return true;
    if (moduleId === 'rpt_merchandising' && (dept === 'Merchandising' || dept === 'Order Management')) return true;
    if (moduleId === 'rpt_hr' && dept === 'HR & Admin') return true;
    return false;
  }

  // 5. HR & Admin
  if (moduleId.startsWith('hr_') || moduleId === 'hr') {
    return user.department === 'HR & Admin';
  }

  // 6. Operational modules check against assigned department
  const dept = user.department;

  if (moduleId === 'orders') return dept === 'Order Management' || dept === 'Merchandising';
  if (moduleId === 'merchandising') return dept === 'Merchandising';
  if (moduleId === 'sample') return dept === 'Sample' || dept === 'Merchandising';
  if (moduleId === 'store' || moduleId.startsWith('store_')) return dept === 'Store';
  if (moduleId === 'cutting' || moduleId.startsWith('cutting_')) return dept === 'Cutting';
  if (moduleId === 'sewing' || moduleId.startsWith('sewing_') || moduleId === 'targets_daily' || moduleId === 'targets_monthly' || moduleId === 'targets_entry' || moduleId.startsWith('targets_')) {
    return dept === 'Sewing' || dept === 'Production Planning';
  }
  if (moduleId === 'ta_calendar') return dept === 'Production Planning' || dept === 'Merchandising' || dept === 'Sewing';
  if (moduleId === 'washing' || moduleId.startsWith('washing_')) return dept === 'Washing';
  if (moduleId === 'finishing' || moduleId.startsWith('finishing_')) return dept === 'Finishing';
  if (moduleId === 'qc' || moduleId.startsWith('qc_')) return dept === 'QC';
  if (moduleId === 'packing' || moduleId.startsWith('packing_')) return dept === 'Packing' || dept === 'Shipment' || dept === 'Finishing';
  if (moduleId === 'shipment' || moduleId.startsWith('shipment_')) return dept === 'Shipment' || dept === 'Packing' || dept === 'Finishing';
  if (moduleId === 'transfers') return isGlobalUser(user);

  return false;
};

export const filterSewingByScope = <T extends SewingProduction>(
  items: T[],
  user: User | null
): T[] => {
  if (!user) return [];
  if (isGlobalUser(user)) return items;
  if (user.department !== 'Sewing' && user.department !== 'Production Planning' && user.department !== 'QC') {
    return [];
  }
  const userLine = (user.line_no || user.section || '').toLowerCase();
  if (user.role === 'LINE_USER' || (userLine && userLine.includes('line'))) {
    return items.filter(i => {
      const line = (i.lineNo || '').toLowerCase();
      return line === userLine || line.includes(userLine) || userLine.includes(line);
    });
  }
  return items;
};

export const filterCuttingByScope = <T extends CuttingEntry>(
  items: T[],
  user: User | null
): T[] => {
  if (!user) return [];
  if (isGlobalUser(user)) return items;
  if (user.department !== 'Cutting') return [];
  return items;
};

export const filterStoreByScope = <T extends StoreStockItem>(
  items: T[],
  user: User | null
): T[] => {
  if (!user) return [];
  if (isGlobalUser(user)) return items;
  if (user.department !== 'Store') return [];
  if (user.section && user.section !== 'Head Office' && user.section !== 'General') {
    const sec = (user.section || '').toLowerCase();
    return items.filter(i => {
      const cat = (i.category || '').toLowerCase();
      return cat.includes(sec) || sec.includes(cat);
    });
  }
  return items;
};

export const filterDepartmentByScope = <T extends { department?: string; lineNo?: string; line_no?: string }>(
  items: T[],
  user: User | null,
  deptName: Department
): T[] => {
  if (!user) return [];
  if (isGlobalUser(user)) return items;
  if (user.department !== deptName) return [];
  return items;
};

export const canAccessOrder = (
  user: User | null,
  order: {
    createdBy?: string;
    created_by?: string;
    createdDepartment?: string;
    created_department?: string;
    creatorEmail?: string;
    creator_email?: string;
    merchandiser?: string;
    assignedTo?: string;
    responsiblePerson?: string;
  }
): boolean => {
  if (!user) return false;
  // Super Admin, HR Admin, MD, GM, Director can view and manage all orders
  if (isGlobalUser(user)) return true;

  const uEmail = (user.email || '').toLowerCase().trim();
  const uId = (user.id || '').toLowerCase().trim();
  const uUsername = (user.username || '').toLowerCase().trim();
  const uName = (user.name || '').toLowerCase().trim();
  const uEmpId = (user.employee_id || '').toLowerCase().trim();
  const emailPrefix = uEmail.includes('@') ? uEmail.split('@')[0].trim() : '';

  // 1. Check strict creator email match
  const orderCreatorEmail = (
    order.creatorEmail ||
    order.creator_email ||
    (order.createdBy && order.createdBy.includes('@') ? order.createdBy : '') ||
    (order.created_by && order.created_by.includes('@') ? order.created_by : '')
  ).toLowerCase().trim();

  if (orderCreatorEmail && uEmail) {
    if (orderCreatorEmail === uEmail) {
      return true;
    }
    // Strict isolation: if an order has another user's creator email, block access
    return false;
  }

  // 2. Check by creator name / ID / username if email not directly recorded
  const orderCreator = (order.createdBy || order.created_by || '').toLowerCase().trim();
  if (orderCreator) {
    if (
      (uEmail && orderCreator === uEmail) ||
      (uId && orderCreator === uId) ||
      (uUsername && orderCreator === uUsername) ||
      (uName && orderCreator === uName) ||
      (uEmpId && orderCreator === uEmpId) ||
      (uName && orderCreator.includes(uName)) ||
      (orderCreator && uName && uName.includes(orderCreator)) ||
      (emailPrefix && orderCreator.includes(emailPrefix)) ||
      (emailPrefix && emailPrefix.includes(orderCreator))
    ) {
      return true;
    }
    // If order was created by someone else specifically, block access
    if (!['merchandising', 'merchandiser', 'system admin', 'admin', 'user', 'n/a', ''].includes(orderCreator)) {
      return false;
    }
  }

  // 3. Check assigned merchandiser
  const orderMerchandiser = (
    (order as any).merchandiser ||
    (order as any).assignedTo ||
    (order as any).responsiblePerson ||
    ''
  ).toLowerCase().trim();

  if (orderMerchandiser) {
    if (
      (uEmail && orderMerchandiser === uEmail) ||
      (uId && orderMerchandiser === uId) ||
      (uUsername && orderMerchandiser === uUsername) ||
      (uName && orderMerchandiser === uName) ||
      (uEmpId && orderMerchandiser === uEmpId) ||
      (uName && orderMerchandiser.includes(uName)) ||
      (orderMerchandiser && uName && uName.includes(orderMerchandiser)) ||
      (emailPrefix && orderMerchandiser.includes(emailPrefix)) ||
      (emailPrefix && emailPrefix.includes(orderMerchandiser))
    ) {
      return true;
    }
  }

  // 4. If user is in Merchandising and order has no specific creator tag at all
  if (user.department === 'Merchandising') {
    if (!orderCreator || ['merchandising', 'merchandiser', 'system admin', 'admin', 'user', 'n/a', ''].includes(orderCreator)) {
      return true;
    }
    return false;
  }

  // 5. Fallback for other production floors (Cutting, Sewing, etc.)
  const orderDept = (order.createdDepartment || order.created_department || '').toLowerCase().trim();
  const userDept = (user.department || '').toLowerCase().trim();
  if (orderDept && userDept && orderDept === userDept) {
    return true;
  }

  return false;
};

export const filterOrdersForUser = <T extends { createdBy?: string; created_by?: string; createdDepartment?: string; created_department?: string; creatorEmail?: string; creator_email?: string }>(
  orders: T[],
  user: User | null
): T[] => {
  if (!user) return [];
  if (isGlobalUser(user)) return orders;
  return orders.filter(o => canAccessOrder(user, o));
};

/**
 * Check if a user can create/add POs or manage orders for a given Buyer.
 * Rule: Whichever user created the Buyer, only that user (and Super Admin / Executive management)
 * can add/save POs under that Buyer.
 */
export const canUserAddPoForBuyer = (
  user: User | null,
  buyerName: string,
  masterDataList?: MasterDataItem[],
  ordersList?: OrderStyle[]
): boolean => {
  if (!user) return false;
  // Managing Director (MD) is strictly executive view and report oversight - cannot add or edit POs
  if (isMD(user)) return false;
  // Super Admin, GM, Director, HR Admin have full system authority across all buyers
  if (isGlobalUser(user)) return true;

  const bTrim = (buyerName || '').trim().toLowerCase();
  if (!bTrim) return false;

  const uEmail = (user.email || '').toLowerCase().trim();
  const uId = (user.id || '').toLowerCase().trim();
  const uUsername = (user.username || '').toLowerCase().trim();
  const uName = (user.name || '').toLowerCase().trim();
  const uEmpId = (user.employee_id || '').toLowerCase().trim();
  const emailPrefix = uEmail.includes('@') ? uEmail.split('@')[0].trim() : '';

  // 1. Check in Master Data items for Buyer
  const buyerItem = (masterDataList || []).find(
    m => m.category === 'Buyer' && (m.name || '').trim().toLowerCase() === bTrim
  );

  if (buyerItem) {
    const creatorEmail = (buyerItem.creatorEmail || buyerItem.creator_email || '').toLowerCase().trim();
    if (creatorEmail) {
      if (uEmail && creatorEmail === uEmail) {
        return true;
      }
      // If buyer was created by another specific user's email, block access
      return false;
    }

    const creator = (buyerItem.createdBy || buyerItem.created_by || '').toLowerCase().trim();
    if (creator) {
      if (
        (uEmail && creator === uEmail) ||
        (uId && creator === uId) ||
        (uUsername && creator === uUsername) ||
        (uName && creator === uName) ||
        (uEmpId && creator === uEmpId) ||
        (uName && creator.includes(uName)) ||
        (creator && uName && uName.includes(creator)) ||
        (emailPrefix && creator.includes(emailPrefix)) ||
        (emailPrefix && emailPrefix.includes(creator))
      ) {
        return true;
      }

      // If created by another user, deny
      if (!['system admin', 'admin', 'merchandising', 'merchandiser', 'default', 'n/a', ''].includes(creator)) {
        return false;
      }
    }
  }

  // 2. Check if user already created any existing orders/POs for this buyer
  if (ordersList && ordersList.length > 0) {
    const buyerOrders = ordersList.filter(
      o => (o.buyer || '').trim().toLowerCase() === bTrim
    );
    if (buyerOrders.length > 0) {
      const hasUserOrder = buyerOrders.some(o => canAccessOrder(user, o));
      const hasOtherUserOrders = buyerOrders.some(o => !canAccessOrder(user, o));
      if (hasUserOrder) return true;
      if (hasOtherUserOrders && !hasUserOrder) return false;
    }
  }

  // 3. If it's a default / unassigned buyer without a specific user owner, allow Merchandising users
  if (user.department === 'Merchandising') {
    return true;
  }

  return false;
};

/**
 * Helper to inspect creator metadata for a buyer.
 */
export const getBuyerCreatorInfo = (
  buyerName: string,
  masterDataList?: MasterDataItem[],
  currentUser?: User | null,
  ordersList?: OrderStyle[]
): {
  isCreatedByCurrentUser: boolean;
  canAddPO: boolean;
  creatorName?: string;
  creatorEmail?: string;
  isSystemDefault: boolean;
} => {
  const bTrim = (buyerName || '').trim().toLowerCase();
  const buyerItem = (masterDataList || []).find(
    m => m.category === 'Buyer' && (m.name || '').trim().toLowerCase() === bTrim
  );

  const canAdd = canUserAddPoForBuyer(currentUser || null, buyerName, masterDataList, ordersList);

  if (!buyerItem) {
    return {
      isCreatedByCurrentUser: canAdd,
      canAddPO: canAdd,
      isSystemDefault: true
    };
  }

  const creatorEmail = buyerItem.creatorEmail || buyerItem.creator_email;
  const createdBy = buyerItem.createdBy || buyerItem.created_by;

  const isSystemDefault = !creatorEmail && (!createdBy || ['system admin', 'admin', 'merchandising', 'merchandiser', 'default', 'n/a', ''].includes(createdBy.toLowerCase().trim()));

  const uEmail = (currentUser?.email || '').toLowerCase().trim();
  const uName = (currentUser?.name || '').toLowerCase().trim();

  let isCreatedByCurrentUser = false;
  if (isMD(currentUser || null)) {
    isCreatedByCurrentUser = false;
  } else if (creatorEmail && uEmail && creatorEmail.toLowerCase().trim() === uEmail) {
    isCreatedByCurrentUser = true;
  } else if (createdBy && uName && createdBy.toLowerCase().trim() === uName) {
    isCreatedByCurrentUser = true;
  } else if (isGlobalUser(currentUser || null)) {
    isCreatedByCurrentUser = true;
  }

  return {
    isCreatedByCurrentUser,
    canAddPO: canAdd,
    creatorName: createdBy,
    creatorEmail,
    isSystemDefault
  };
};




