import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserCog, 
  Calendar, 
  Plus, 
  ShieldCheck, 
  Edit, 
  Trash2, 
  AlertCircle, 
  Database,
  Calculator,
  Coins,
  FileSpreadsheet
} from 'lucide-react';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { Employee, User, AttendanceRecord, PayrollRecord } from '../../../types';
import { PageHeader } from '../../common/PageHeader';
import { DataTable, Column } from '../../common/DataTable';
import { StatusBadge } from '../../common/StatusBadge';
import { Modal } from '../../common/Modal';
import { ConfirmationDialog } from '../../common/ConfirmationDialog';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';
import { DatabaseLogViewerModal } from '../../common/DatabaseLogViewerModal';
import { useAuth } from '../../../context/AuthContext';
import { useERP } from '../../../context/ERPContext';
import { PermissionGuard } from '../../common/PermissionGuard';
import { UserManagementModule } from './UserManagementModule';

export const HRModule: React.FC = () => {
  const { currentUser, canOperate, canDelete } = useAuth();
  const { activeModule } = useERP();
  const [employees, setEmployees] = useState<Employee[]>(supabaseDataService.getEmployees());
  const [users, setUsers] = useState<User[]>(supabaseDataService.getUsers());
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(supabaseDataService.getAttendance());
  const [payroll, setPayroll] = useState<PayrollRecord[]>(supabaseDataService.getPayroll());
  const [activeTab, setActiveTab] = useState<'employees' | 'users' | 'payroll'>(
    activeModule === 'hr_users' ? 'users' : activeModule === 'hr_payroll' ? 'payroll' : 'employees'
  );

  useEffect(() => {
    if (activeModule === 'hr_users') {
      setActiveTab('users');
    } else if (activeModule === 'hr_payroll') {
      setActiveTab('payroll');
    } else if (activeModule === 'hr_employees') {
      setActiveTab('employees');
    }
  }, [activeModule]);

  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletePayrollModalOpen, setIsDeletePayrollModalOpen] = useState(false);
  
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [empToDelete, setEmpToDelete] = useState<Employee | null>(null);
  const [selectedPayroll, setSelectedPayroll] = useState<PayrollRecord | null>(null);
  const [payrollToDelete, setPayrollToDelete] = useState<PayrollRecord | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Emp Form
  const [empName, setEmpName] = useState('');
  const [empId, setEmpId] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState<any>('Sewing');
  const [basicSalary, setBasicSalary] = useState<number | ''>('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Payroll Form
  const [payMonth, setPayMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [payEmpId, setPayEmpId] = useState('');
  const [payBasic, setPayBasic] = useState<number | ''>(0);
  const [payHouseRent, setPayHouseRent] = useState<number | ''>(0);
  const [payMedical, setPayMedical] = useState<number | ''>(0);
  const [payOtHours, setPayOtHours] = useState<number | ''>(0);
  const [payOtAmount, setPayOtAmount] = useState<number | ''>(0);
  const [payDeductions, setPayDeductions] = useState<number | ''>(0);
  const [payStatus, setPayStatus] = useState<'Pending' | 'Processed' | 'Paid'>('Processed');

  useEffect(() => {
    setEmployees(supabaseDataService.getEmployees());
    setUsers(supabaseDataService.getUsers());
    setAttendance(supabaseDataService.getAttendance());
    setPayroll(supabaseDataService.getPayroll());

    const unsub = supabaseDataService.subscribe(() => {
      setEmployees([...supabaseDataService.getEmployees()]);
      setUsers([...supabaseDataService.getUsers()]);
      setAttendance([...supabaseDataService.getAttendance()]);
      setPayroll([...supabaseDataService.getPayroll()]);
    });
    return unsub;
  }, []);

  const resetForm = () => {
    setSelectedEmp(null);
    setEmpName('');
    setEmpId('');
    setDesignation('');
    setDepartment('Sewing');
    setBasicSalary('');
    setPhone('');
    setEmail('');
    setErrorMessage(null);
  };

  const resetPayrollForm = () => {
    setSelectedPayroll(null);
    setPayMonth(new Date().toISOString().substring(0, 7));
    setPayEmpId('');
    setPayBasic(0);
    setPayHouseRent(0);
    setPayMedical(0);
    setPayOtHours(0);
    setPayOtAmount(0);
    setPayDeductions(0);
    setPayStatus('Processed');
    setErrorMessage(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsEmpModalOpen(true);
  };

  const handleOpenAddPayroll = () => {
    resetPayrollForm();
    if (employees.length > 0) {
      const firstEmp = employees[0];
      handleSelectPayrollEmp(firstEmp.empId);
    }
    setIsPayrollModalOpen(true);
  };

  const handleSelectPayrollEmp = (id: string) => {
    setPayEmpId(id);
    const emp = employees.find(e => e.empId === id || e.id === id);
    if (emp) {
      const basic = emp.basicSalary || 0;
      setPayBasic(basic);
      // Default allowances: 50% house rent, 10% medical allowance
      setPayHouseRent(Math.round(basic * 0.5));
      setPayMedical(Math.round(basic * 0.1));
      const otRate = emp.otRatePerHour || Math.round(basic / 208 * 1.5) || 100;
      setPayOtAmount(Math.round(Number(payOtHours || 0) * otRate));
    }
  };

  const handleOpenEdit = (emp: Employee) => {
    setSelectedEmp(emp);
    setEmpId(emp.empId);
    setEmpName(emp.name);
    setDesignation(emp.designation);
    setDepartment(emp.department);
    setBasicSalary(emp.basicSalary);
    setPhone(emp.phone || '');
    setEmail(emp.email || '');
    setErrorMessage(null);
    setIsEmpModalOpen(true);
  };

  const handleOpenEditPayroll = (p: PayrollRecord) => {
    setSelectedPayroll(p);
    setPayMonth(p.month);
    setPayEmpId(p.empId);
    setPayBasic(p.basicSalary || 0);
    setPayHouseRent(p.houseRent || 0);
    setPayMedical(p.medicalAllowance || 0);
    setPayOtHours(p.otHours || 0);
    setPayOtAmount(p.otAmount || 0);
    setPayDeductions(p.deductions || 0);
    setPayStatus(p.status || 'Processed');
    setErrorMessage(null);
    setIsPayrollModalOpen(true);
  };

  const handleOpenDelete = (emp: Employee) => {
    setEmpToDelete(emp);
    setIsDeleteModalOpen(true);
  };

  const handleOpenDeletePayroll = (p: PayrollRecord) => {
    setPayrollToDelete(p);
    setIsDeletePayrollModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!empToDelete) return;
    setIsLoading(true);
    const res = await supabaseDataService.deleteEmployee(empToDelete.id, currentUser?.name);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to delete employee from database.');
    } else {
      setIsDeleteModalOpen(false);
      setEmpToDelete(null);
    }
  };

  const handleConfirmDeletePayroll = async () => {
    if (!payrollToDelete) return;
    setIsLoading(true);
    const res = await supabaseDataService.deletePayroll(payrollToDelete.id, currentUser?.name);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to delete payroll record from database.');
    } else {
      setIsDeletePayrollModalOpen(false);
      setPayrollToDelete(null);
    }
  };

  const handleSaveEmp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empId || !empName || !designation || basicSalary === '') {
      setErrorMessage('Please fill in Employee ID, Name, Designation, and Basic Salary.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    const emp: Employee = {
      id: selectedEmp ? selectedEmp.id : 'emp-' + Date.now(),
      empId,
      name: empName,
      designation,
      department,
      section: selectedEmp ? selectedEmp.section : 'Floor Ops',
      shift: selectedEmp ? selectedEmp.shift : 'Day',
      joiningDate: selectedEmp ? selectedEmp.joiningDate : new Date().toISOString().substring(0, 10),
      phone: phone || '+8801700000000',
      email: email || undefined,
      basicSalary: Number(basicSalary),
      otRatePerHour: Math.round(Number(basicSalary) / 208 * 1.5) || 150,
      status: selectedEmp ? selectedEmp.status : 'Active'
    };

    const res = await supabaseDataService.saveEmployee(emp, currentUser?.name);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to save employee to Supabase.');
    } else {
      setIsEmpModalOpen(false);
      resetForm();
    }
  };

  const handleSavePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payMonth || !payEmpId) {
      setErrorMessage('Please select Employee and Month.');
      return;
    }

    const emp = employees.find(e => e.empId === payEmpId || e.id === payEmpId);
    const resolvedName = emp ? emp.name : selectedPayroll?.empName || 'Employee';
    const resolvedDept = emp ? emp.department : selectedPayroll?.department || 'Sewing';

    const b = Number(payBasic || 0);
    const hr = Number(payHouseRent || 0);
    const med = Number(payMedical || 0);
    const otAmt = Number(payOtAmount || 0);
    const ded = Number(payDeductions || 0);
    const net = b + hr + med + otAmt - ded;

    const record: PayrollRecord = {
      id: selectedPayroll ? selectedPayroll.id : 'pay-' + Date.now(),
      month: payMonth,
      empId: payEmpId,
      empName: resolvedName,
      department: resolvedDept,
      basicSalary: b,
      houseRent: hr,
      medicalAllowance: med,
      otHours: Number(payOtHours || 0),
      otAmount: otAmt,
      deductions: ded,
      netSalary: net,
      status: payStatus
    };

    setIsLoading(true);
    setErrorMessage(null);
    const res = await supabaseDataService.savePayroll(record, currentUser?.name);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to save payroll and allowance record to Supabase database.');
    } else {
      setIsPayrollModalOpen(false);
      resetPayrollForm();
    }
  };

  const empColumns: Column<Employee>[] = [
    { header: 'Emp ID', accessorKey: 'empId', sortable: true, cell: e => <span className="font-bold text-blue-600 font-mono">{e.empId}</span> },
    { header: 'Name', accessorKey: 'name', sortable: true, cell: e => <span className="font-bold text-slate-800">{e.name}</span> },
    { header: 'Designation', accessorKey: 'designation' },
    { header: 'Department', accessorKey: 'department', sortable: true },
    { header: 'Basic Salary', cell: e => <span className="font-bold text-slate-900">৳{(e.basicSalary || 0).toLocaleString()}</span> },
    { header: 'Status', accessorKey: 'status', cell: e => <StatusBadge status={e.status} /> },
    {
      header: 'Actions',
      cell: e => (
        <div className="flex items-center gap-1">
          {canOperate('HR & Admin') && (
            <button
              onClick={() => handleOpenEdit(e)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition-colors"
              title="Edit Employee"
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
          )}
          {canDelete('HR & Admin') && (
            <button
              onClick={() => handleOpenDelete(e)}
              className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
              title="Delete Employee"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )
    }
  ];

  const userColumns: Column<User>[] = [
    { header: 'Username / Email', cell: u => <div><span className="font-bold text-slate-900">{u.username}</span> <p className="text-[11px] text-slate-500">{u.email}</p></div> },
    { header: 'Full Name', accessorKey: 'name', sortable: true },
    { header: 'Role', accessorKey: 'role', sortable: true, cell: u => <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{u.role}</span> },
    { header: 'Assigned Dept', accessorKey: 'department' },
    { header: 'Status', accessorKey: 'status', cell: u => <StatusBadge status={u.status} /> }
  ];

  const payrollColumns: Column<PayrollRecord>[] = [
    { header: 'Month', accessorKey: 'month', sortable: true, cell: p => <span className="font-mono font-bold text-slate-700">{p.month}</span> },
    { header: 'Emp ID / Name', cell: p => <div><span className="font-bold text-slate-800">{p.empName}</span> <p className="text-[11px] text-slate-500 font-mono">{p.empId}</p></div> },
    { header: 'Basic Salary', cell: p => <span>৳{(p.basicSalary || 0).toLocaleString()}</span> },
    { 
      header: 'Allowances (HR / Med)', 
      cell: p => (
        <div className="text-xs">
          <span className="text-blue-700 font-medium">HR: ৳{(p.houseRent || 0).toLocaleString()}</span>
          <span className="text-slate-400 mx-1">|</span>
          <span className="text-teal-700 font-medium">Med: ৳{(p.medicalAllowance || 0).toLocaleString()}</span>
        </div>
      ) 
    },
    { header: 'OT Amount', cell: p => <span>{p.otHours || 0} hrs (৳{(p.otAmount || 0).toLocaleString()})</span> },
    { header: 'Deductions', cell: p => <span className="text-rose-600">-৳{(p.deductions || 0).toLocaleString()}</span> },
    { header: 'Net Payable', cell: p => <span className="font-black text-emerald-700">৳{(p.netSalary || 0).toLocaleString()}</span> },
    { header: 'Status', accessorKey: 'status', cell: p => <StatusBadge status={p.status} /> },
    {
      header: 'Actions',
      cell: p => (
        <div className="flex items-center gap-1">
          {canOperate('HR & Admin') && (
            <button
              onClick={() => handleOpenEditPayroll(p)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition-colors"
              title="Edit Payroll / Allowances"
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
          )}
          {canDelete('HR & Admin') && (
            <button
              onClick={() => handleOpenDeletePayroll(p)}
              className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
              title="Delete Payroll Record"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )
    }
  ];

  const calculatedNet = Number(payBasic || 0) + Number(payHouseRent || 0) + Number(payMedical || 0) + Number(payOtAmount || 0) - Number(payDeductions || 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="HR & User Access Administration"
        description="Employee Directory, Role-based Access Controls, Attendance & Payroll Calculations"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsLogViewerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 shadow-xs transition-colors"
              title="Open Database Transaction & Error Diagnostics"
            >
              <Database className="h-4 w-4 text-indigo-600" />
              <span>DB Logs & Diagnostics</span>
            </button>

            <ExportPrintToolbar 
              title={activeTab === 'payroll' ? 'Payroll and Allowance Report' : 'Employee Directory'} 
              data={activeTab === 'payroll' ? payroll : employees} 
              filename={activeTab === 'payroll' ? 'MJAL_Payroll_Allowances' : 'MJAL_HR_Employees'} 
            />
            
            <PermissionGuard department="HR & Admin">
              {activeTab === 'payroll' ? (
                <button
                  onClick={handleOpenAddPayroll}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Process Payroll & Allowance
                </button>
              ) : (
                <button
                  onClick={handleOpenAdd}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Employee
                </button>
              )}
            </PermissionGuard>
          </div>
        }
      />

      <div className="flex border-b border-slate-200 gap-4 text-xs font-bold">
        <button
          onClick={() => setActiveTab('employees')}
          className={`pb-2.5 transition-colors border-b-2 ${activeTab === 'employees' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}
        >
          Employee Directory ({employees.length})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-2.5 transition-colors border-b-2 ${activeTab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}
        >
          Users & Permission Matrix ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('payroll')}
          className={`pb-2.5 transition-colors border-b-2 ${activeTab === 'payroll' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}
        >
          Payroll & Allowances ({payroll.length})
        </button>
      </div>

      {activeTab === 'employees' && <DataTable data={employees} columns={empColumns} keyExtractor={e => e.id} searchPlaceholder="Search employees..." />}
      {activeTab === 'users' && (
        currentUser?.role === 'SUPER_ADMIN' ? (
          <UserManagementModule />
        ) : (
          <DataTable data={users} columns={userColumns} keyExtractor={u => u.id} searchPlaceholder="Search user permissions..." />
        )
      )}
      {activeTab === 'payroll' && (
        <DataTable 
          data={payroll} 
          columns={payrollColumns} 
          keyExtractor={p => p.id} 
          searchPlaceholder="Search payroll records by employee, month, allowances..." 
        />
      )}

      {/* Employee Modal */}
      <Modal
        isOpen={isEmpModalOpen}
        onClose={() => { setIsEmpModalOpen(false); resetForm(); }}
        title={selectedEmp ? 'Edit Employee Details' : 'New Employee Enrollment'}
      >
        <form onSubmit={handleSaveEmp} className="space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-2 font-medium">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsLogViewerOpen(true)}
                className="px-2.5 py-1 rounded bg-rose-200 hover:bg-rose-300 text-rose-900 font-bold text-[11px] shrink-0"
              >
                Inspect Error
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Emp ID *</label>
              <input
                type="text"
                placeholder="Enter Employee ID (e.g. MJAL-030)"
                value={empId}
                onChange={e => setEmpId(e.target.value)}
                className="w-full rounded border p-2 text-xs font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                placeholder="Enter Full Name"
                value={empName}
                onChange={e => setEmpName(e.target.value)}
                className="w-full rounded border p-2 text-xs font-bold"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Designation *</label>
              <input
                type="text"
                placeholder="Enter Designation (e.g. Senior Operator)"
                value={designation}
                onChange={e => setDesignation(e.target.value)}
                className="w-full rounded border p-2 text-xs font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Department *</label>
              <select value={department} onChange={e => setDepartment(e.target.value)} className="w-full rounded border p-2 text-xs font-bold">
                <option value="Sewing">Sewing</option>
                <option value="Cutting">Cutting</option>
                <option value="Finishing">Finishing</option>
                <option value="QC">QC</option>
                <option value="Store">Store</option>
                <option value="Sample">Sample</option>
                <option value="Shipment">Shipment</option>
                <option value="Merchandising">Merchandising</option>
                <option value="HR & Admin">HR & Admin</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Basic Salary (BDT) *</label>
              <input
                type="number"
                placeholder="Enter Basic Salary"
                value={basicSalary}
                onChange={e => setBasicSalary(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded border p-2 text-xs font-bold text-emerald-700"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                placeholder="e.g. +8801700000000"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full rounded border p-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                placeholder="e.g. emp@mjal.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded border p-2 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setIsEmpModalOpen(false); resetForm(); }}
              className="px-4 py-2 text-xs rounded border border-slate-200 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 text-xs font-bold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : selectedEmp ? 'Update Employee' : 'Save Employee'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Payroll & Allowance Modal */}
      <Modal
        isOpen={isPayrollModalOpen}
        onClose={() => { setIsPayrollModalOpen(false); resetPayrollForm(); }}
        title={selectedPayroll ? 'Edit Payroll & Allowances' : 'Process Monthly Payroll & Allowances'}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSavePayroll} className="space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-2 font-medium">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsLogViewerOpen(true)}
                className="px-2.5 py-1 rounded bg-rose-200 hover:bg-rose-300 text-rose-900 font-bold text-[11px] shrink-0"
              >
                Inspect Error
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payroll Month *</label>
              <input
                type="month"
                value={payMonth}
                onChange={e => setPayMonth(e.target.value)}
                className="w-full rounded border p-2 text-xs font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Employee *</label>
              <select
                value={payEmpId}
                onChange={e => handleSelectPayrollEmp(e.target.value)}
                className="w-full rounded border p-2 text-xs font-bold"
                required
              >
                <option value="">-- Choose Employee --</option>
                {employees.map(e => (
                  <option key={e.id} value={e.empId}>
                    {e.empId} - {e.name} ({e.department})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-amber-600" />
              <span>Salary & Allowance Structure (BDT)</span>
            </h4>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Basic Salary</label>
                <input
                  type="number"
                  value={payBasic}
                  onChange={e => setPayBasic(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full rounded border p-2 text-xs font-bold text-slate-900 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-blue-700 mb-1">House Rent Allowance</label>
                <input
                  type="number"
                  value={payHouseRent}
                  onChange={e => setPayHouseRent(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full rounded border p-2 text-xs font-bold text-blue-800 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-teal-700 mb-1">Medical Allowance</label>
                <input
                  type="number"
                  value={payMedical}
                  onChange={e => setPayMedical(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full rounded border p-2 text-xs font-bold text-teal-800 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">OT Hours</label>
                <input
                  type="number"
                  value={payOtHours}
                  onChange={e => {
                    const hrs = e.target.value === '' ? '' : Number(e.target.value);
                    setPayOtHours(hrs);
                    const emp = employees.find(em => em.empId === payEmpId);
                    const rate = emp?.otRatePerHour || 100;
                    setPayOtAmount(hrs === '' ? 0 : Math.round(Number(hrs) * rate));
                  }}
                  className="w-full rounded border p-2 text-xs font-medium bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">OT Amount (BDT)</label>
                <input
                  type="number"
                  value={payOtAmount}
                  onChange={e => setPayOtAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full rounded border p-2 text-xs font-medium bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-rose-700 mb-1">Deductions (BDT)</label>
                <input
                  type="number"
                  value={payDeductions}
                  onChange={e => setPayDeductions(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full rounded border p-2 text-xs font-bold text-rose-800 bg-white"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div>
              <span className="text-xs font-bold text-emerald-800">Net Calculated Salary:</span>
              <p className="text-[11px] text-emerald-600">Basic + House Rent + Medical + OT - Deductions</p>
            </div>
            <div className="text-right">
              <span className="text-lg font-black text-emerald-800 font-mono">
                ৳{calculatedNet.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setIsPayrollModalOpen(false); resetPayrollForm(); }}
              className="px-4 py-2 text-xs rounded border border-slate-200 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 text-xs font-bold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : selectedPayroll ? 'Update Payroll Record' : 'Save Payroll Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeleteModalOpen}
        title="Confirm Employee Deletion"
        message={`Are you sure you want to permanently delete employee "${empToDelete?.name}" (${empToDelete?.empId})?`}
        confirmLabel={isLoading ? 'Deleting...' : 'Delete Employee'}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => { setIsDeleteModalOpen(false); setEmpToDelete(null); }}
      />

      {/* Delete Payroll Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeletePayrollModalOpen}
        title="Confirm Payroll Record Deletion"
        message={`Are you sure you want to permanently delete the payroll record for "${payrollToDelete?.empName}" (${payrollToDelete?.month})?`}
        confirmLabel={isLoading ? 'Deleting...' : 'Delete Record'}
        variant="danger"
        onConfirm={handleConfirmDeletePayroll}
        onCancel={() => { setIsDeletePayrollModalOpen(false); setPayrollToDelete(null); }}
      />

      {/* Central Database Logging & Diagnostics Modal */}
      <DatabaseLogViewerModal
        isOpen={isLogViewerOpen}
        onClose={() => setIsLogViewerOpen(false)}
        initialModuleFilter={activeTab === 'payroll' ? 'payroll_records' : 'HR & Admin'}
      />
    </div>
  );
};
