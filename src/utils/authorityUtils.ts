/**
 * Factory Department Authorities & Signatory Configuration
 * Automatically maps official authority names and designations per department.
 */

export interface AuthorityProfile {
  name: string;
  designation: string;
}

export const DEPARTMENT_AUTHORITIES = {
  cuttingIncharge: {
    name: 'Md Aminul Islam',
    designation: 'Cutting Incharge'
  },
  storeIncharge: {
    name: 'Jane Alam Rokon',
    designation: 'Store Incharge'
  },
  qualityIncharge: {
    name: 'Enayet Hossain',
    designation: 'Quality Incharge'
  },
  floorIncharge: {
    name: 'Ismail Hossain',
    designation: 'Floor Incharge'
  },
  productionManager: {
    name: 'Md Masud Miya',
    designation: 'Production Manager'
  },
  finishingManager: {
    name: 'Md Rashedul Alam',
    designation: 'Finishing Manager'
  },
  qualityManager: {
    name: 'Md Nazmul Hossain',
    designation: 'Quality Manager'
  },
  generalManager: {
    name: 'Md Myeedul Islam',
    designation: 'General Manager'
  },
  securityAssurance: {
    name: 'Md Sujon',
    designation: 'Security Assurance'
  }
} as const;

/**
 * Returns the primary Section / Department In-charge for a given factory department
 */
export function getDepartmentIncharge(department: string): AuthorityProfile {
  switch (department?.toLowerCase()) {
    case 'cutting':
      return DEPARTMENT_AUTHORITIES.cuttingIncharge; // Md Aminul Islam — Cutting Incharge
    case 'store':
      return DEPARTMENT_AUTHORITIES.storeIncharge; // Jane Alam Rokon — Store Incharge
    case 'sewing':
      return DEPARTMENT_AUTHORITIES.floorIncharge; // Ismail Hossain — Floor Incharge
    case 'washing':
      return DEPARTMENT_AUTHORITIES.productionManager; // Md Masud Miya — Production Manager
    case 'finishing':
      return DEPARTMENT_AUTHORITIES.finishingManager; // Md Rashedul Alam — Finishing Manager
    case 'packing':
      return DEPARTMENT_AUTHORITIES.finishingManager; // Md Rashedul Alam — Finishing Manager
    case 'shipment':
      return DEPARTMENT_AUTHORITIES.finishingManager; // Md Rashedul Alam — Finishing Manager
    case 'qc':
    case 'quality':
      return DEPARTMENT_AUTHORITIES.qualityIncharge; // Enayet Hossain — Quality Incharge
    default:
      return DEPARTMENT_AUTHORITIES.floorIncharge;
  }
}

/**
 * Returns the Department Manager responsible for higher department-level authorization
 */
export function getDepartmentManager(department: string): AuthorityProfile {
  switch (department?.toLowerCase()) {
    case 'cutting':
    case 'sewing':
    case 'washing':
      return DEPARTMENT_AUTHORITIES.productionManager; // Md Masud Miya — Production Manager
    case 'finishing':
    case 'packing':
    case 'shipment':
      return DEPARTMENT_AUTHORITIES.finishingManager; // Md Rashedul Alam — Finishing Manager
    case 'qc':
    case 'quality':
      return DEPARTMENT_AUTHORITIES.qualityManager; // Md Nazmul Hossain — Quality Manager
    case 'store':
    default:
      return DEPARTMENT_AUTHORITIES.generalManager; // Md Myeedul Islam — General Manager
  }
}

/**
 * Auto-resolves all required signatories for a Challan based on fromDept, toDept, and transferType
 */
export function resolveChallanAuthorities(
  fromDept: string,
  toDept: string,
  transferType: 'Transfer' | 'Return' = 'Transfer'
) {
  const sender = getDepartmentIncharge(fromDept);
  const receiver = getDepartmentIncharge(toDept);
  const qualityIncharge = DEPARTMENT_AUTHORITIES.qualityIncharge; // Enayet Hossain
  const qualityManager = DEPARTMENT_AUTHORITIES.qualityManager; // Md Nazmul Hossain
  const deptManager = getDepartmentManager(fromDept);
  const security = DEPARTMENT_AUTHORITIES.securityAssurance; // Md Sujon
  const gm = DEPARTMENT_AUTHORITIES.generalManager; // Md Myeedul Islam

  return {
    senderIncharge: sender,
    receiverIncharge: receiver,
    qualityIncharge,
    qualityManager,
    deptManager,
    securityAssurance: security,
    authorizedBy: gm.name,
    authorizedDesignation: gm.designation
  };
}
