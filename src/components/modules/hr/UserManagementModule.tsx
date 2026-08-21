import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Key,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Lock,
  Building,
  Briefcase,
  Layers,
  Phone,
  Mail,
  UserCheck,
  UserX,
  Sparkles,
  Download,
  Printer,
  Check,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { User, Role, Department, Permission } from '../../../types';
import { supabaseDataService, generateDefaultPermissions } from '../../../services/supabaseDataService';
import { Modal } from '../../common/Modal';
import { ConfirmationDialog } from '../../common/ConfirmationDialog';
import { StatusBadge } from '../../common/StatusBadge';
import { isSupabaseConfigured } from '../../../lib/supabase';

const ALL_DEPARTMENTS: Department[] = [
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

const ALL_PERMISSIONS: Permission[] = [
  'VIEW',
  'CREATE',
  'EDIT',
  'DELETE',
  'SUBMIT',
  'APPROVE',
  'EXPORT',
  'PRINT'
];

const ROLE_OPTIONS: { value: Role; label: string; description: string; badgeColor: string }[] = [
  { value: 'SUPER_ADMIN', label: 'Super Admin', description: 'Unrestricted full control across all factory modules, user administration & security', badgeColor: 'bg-purple-100 text-purple-800 border-purple-200' },
  { value: 'HR_ADMIN', label: 'HR Admin', description: 'Manages employee directory, attendance, payroll calculations and HR records', badgeColor: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'MD', label: 'Managing Director (MD)', description: 'Executive level view-only analytics and all department reporting suites', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'DIRECTOR', label: 'Director', description: 'Executive view and audit oversight of factory performance', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'GM', label: 'General Manager (GM)', description: 'High-level factory oversight with approval and report generation capabilities', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'DEPT_USER', label: 'Department User / Officer', description: 'Full operational access restricted to assigned department', badgeColor: 'bg-slate-100 text-slate-800 border-slate-200' },
  { value: 'SECTION_USER', label: 'Section In-Charge', description: 'Operational entry and reporting for assigned floor section', badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  { value: 'LINE_USER', label: 'Line Operator / Supervisor', description: 'Dedicated sewing line production entry and inspection logging', badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200' }
];

export const UserManagementModule: React.FC = () => {
  const {
    currentUser,
    users,
    createUserByAdmin,
    updateUserByAdmin,
    deleteUserByAdmin,
    purgeDemoMockUsers,
    resetUserPasswordByAdmin
  } = useAuth();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [isPurgingMock, setIsPurgingMock] = useState(false);

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [isResetPassModalOpen, setIsResetPassModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Selected User
  const [activeTargetUser, setActiveTargetUser] = useState<User | null>(null);

  // Form Fields
  const [formTab, setFormTab] = useState<'info' | 'role' | 'permissions'>('info');
  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formDesignation, setFormDesignation] = useState('');
  const [formDepartment, setFormDepartment] = useState<Department>('Sewing');
  const [formRole, setFormRole] = useState<Role>('DEPT_USER');
  const [formSection, setFormSection] = useState('');
  const [formLineNo, setFormLineNo] = useState('');
  const [formStatus, setFormStatus] = useState<'Active' | 'Inactive'>('Active');
  const [formPermissions, setFormPermissions] = useState<Record<Department, Permission[]>>({} as any);

  // Helper States
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncingDB, setIsSyncingDB] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Sync all users to remote Supabase profiles
  const handleSyncToSupabase = async () => {
    setIsSyncingDB(true);
    try {
      const res = await supabaseDataService.syncAllUsersToSupabase();
      if (res.success) {
        showToast('success', `Successfully persisted all ${res.count} users into Supabase database (public.profiles)!`);
      } else {
        showToast('error', res.error || 'Failed to sync users to Supabase.');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Sync error occurred');
    } finally {
      setIsSyncingDB(false);
    }
  };

  // Generate strong random password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let pass = 'Mjal@';
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  // Password strength calculator
  const passwordStrength = useMemo(() => {
    if (!formPassword) return { score: 0, label: 'None', color: 'bg-slate-200' };
    let score = 0;
    if (formPassword.length >= 6) score += 1;
    if (formPassword.length >= 8) score += 1;
    if (/[A-Z]/.test(formPassword)) score += 1;
    if (/[0-9]/.test(formPassword)) score += 1;
    if (/[!@#$%^&*]/.test(formPassword)) score += 1;

    if (score <= 2) return { score, label: 'Weak', color: 'bg-rose-500' };
    if (score <= 4) return { score, label: 'Medium', color: 'bg-amber-500' };
    return { score, label: 'Strong', color: 'bg-emerald-500' };
  }, [formPassword]);

  // STRICT ACCESS CHECK: Only Super Admin can access this module
  if (currentUser?.role !== 'SUPER_ADMIN') {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4 bg-white rounded-2xl border border-rose-200 shadow-sm mt-8 animate-fade-in">
        <div className="h-16 w-16 mx-auto bg-rose-100 text-rose-600 rounded-full flex items-center justify-center">
          <Lock className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900">Access Restricted to Super Admin</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          The <strong>User Management & Security Administration</strong> module contains sensitive authentication
          and role delegation controls. Access is strictly reserved for authenticated <strong>Super Administrators</strong>.
        </p>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
          Logged in as: <strong className="text-slate-800">{currentUser?.name}</strong> ({currentUser?.role})
        </div>
      </div>
    );
  }

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Search term
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesName = (u.name || '').toLowerCase().includes(query);
        const matchesEmail = (u.email || '').toLowerCase().includes(query);
        const matchesUsername = (u.username || '').toLowerCase().includes(query);
        const matchesEmpId = (u.employee_id || '').toLowerCase().includes(query);
        const matchesPhone = (u.phone || '').toLowerCase().includes(query);
        const matchesDept = (u.department || '').toLowerCase().includes(query);
        if (!matchesName && !matchesEmail && !matchesUsername && !matchesEmpId && !matchesPhone && !matchesDept) {
          return false;
        }
      }

      // Department Filter
      if (selectedDeptFilter !== 'ALL' && u.department !== selectedDeptFilter) {
        return false;
      }

      // Role Filter
      if (selectedRoleFilter !== 'ALL' && u.role !== selectedRoleFilter) {
        return false;
      }

      // Status Filter
      if (selectedStatusFilter !== 'ALL' && u.status !== selectedStatusFilter) {
        return false;
      }

      return true;
    });
  }, [users, searchTerm, selectedDeptFilter, selectedRoleFilter, selectedStatusFilter]);

  // Metrics
  const metrics = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => u.status === 'Active').length;
    const inactive = users.filter(u => u.status === 'Inactive').length;
    const superAdmins = users.filter(u => u.role === 'SUPER_ADMIN').length;
    const executive = users.filter(u => ['MD', 'DIRECTOR', 'GM', 'HR_ADMIN'].includes(u.role)).length;
    const operators = total - superAdmins - executive;

    return { total, active, inactive, superAdmins, executive, operators };
  }, [users]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormMode('create');
    setFormFullName('');
    setFormEmail('');
    setFormUsername('');
    setFormPassword(generateRandomPassword());
    setFormPhone('');
    setFormDesignation('');
    setFormDepartment('Sewing');
    setFormRole('DEPT_USER');
    setFormSection('');
    setFormLineNo('Line 01');
    setFormStatus('Active');
    setFormPermissions(generateDefaultPermissions('DEPT_USER', 'Sewing'));
    setFormTab('info');
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (user: User) => {
    setActiveTargetUser(user);
    setFormMode('edit');
    setFormFullName(user.name);
    setFormEmail(user.email);
    setFormUsername(user.username || user.employee_id || '');
    setFormPassword('');
    setFormPhone(user.phone || '');
    setFormDesignation(user.designation || '');
    setFormDepartment(user.department);
    setFormRole(user.role);
    setFormSection(user.section || '');
    setFormLineNo(user.line_no || '');
    setFormStatus(user.status);
    setFormPermissions(user.permissions || generateDefaultPermissions(user.role, user.department));
    setFormTab('info');
    setIsFormModalOpen(true);
  };

  // Open Reset Password Modal
  const handleOpenResetPass = (user: User) => {
    setActiveTargetUser(user);
    setNewResetPassword(generateRandomPassword());
    setIsResetPassModalOpen(true);
  };

  // Open View Details Modal
  const handleOpenView = (user: User) => {
    setActiveTargetUser(user);
    setIsViewModalOpen(true);
  };

  // Open Delete Confirmation
  const handleOpenDelete = (user: User) => {
    setActiveTargetUser(user);
    setIsDeleteModalOpen(true);
  };

  // Handle Role or Department Change in Form (auto-update permissions)
  const handleRoleChange = (newRole: Role) => {
    setFormRole(newRole);
    setFormPermissions(generateDefaultPermissions(newRole, formDepartment));
  };

  const handleDepartmentChange = (newDept: Department) => {
    setFormDepartment(newDept);
    setFormPermissions(generateDefaultPermissions(formRole, newDept));
  };

  // Permission Matrix Toggles
  const handleTogglePermission = (dept: Department, perm: Permission) => {
    setFormPermissions(prev => {
      const currentPerms = prev[dept] || [];
      const hasPerm = currentPerms.includes(perm);
      const updatedDeptPerms = hasPerm
        ? currentPerms.filter(p => p !== perm)
        : [...currentPerms, perm];

      return {
        ...prev,
        [dept]: updatedDeptPerms
      };
    });
  };

  const handleSelectAllPermissions = () => {
    const all: Record<Department, Permission[]> = {} as any;
    ALL_DEPARTMENTS.forEach(d => {
      all[d] = [...ALL_PERMISSIONS];
    });
    setFormPermissions(all);
  };

  const handleViewOnlyAll = () => {
    const viewOnly: Record<Department, Permission[]> = {} as any;
    ALL_DEPARTMENTS.forEach(d => {
      viewOnly[d] = ['VIEW', 'EXPORT', 'PRINT'];
    });
    setFormPermissions(viewOnly);
  };

  const handleResetToDefaults = () => {
    setFormPermissions(generateDefaultPermissions(formRole, formDepartment));
  };

  const handleClearAllPermissions = () => {
    const empty: Record<Department, Permission[]> = {} as any;
    ALL_DEPARTMENTS.forEach(d => {
      empty[d] = [];
    });
    setFormPermissions(empty);
  };

  // Submit Create or Edit User
  const handleSubmitUserForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFullName || !formEmail) {
      showToast('error', 'Full Name and Email are mandatory fields.');
      return;
    }

    if (formMode === 'create' && (!formPassword || formPassword.length < 6)) {
      showToast('error', 'Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);

    if (formMode === 'create') {
      const res = await createUserByAdmin(
        {
          name: formFullName.trim(),
          email: formEmail.trim().toLowerCase(),
          username: formUsername.trim() || formEmail.split('@')[0],
          department: formDepartment,
          designation: formDesignation.trim(),
          role: formRole,
          employee_id: formUsername.trim() || formEmail.split('@')[0],
          phone: formPhone.trim(),
          status: formStatus,
          section: formSection.trim(),
          line_no: formLineNo.trim(),
          permissions: formPermissions
        },
        formPassword
      );

      setIsSubmitting(false);

      if (res.success) {
        showToast('success', res.message);
        setIsFormModalOpen(false);
      } else {
        showToast('error', res.message);
      }
    } else if (formMode === 'edit' && activeTargetUser) {
      const updatedUser: User = {
        ...activeTargetUser,
        name: formFullName.trim(),
        email: formEmail.trim().toLowerCase(),
        username: formUsername.trim() || activeTargetUser.username,
        department: formDepartment,
        designation: formDesignation.trim(),
        role: formRole,
        employee_id: formUsername.trim() || activeTargetUser.employee_id,
        phone: formPhone.trim(),
        status: formStatus,
        section: formSection.trim(),
        line_no: formLineNo.trim(),
        permissions: formPermissions
      };

      const res = await updateUserByAdmin(updatedUser, formPassword ? formPassword : undefined);
      setIsSubmitting(false);

      if (res.success) {
        showToast('success', res.message);
        setIsFormModalOpen(false);
      } else {
        showToast('error', res.message);
      }
    }
  };

  // Submit Password Reset
  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTargetUser || !newResetPassword || newResetPassword.length < 6) {
      showToast('error', 'Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    const res = await resetUserPasswordByAdmin(activeTargetUser.id, newResetPassword);
    setIsSubmitting(false);

    if (res.success) {
      showToast('success', `Password for ${activeTargetUser.name} reset successfully.`);
      setIsResetPassModalOpen(false);
    } else {
      showToast('error', res.message);
    }
  };

  // Submit Delete User
  const handleConfirmDelete = async () => {
    if (!activeTargetUser) return;
    setIsSubmitting(true);
    const res = await deleteUserByAdmin(activeTargetUser.id);
    setIsSubmitting(false);

    if (res.success) {
      showToast('success', `User ${activeTargetUser.name} deleted permanently.`);
      setIsDeleteModalOpen(false);
      setActiveTargetUser(null);
    } else {
      showToast('error', res.message);
    }
  };

  // Bulk Purge Demo Mock Users
  const handlePurgeMockUsers = async () => {
    if (!window.confirm('Are you sure you want to permanently remove all default/mock demo users? They will be deleted from Supabase Database and local cache and will not return.')) {
      return;
    }
    setIsPurgingMock(true);
    const res = await purgeDemoMockUsers();
    setIsPurgingMock(false);
    if (res.success) {
      showToast('success', res.message || 'Demo mock users purged permanently.');
    } else {
      showToast('error', res.message || 'Failed to purge demo users.');
    }
  };

  // Toggle Active/Inactive Quick Switch
  const handleToggleStatus = async (user: User) => {
    const nextStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    const updated = { ...user, status: nextStatus };
    const res = await updateUserByAdmin(updated);
    if (res.success) {
      showToast('success', `User ${user.name} set to ${nextStatus}.`);
    } else {
      showToast('error', res.message);
    }
  };

  // Export User Directory to CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Full Name', 'Email', 'Username / Emp ID', 'Role', 'Department', 'Designation', 'Phone', 'Status', 'Active Permissions Count'];
    const rows = filteredUsers.map(u => {
      let activePermsCount = 0;
      if (u.permissions && typeof u.permissions === 'object') {
        Object.values(u.permissions).forEach(p => {
          if (Array.isArray(p)) activePermsCount += p.length;
        });
      }
      return [
        u.id,
        `"${u.name}"`,
        u.email,
        u.username || u.employee_id || '',
        u.role,
        `"${u.department}"`,
        `"${u.designation || ''}"`,
        `"${u.phone || ''}"`,
        u.status,
        activePermsCount
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MJAL_ERP_User_Directory_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`p-4 rounded-xl shadow-lg border flex items-center justify-between text-xs font-bold transition-all ${
          toastMessage.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-rose-600" />}
            <span>{toastMessage.text}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Shield className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-white">Super Admin – User Management & Security Matrix</h1>
            <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/40">
              Super Admin Exclusive
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Create, authenticate, and manage users directly in Supabase Auth & Profiles. Configure role-based access control (RBAC) and operational permission matrices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={handlePurgeMockUsers}
            disabled={isPurgingMock}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-800/70 shadow-sm transition-all disabled:opacity-50"
            title="Permanently remove all default/mock demo users from database & local storage"
          >
            <Trash2 className={`h-3.5 w-3.5 ${isPurgingMock ? 'animate-spin' : ''}`} />
            <span>{isPurgingMock ? 'Purging Demo Users...' : 'Purge Demo Users'}</span>
          </button>
          <button
            onClick={handleSyncToSupabase}
            disabled={isSyncingDB}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white border border-emerald-400/40 shadow-sm transition-all disabled:opacity-50"
            title="Persist all local/cached users into remote Supabase public.profiles table"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncingDB ? 'animate-spin' : ''}`} />
            <span>{isSyncingDB ? 'Syncing to DB...' : 'Sync to Supabase DB'}</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Create New User
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">Total Users</span>
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-xl font-black text-slate-900 mt-1">{metrics.total}</p>
          <span className="text-[10px] text-slate-400">All registered profiles</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">Active Accounts</span>
            <UserCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-xl font-black text-emerald-600 mt-1">{metrics.active}</p>
          <span className="text-[10px] text-emerald-600/80">Can login & operate</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">Inactive Accounts</span>
            <UserX className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-xl font-black text-rose-600 mt-1">{metrics.inactive}</p>
          <span className="text-[10px] text-rose-500/80">Access disabled</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">Super Admins</span>
            <ShieldCheck className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-xl font-black text-purple-700 mt-1">{metrics.superAdmins}</p>
          <span className="text-[10px] text-purple-600/80">Full root privileges</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">Executives & HR</span>
            <Building className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-xl font-black text-amber-700 mt-1">{metrics.executive}</p>
          <span className="text-[10px] text-slate-400">MD, GM, Directors, HR</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">Floor & Line Users</span>
            <Briefcase className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="text-xl font-black text-indigo-700 mt-1">{metrics.operators}</p>
          <span className="text-[10px] text-slate-400">Department Operators</span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Name, Email, Username, Employee ID, Phone, Department..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Department Filter */}
            <select
              value={selectedDeptFilter}
              onChange={e => setSelectedDeptFilter(e.target.value)}
              className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Departments ({users.length})</option>
              {ALL_DEPARTMENTS.map(d => (
                <option key={d} value={d}>
                  {d} ({users.filter(u => u.department === d).length})
                </option>
              ))}
            </select>

            {/* Role Filter */}
            <select
              value={selectedRoleFilter}
              onChange={e => setSelectedRoleFilter(e.target.value)}
              className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Roles</option>
              {ROLE_OPTIONS.map(r => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatusFilter}
              onChange={e => setSelectedStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Status</option>
              <option value="Active">Active Only ({metrics.active})</option>
              <option value="Inactive">Inactive Only ({metrics.inactive})</option>
            </select>

            {(searchTerm || selectedDeptFilter !== 'ALL' || selectedRoleFilter !== 'ALL' || selectedStatusFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedDeptFilter('ALL');
                  setSelectedRoleFilter('ALL');
                  setSelectedStatusFilter('ALL');
                }}
                className="px-2.5 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors font-bold"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-slate-800">User Directory & Role Permissions</h3>
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-slate-100 text-slate-600">
              {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            {isSupabaseConfigured() ? '⚡ Realtime Supabase Profile Sync Active' : '💾 Local Profile Storage Active'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">User & Identity</th>
                <th className="px-4 py-3">Role & Scope</th>
                <th className="px-4 py-3">Department & Section</th>
                <th className="px-4 py-3">Permissions Matrix</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    <Users className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-600">No users found matching your filters</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Try adjusting search query or filter options</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const roleOption = ROLE_OPTIONS.find(r => r.value === user.role);
                  const isCurrent = user.id === currentUser.id;

                  // Count active permissions
                  let activePermCount = 0;
                  if (user.permissions && typeof user.permissions === 'object') {
                    Object.values(user.permissions).forEach(p => {
                      if (Array.isArray(p)) activePermCount += p.length;
                    });
                  }

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Identity */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                            {user.name.substring(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">{user.name}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 text-[9px] font-black rounded bg-blue-100 text-blue-800">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                              <span className="font-mono text-slate-700 font-semibold">{user.username || user.employee_id}</span>
                              <span>•</span>
                              <span>{user.email}</span>
                            </div>
                            {user.phone && (
                              <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Phone className="h-2.5 w-2.5" />
                                {user.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-1 text-[11px] font-bold rounded-lg border ${roleOption?.badgeColor || 'bg-slate-100 text-slate-800'}`}>
                          {roleOption?.label || user.role}
                        </span>
                        {user.designation && (
                          <p className="text-[11px] text-slate-500 font-semibold mt-1">
                            {user.designation}
                          </p>
                        )}
                      </td>

                      {/* Department & Section */}
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-800">{user.department}</span>
                        {(user.section || user.line_no) && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {user.section} {user.line_no ? `• ${user.line_no}` : ''}
                          </p>
                        )}
                      </td>

                      {/* Permissions Summary */}
                      <td className="px-4 py-3">
                        {user.role === 'SUPER_ADMIN' ? (
                          <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-purple-50 text-purple-700 border border-purple-200">
                            Unrestricted Full Access
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-700">{activePermCount} Operations</span>
                              <span className="text-[10px] text-slate-400">across 14 depts</span>
                            </div>
                            <button
                              onClick={() => handleOpenView(user)}
                              className="text-[11px] text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
                            >
                              View Matrix
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleStatus(user)}
                          disabled={isCurrent}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                            user.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                          } ${isCurrent ? 'opacity-70 cursor-not-allowed' : ''}`}
                          title={isCurrent ? 'Cannot deactivate your own user session' : 'Click to toggle status'}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                          {user.status}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenView(user)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Full Profile"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(user)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit User & Permissions"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleOpenResetPass(user)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Reset User Password"
                          >
                            <Key className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(user)}
                            disabled={isCurrent}
                            className={`p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ${
                              isCurrent ? 'opacity-30 cursor-not-allowed' : ''
                            }`}
                            title={isCurrent ? 'Cannot delete your own user account' : 'Delete User'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE / EDIT USER MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={formMode === 'create' ? 'Create New Application User' : `Edit User: ${activeTargetUser?.name}`}
        maxWidth="4xl"
      >
        <form onSubmit={handleSubmitUserForm} className="space-y-4">
          {/* Modal Tabs */}
          <div className="flex border-b border-slate-200 gap-3">
            <button
              type="button"
              onClick={() => setFormTab('info')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                formTab === 'info'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Users className="h-4 w-4" />
              1. Identity & Credentials
            </button>
            <button
              type="button"
              onClick={() => setFormTab('role')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                formTab === 'role'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Shield className="h-4 w-4" />
              2. Role & Department
            </button>
            <button
              type="button"
              onClick={() => setFormTab('permissions')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                formTab === 'permissions'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Layers className="h-4 w-4" />
              3. Granular Permissions Matrix
            </button>
          </div>

          {/* TAB 1: INFO & CREDENTIALS */}
          {formTab === 'info' && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Md. Kamal Hossain"
                    value={formFullName}
                    onChange={e => setFormFullName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address (Login Username) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. kamal.cutting@mjal.com"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Employee ID / Short Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MJAL-1045"
                    value={formUsername}
                    onChange={e => setFormUsername(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Designation / Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cutting Master / Line Supervisor"
                    value={formDesignation}
                    onChange={e => setFormDesignation(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +880 1712 345678"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Password Setup */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-800">
                      {formMode === 'create' ? 'Initial Password' : 'Change Password (Optional)'}
                      {formMode === 'create' && <span className="text-rose-500"> *</span>}
                    </label>
                    <p className="text-[11px] text-slate-500">
                      {formMode === 'create'
                        ? 'User will use this password to log into Supabase Authentication.'
                        : 'Leave blank to keep existing password.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFormPassword(generateRandomPassword())}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                  >
                    <Sparkles className="h-3 w-3" />
                    Generate Strong
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={formMode === 'create' ? 'Min 6 characters' : 'Enter new password if updating'}
                    value={formPassword}
                    onChange={e => setFormPassword(e.target.value)}
                    className="w-full pl-3 pr-20 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold bg-white"
                    required={formMode === 'create'}
                  />
                  <div className="absolute right-2 top-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-slate-400 hover:text-slate-600"
                      title={showPassword ? 'Hide' : 'Show'}
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    {formPassword && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(formPassword);
                          setCopiedPass(true);
                          setTimeout(() => setCopiedPass(false), 2000);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600"
                        title="Copy password"
                      >
                        {copiedPass ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                {formPassword && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${passwordStrength.color} transition-all duration-300`}
                        style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-600">
                      Strength: {passwordStrength.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Account Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Account Status</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer flex-1 hover:bg-slate-50">
                    <input
                      type="radio"
                      name="status"
                      value="Active"
                      checked={formStatus === 'Active'}
                      onChange={() => setFormStatus('Active')}
                      className="text-blue-600"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Active</p>
                      <p className="text-[10px] text-slate-500">Can log in and operate immediately</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer flex-1 hover:bg-slate-50">
                    <input
                      type="radio"
                      name="status"
                      value="Inactive"
                      checked={formStatus === 'Inactive'}
                      onChange={() => setFormStatus('Inactive')}
                      className="text-rose-600"
                    />
                    <div>
                      <p className="text-xs font-bold text-rose-900">Inactive</p>
                      <p className="text-[10px] text-slate-500">Account locked, cannot authenticate</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ROLE & DEPARTMENT */}
          {formTab === 'role' && (
            <div className="space-y-4 py-2">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Select User Role <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ROLE_OPTIONS.map(r => (
                    <div
                      key={r.value}
                      onClick={() => handleRoleChange(r.value)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        formRole === r.value
                          ? 'border-blue-600 bg-blue-50/50 shadow-xs ring-1 ring-blue-600'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">{r.label}</span>
                        {formRole === r.value && <CheckCircle className="h-4 w-4 text-blue-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{r.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assigned Department <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formDepartment}
                    onChange={e => handleDepartmentChange(e.target.value as Department)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold bg-white"
                  >
                    {ALL_DEPARTMENTS.map(d => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Section / Unit
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Main Unit, Fabric Store"
                    value={formSection}
                    onChange={e => setFormSection(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Sewing Line No (if applicable)
                  </label>
                  <select
                    value={formLineNo}
                    onChange={e => setFormLineNo(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">N/A (All Lines)</option>
                    {['Line 01', 'Line 02', 'Line 03', 'Line 04', 'Line 05', 'Line 06', 'Line 07', 'Line 08'].map(l => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <span>
                    Selecting a role automatically configures the default permissions matrix for <strong>{formDepartment}</strong>.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormTab('permissions')}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-200/80 hover:bg-amber-300 text-amber-900 transition-colors"
                >
                  Review Matrix →
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: GRANULAR PERMISSION MATRIX */}
          {formTab === 'permissions' && (
            <div className="space-y-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-xs">
                  <span className="font-bold text-slate-800">Permissions Matrix: </span>
                  <span className="text-slate-500">Fine-tune individual action permissions per department.</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSelectAllPermissions}
                    className="px-2 py-1 text-[10px] font-bold rounded bg-slate-200 hover:bg-slate-300 text-slate-800"
                  >
                    Grant All
                  </button>
                  <button
                    type="button"
                    onClick={handleViewOnlyAll}
                    className="px-2 py-1 text-[10px] font-bold rounded bg-slate-200 hover:bg-slate-300 text-slate-800"
                  >
                    View Only All
                  </button>
                  <button
                    type="button"
                    onClick={handleResetToDefaults}
                    className="px-2 py-1 text-[10px] font-bold rounded bg-blue-100 hover:bg-blue-200 text-blue-800"
                  >
                    Reset to Role Defaults
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllPermissions}
                    className="px-2 py-1 text-[10px] font-bold rounded bg-rose-100 hover:bg-rose-200 text-rose-800"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="max-h-[380px] overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 w-44">Department</th>
                      {ALL_PERMISSIONS.map(p => (
                        <th key={p} className="px-2 py-2 text-center text-[10px] font-mono">
                          {p}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {ALL_DEPARTMENTS.map(dept => {
                      const deptPerms = formPermissions[dept] || [];
                      const isAssignedDept = dept === formDepartment;

                      return (
                        <tr key={dept} className={`hover:bg-slate-50 ${isAssignedDept ? 'bg-blue-50/40' : ''}`}>
                          <td className="px-3 py-2 font-bold text-slate-800 flex items-center gap-1.5">
                            <span>{dept}</span>
                            {isAssignedDept && (
                              <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-blue-100 text-blue-800">
                                Assigned
                              </span>
                            )}
                          </td>
                          {ALL_PERMISSIONS.map(perm => {
                            const isChecked = deptPerms.includes(perm);
                            return (
                              <td key={perm} className="px-2 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleTogglePermission(dept, perm)}
                                  className="h-3.5 w-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <div className="text-xs text-slate-500">
              {formMode === 'create' ? 'User will be registered in Supabase Auth automatically.' : 'Changes will synchronize instantly.'}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Saving User...
                  </>
                ) : formMode === 'create' ? (
                  <>
                    <UserPlus className="h-3.5 w-3.5" />
                    Create User
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Update User Profile
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: RESET PASSWORD MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isResetPassModalOpen}
        onClose={() => setIsResetPassModalOpen(false)}
        title={`Reset Password for ${activeTargetUser?.name}`}
        maxWidth="md"
      >
        <form onSubmit={handleConfirmResetPassword} className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
            <p className="font-bold text-slate-800">{activeTargetUser?.name}</p>
            <p className="text-slate-500 font-mono">{activeTargetUser?.email}</p>
            <p className="text-slate-500">Role: <strong className="text-slate-700">{activeTargetUser?.role}</strong></p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">New Password *</label>
              <button
                type="button"
                onClick={() => setNewResetPassword(generateRandomPassword())}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800"
              >
                Generate Random
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 6 characters"
                value={newResetPassword}
                onChange={e => setNewResetPassword(e.target.value)}
                className="w-full pl-3 pr-10 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsResetPassModalOpen(false)}
              className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting ? 'Resetting...' : 'Confirm Password Reset'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: VIEW FULL PROFILE MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="User Profile & Authorization Details"
        maxWidth="3xl"
      >
        {activeTargetUser && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-4 p-4 bg-slate-900 text-white rounded-xl">
              <div className="h-12 w-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-base uppercase flex-shrink-0">
                {activeTargetUser.name.substring(0, 2)}
              </div>
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm text-white">{activeTargetUser.name}</h3>
                <p className="text-slate-300 font-mono">{activeTargetUser.email}</p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30">
                    {activeTargetUser.role}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    {activeTargetUser.department}
                  </span>
                  <StatusBadge status={activeTargetUser.status} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Employee ID</span>
                <p className="font-bold text-slate-800 mt-0.5 font-mono">{activeTargetUser.username || activeTargetUser.employee_id || 'N/A'}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Designation</span>
                <p className="font-bold text-slate-800 mt-0.5">{activeTargetUser.designation || 'Staff'}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Section / Line</span>
                <p className="font-bold text-slate-800 mt-0.5">{activeTargetUser.section || 'General'} {activeTargetUser.line_no ? `(${activeTargetUser.line_no})` : ''}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Phone</span>
                <p className="font-bold text-slate-800 mt-0.5">{activeTargetUser.phone || 'N/A'}</p>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-800 mb-2">Configured Department Permissions</h4>
              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Department</th>
                      <th className="px-3 py-2">Permitted Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ALL_DEPARTMENTS.map(dept => {
                      const perms = activeTargetUser.permissions?.[dept] || [];
                      return (
                        <tr key={dept} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-bold text-slate-800">{dept}</td>
                          <td className="px-3 py-2">
                            {perms.length === 0 ? (
                              <span className="text-slate-400 italic">No access</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {perms.map(p => (
                                  <span key={p} className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded bg-slate-100 text-slate-700 border border-slate-200">
                                    {p}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-900 text-white hover:bg-black"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: DELETE USER CONFIRMATION DIALOG */}
      {/* ========================================================================= */}
      <ConfirmationDialog
        isOpen={isDeleteModalOpen}
        title="Confirm User Deletion"
        message={`Are you sure you want to permanently delete user "${activeTargetUser?.name}" (${activeTargetUser?.email})? This removes their profile and auth access.`}
        confirmLabel={isSubmitting ? 'Deleting...' : 'Delete User Permanently'}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => { setIsDeleteModalOpen(false); setActiveTargetUser(null); }}
      />
    </div>
  );
};
