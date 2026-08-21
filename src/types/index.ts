// MJAL Garments ERP - Type Definitions

export type Role =
  | 'SUPER_ADMIN'
  | 'HR_ADMIN'
  | 'MD'
  | 'DIRECTOR'
  | 'GM'
  | 'DEPT_USER'
  | 'SECTION_USER'
  | 'LINE_USER'
  | 'Managing Director (MD)'
  | 'Director'
  | 'General Manager (GM)';

export type Department =
  | 'HR & Admin'
  | 'Store'
  | 'Merchandising'
  | 'Sample'
  | 'Order Management'
  | 'Cutting'
  | 'Sewing'
  | 'Washing'
  | 'Finishing'
  | 'QC'
  | 'Packing'
  | 'Shipment'
  | 'Accounts/Finance'
  | 'Production Planning';

export type Permission = 'VIEW' | 'CREATE' | 'EDIT' | 'DELETE' | 'SUBMIT' | 'APPROVE' | 'EXPORT' | 'PRINT';

export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  role: Role;
  department: Department;
  designation?: string;
  employee_id?: string;
  section?: string;
  line_no?: string;
  avatar?: string;
  phone?: string;
  status: 'Active' | 'Inactive';
  permissions?: Record<Department, Permission[]>;
  createdAt?: string;
}

export type OrderStatus = 'Draft' | 'Confirmed' | 'Running' | 'Hold' | 'Completed' | 'Shipped' | 'Shipment Complete' | 'Cancelled';

export interface ColourQty {
  colour: string;
  sizeQuantities: Record<string, number>; // e.g. { 'S': 100, 'M': 200, 'L': 300, 'XL': 400 } - Original Order Qty
  factorySizeQuantities?: Record<string, number>; // e.g. { 'S': 105, 'M': 210, 'L': 315, 'XL': 420 } - Size-wise Factory Qty
  allowanceSizeQuantities?: Record<string, number>; // e.g. { 'S': 5, 'M': 10, 'L': 15, 'XL': 20 } - Size-wise Allowance Qty
  totalQty: number; // Original Customer Order Qty
  allowancePct?: number; // e.g. 5 (%)
  allowanceQty?: number; // e.g. 50 (pcs)
  factoryQty?: number; // Size-wise sum: Order Qty + allowance pcs (e.g. 1050)
}

export interface SizeProgressItem {
  size: string;
  orderQty: number; // Main Order Qty (Factory Order Qty in production contexts)
  realOrderQty?: number; // Original Buyer / Customer Order Qty (e.g. 1000)
  allowancePct?: number; // e.g. 3 (%)
  allowanceQty?: number; // e.g. 30 (pcs)
  factoryQty?: number; // Size-wise Factory Order Qty = Real Order + Allowance (e.g. 1030)
  factoryOrderQty?: number; // Alias for factoryQty
  transferredQty?: number; // Quantity transferred out to downstream department
  receivedQty?: number; // Department Receive Qty
  sewingReceivedQty?: number;
  washingReceivedQty?: number;
  finishingReceivedQty?: number;
  packingReceivedQty?: number;
  shipmentReceivedQty?: number;
  cutQty: number; // e.g. 1030
  cutBalance: number; // e.g. 0
  cutPercentage: number; // 100%
  sewInputs: number;
  sewOutput: number;
  sewBalance: number;
  sewPercentage: number;
  finQty: number;
  finBalance: number;
  finPercentage: number;
  packedQty: number;
  packBalance: number;
  packPercentage: number;
  shippedQty: number;
  shipBalance: number;
  shipmentPercentage: number;
  qcPassedQty: number;
  overallBalance: number;
  currentStage: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Over-produced';
}

export interface PurchaseOrder {
  id: string;
  poNo: string;
  poDate: string;
  deliveryDate: string;
  shipmentDate: string;
  colours: ColourQty[];
  totalPoQty: number;
  allowancePct?: number;
  allowanceQty?: number;
  factoryPoQty?: number;
  unitPrice: number;
  currency: 'USD' | 'BDT' | 'EUR';
  totalValue: number;
  status: OrderStatus;
  remarks?: string;
}

export interface OrderStyle {
  id: string;
  buyer: string;
  brand: string;
  styleNo: string;
  styleName: string;
  garmentType: string; // e.g. Denim Pants, Polo Shirt, Woven Shirt
  season: string;
  allowancePct?: number;
  allowanceQty?: number;
  factoryOrderQty?: number;
  isWashGarment?: boolean;
  washType?: string;
  purchaseOrders: PurchaseOrder[];
  totalOrderQty: number;
  totalOrderValue: number;
  currency: 'USD' | 'BDT' | 'EUR';
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  createdDepartment?: string;
  created_by?: string;
  created_department?: string;
  creatorEmail?: string;
  creator_email?: string;
}

export type ProductionOrder = OrderStyle;

export interface BOMItem {
  id: string;
  styleNo: string;
  category: 'Fabric' | 'Trim' | 'Accessories' | 'Packaging';
  itemName: string;
  specification: string;
  consumptionPerDzn: number;
  unit: 'Yards' | 'Meters' | 'Kgs' | 'Pcs' | 'Gross' | 'Rolls';
  unitPrice: number;
  supplier: string;
  requiredQty: number;
  bookedQty: number;
  receivedQty: number;
  status: 'Pending' | 'Booked' | 'Partial Received' | 'Full Received';
  createdBy?: string;
  creatorEmail?: string;
}

export interface TACalendarTask {
  id: string;
  styleNo: string;
  poNo: string;
  taskName: string;
  plannedDate: string;
  actualDate?: string;
  responsibleDept: Department;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Delayed';
  remarks?: string;
  createdBy?: string;
  creatorEmail?: string;
}

export type SampleType =
  | 'Development Sample'
  | 'Proto Sample'
  | 'Fit Sample'
  | 'Size Set'
  | 'PP Sample'
  | 'Photo Sample'
  | 'Shipment Sample';

export type SampleStatus = 'Pending' | 'Submitted' | 'Approved' | 'Rejected' | 'Revision Required' | 'Completed';

export interface SampleRecord {
  id: string;
  styleNo: string;
  poNo: string;
  colour: string;
  sampleType: SampleType;
  submissionDate: string;
  targetDate: string;
  approvalDate?: string;
  buyerComments?: string;
  status: SampleStatus;
  preparedBy: string;
}

export interface StoreTransaction {
  id: string;
  date: string;
  storeType: 'Fabric' | 'Trims' | 'Finished Goods';
  transactionType: 'Receive' | 'Issue' | 'Return' | 'Transfer' | 'Adjustment';
  styleNo: string;
  poNo: string;
  colour: string;
  itemName: string;
  quantity: number;
  unit: string;
  supplierOrDept: string;
  grnNo?: string;
  issuedTo?: string;
  performedBy: string;
  remarks?: string;
}

export interface StoreStockItem {
  id: string;
  storeType: 'Fabric' | 'Trims' | 'Finished Goods';
  itemName: string;
  category: string;
  styleNo: string;
  poNo: string;
  colour: string;
  currentStock: number;
  minStockLevel: number;
  unit: string;
  location: string;
  unitPrice?: number;
}

export interface CuttingEntry {
  id: string;
  date: string;
  lastUpdateDate?: string;
  styleNo: string;
  poNo: string;
  colour: string;
  size: string;
  orderQty: number;
  fabricAllocatedYds: number;
  markerLengthYds: number;
  markerEfficiency: number; // %
  layPlies: number;
  cutQty: number;
  shortageQty: number;
  rejectQty: number;
  recutQty: number;
  bundleCount: number;
  cutEfficiency: number; // %
  operator: string;
}

export interface SewingLine {
  id: string;
  lineNo: string;
  lineName: string;
  capacityPerDay: number;
  supervisorName: string;
  status: 'Active' | 'Inactive';
}

export interface SewingTarget {
  id: string;
  lineNo: string;
  date: string; // for daily target
  month?: string; // e.g. "2026-08" for monthly target
  styleNo: string;
  poNo: string;
  colour: string;
  dailyTargetQty: number;
  hourlyTargetQty: number;
  workingDays?: number;
  monthlyTargetQty?: number;
}

export interface HourlySewingOutput {
  hour: string; // e.g., "08:00 - 09:00"
  target: number;
  output: number;
  alterQty: number;
  rejectQty: number;
}

export interface SewingProduction {
  id: string;
  date: string;
  lastUpdateDate?: string;
  lineNo: string;
  buyer: string;
  styleNo: string;
  poNo: string;
  colour: string;
  size: string;
  inputQty: number;
  dailyTarget: number;
  workingHours?: number;
  hourlyOutputs: HourlySewingOutput[];
  totalOutput: number;
  alterQty: number;
  rejectQty: number;
  reworkQty: number;
  wipQty: number;
  remarks?: string;
  submittedBy: string;
  submissionTime: string;
  lineSupervisor?: string;
}

export interface WashingSizeItem {
  size: string;
  sentQty: number;
  colour?: string;
  poNo?: string;
  buyer?: string;
  receivedQty?: number;
  damageQty?: number;
  rejectQty?: number;
  balanceQty?: number;
}

export interface WashingRecord {
  id: string;
  challanNo: string;
  date: string;
  lastUpdateDate?: string;
  vendorName: string;
  vendorAddress?: string;
  washType: 'Enzyme' | 'Bleach' | 'Stone' | 'Acid' | 'Silicone' | 'Softener' | 'Tint' | 'Normal' | string;
  buyer?: string;
  styleNo: string;
  poNo: string;
  colour: string;
  size?: string;
  sentQty: number;
  receivedQty: number;
  damageQty: number;
  rejectQty: number;
  balanceQty: number;
  status: 'Pending' | 'Sent' | 'Washing' | 'Received' | 'Partial' | 'Completed';
  vehicleNo?: string;
  driverName?: string;
  driverPhone?: string;
  expectedReturnDate?: string;
  returnDate?: string;
  sourceTransferId?: string;
  authorizedBy?: string;
  receivedBy?: string;
  remarks?: string;
  processInstructions?: string;
  items?: WashingSizeItem[];
}

export interface FinishingRecord {
  id: string;
  date: string;
  lastUpdateDate?: string;
  buyer?: string;
  styleNo: string;
  poNo: string;
  colour: string;
  size: string;
  sewingReceiveQty: number;
  finishingInputQty: number;
  threadCutQty?: number;
  ironedQty: number;
  getUpQty?: number;
  foldedQty?: number;
  taggedQty: number;
  packedQty: number;
  polyQty?: number;
  cartonQty?: number;
  reworkQty?: number;
  rejectQty?: number;
  finishedQty: number;
  operator: string;
  hangTagStatus?: 'Pending' | 'In Progress' | 'Completed';
  transferredToPackingQty?: number;
  isReadyForShipment?: boolean;
  readyForShipmentQty?: number;
  readyForShipmentDate?: string;
  shipmentStatus?: 'In Finishing' | 'Ready For Shipment' | 'Shipped' | 'Delivered to Buyer';
  remarks?: string;
}

export interface QCDefectItem {
  defectCategory: string; // e.g., "Stitch Fault", "Oil Stain", "Hole", "Measurement"
  defectQty: number;
  defectType?: 'Minor' | 'Major' | 'Critical';
}

export interface QCInspection {
  id: string;
  date: string;
  lastUpdateDate?: string;
  buyer?: string;
  inspectionType: 'Inline QC' | 'End Line QC' | 'Final QC' | 'AQL Inspection' | '100% Inspection' | 'Pre-Final Audit' | string;
  styleNo: string;
  poNo: string;
  colour: string;
  size?: string;
  lineNo: string;
  shift?: string;
  inspectedQty: number;
  passedQty: number;
  reworkQty: number;
  rejectQty: number;
  dhu: number; // Defects per Hundred Units (%)
  defects: QCDefectItem[];
  inspectorName: string;
  result: 'Pass' | 'Fail' | 'Pending Rework';
  aqlLevel?: string;
  sampleSize?: number;
  remarks?: string;
}

export interface CartonDetail {
  cartonNo: string;
  colour: string;
  sizeBreakdown: Record<string, number>;
  totalPcsPerCarton: number;
}

export interface PackingRecord {
  id: string;
  date: string;
  lastUpdateDate?: string;
  styleNo: string;
  poNo: string;
  colour: string;
  size?: string;
  cartonCount: number;
  packedQty: number;
  orderQty: number;
  balanceQty: number;
  cartons: CartonDetail[];
  packingOfficer: string;
}

export interface ShipmentItem {
  id?: string;
  buyer: string;
  styleNo: string;
  poNo: string;
  colour: string;
  size?: string;
  shippedQty: number;
  orderQty: number;
  readyQty?: number;
  pendingQty?: number;
  balanceQty?: number;
  cartonCount?: number;
  unitPrice?: number;
  currency?: string;
}

export interface ReadyShipmentSizeItem {
  size: string;
  orderQty: number;
  readyQty: number;
  shippedQty: number;
  availableReadyQty: number;
  pendingQty: number;
  balanceQty: number;
  status: 'Ready for Shipment' | 'Partial Shipment' | 'Shipment Complete';
}

export interface ReadyShipmentBatch {
  key: string;
  buyer: string;
  styleNo: string;
  poNo: string;
  colour: string;
  garmentType?: string;
  orderQty: number;
  readyQty: number;
  shippedQty: number;
  pendingQty: number;
  cartonCount: number;
  status: 'Ready for Shipment' | 'Partial Shipment' | 'Shipment Complete';
  isComplete: boolean;
  sizeBreakdown: ReadyShipmentSizeItem[];
  source: string;
}

export interface ShipmentRecord {
  id: string;
  invoiceNo: string;
  packingListNo: string;
  shipmentDate: string;
  buyer: string;
  styleNo: string;
  poNo: string;
  colour: string;
  size?: string;
  shippedQty: number;
  orderQty: number;
  balanceQty: number;
  cartonCount: number;
  vesselOrFlight: string;
  containerNo: string;
  portOfLoading: string;
  portOfDischarge: string;
  status: 'Pending' | 'Ready' | 'Partial Shipment' | 'Shipped' | 'Completed' | 'Shipment Complete';
  preparedBy: string;
  items?: ShipmentItem[];
  remarks?: string;
}

export interface Employee {
  id: string;
  empId: string;
  name: string;
  designation: string;
  department: Department;
  section: string;
  shift: 'Day' | 'Night' | 'General';
  joiningDate: string;
  phone: string;
  email?: string;
  basicSalary: number;
  otRatePerHour: number;
  status: 'Active' | 'Inactive';
}

export interface AttendanceRecord {
  id: string;
  date: string;
  empId: string;
  empName: string;
  department: Department;
  inTime: string;
  outTime: string;
  otHours: number;
  status: 'Present' | 'Absent' | 'Late' | 'Leave';
}

export interface PayrollRecord {
  id: string;
  month: string; // "2026-08"
  empId: string;
  empName: string;
  department: Department;
  basicSalary: number;
  houseRent: number;
  medicalAllowance: number;
  otHours: number;
  otAmount: number;
  deductions: number;
  netSalary: number;
  status: 'Pending' | 'Approved' | 'Paid';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  role: Role;
  department: Department;
  action: string; // e.g. "Create Order", "Update Daily Target", "Submit Sewing Production"
  module: string;
  recordId?: string;
  previousValue?: string;
  newValue?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'warning' | 'info' | 'danger' | 'success';
  read: boolean;
  linkModule?: string;
}

export interface MasterDataItem {
  id: string;
  category:
    | 'Buyer'
    | 'Brand'
    | 'GarmentType'
    | 'Style'
    | 'Colour'
    | 'Size'
    | 'SizeMatrix'
    | 'Season'
    | 'Department'
    | 'Section'
    | 'SewingLine'
    | 'Supplier'
    | 'WashingVendor'
    | 'DefectType'
    | 'WashType'
    | 'UOM'
    | 'FabricType';
  code: string;
  name: string;
  description?: string;
  status: 'Active' | 'Inactive';
  createdBy?: string;
  created_by?: string;
  creatorEmail?: string;
  creator_email?: string;
  createdDepartment?: string;
  created_department?: string;
  createdAt?: string;
}

export interface TransferChallanItem {
  id: string;
  buyer: string;
  styleNo: string;
  poNo: string;
  colour: string;
  size: string;
  garmentType: string;
  isWashGarment: boolean;
  quantity: number;
  bundleCount?: number;
  remarks?: string;
}

export interface InterDeptTransfer {
  id: string;
  challanNo: string;
  transferType?: 'Transfer' | 'Return'; // 'Transfer' (Forward Flow) or 'Return' (Reverse / Rework Flow)
  returnReason?: string; // Reason when transferType is 'Return'
  originalChallanNo?: string; // Reference to original transfer challan if returning
  transferDate: string;
  fromDepartment: 'Cutting' | 'Sewing' | 'Washing' | 'Finishing' | 'Packing' | 'Shipment' | 'Store';
  toDepartment: 'Cutting' | 'Sewing' | 'Washing' | 'Finishing' | 'Packing' | 'Shipment' | 'Store';
  buyer: string;
  styleNo: string;
  poNo: string;
  colour: string;
  size: string;
  garmentType: string;
  isWashGarment: boolean; // true = Wash Garment (Washing plant required), false = Non-Wash (Direct to finishing)
  quantity: number;
  bundleCount?: number;
  items?: TransferChallanItem[]; // Multi-item breakdown supporting multiple styles/colours/sizes in a single challan
  lineNo?: string;
  vendorName?: string;
  vehicleNo?: string;
  driverName?: string;
  senderName: string;
  receiverName?: string;
  qcCheckedBy?: string;
  authorizedBy: string; // Required Authorized Signatory Name
  authorizedDesignation?: string; // Authorized Signatory Designation
  authorizedDate?: string;
  status: 'Dispatched' | 'In Transit' | 'Received' | 'Rejected';
  receiveDate?: string;
  remarks?: string;
  createdAt: string;
}
