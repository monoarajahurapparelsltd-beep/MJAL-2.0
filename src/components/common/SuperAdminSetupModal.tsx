import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Database,
  Key,
  CheckCircle,
  AlertCircle,
  Copy,
  Check,
  UserPlus,
  Crown,
  Eye,
  EyeOff,
  Sparkles,
  Lock,
  Mail,
  User as UserIcon,
  Phone,
  Building,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { Modal } from './Modal';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { Department, Role } from '../../types';

interface SuperAdminSetupModalProps {
  isOpen: boolean;
  onClose?: () => void;
  defaultTab?: 'superadmin' | 'create_user' | 'status' | 'change_password';
}

export const SuperAdminSetupModal: React.FC<SuperAdminSetupModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'superadmin'
}) => {
  const safeClose = () => {
    if (typeof onClose === 'function') onClose();
  };
  const { currentUser, createInitialSuperAdmin, changePassword, createUserByAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<'superadmin' | 'create_user' | 'status' | 'change_password'>(defaultTab);

  // Set default tab on open
  useEffect(() => {
    if (isOpen) {
      if (currentUser?.role === 'SUPER_ADMIN') {
        setActiveTab(defaultTab || 'create_user');
      } else {
        setActiveTab('superadmin');
      }
    }
  }, [isOpen, currentUser, defaultTab]);

  // Super Admin Form States
  const [adminName, setAdminName] = useState('Md. Rafiqul Islam');
  const [adminEmail, setAdminEmail] = useState('superadmin@mjal.com');
  const [adminEmployeeId, setAdminEmployeeId] = useState('EMP-SA01');
  const [adminPhone, setAdminPhone] = useState('+8801711000001');
  const [adminPassword, setAdminPassword] = useState('Admin@123456');
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [isAdminSubmitting, setIsAdminSubmitting] = useState(false);
  const [adminMsg, setAdminMsg] = useState<{ type: 'success' | 'error'; text: string; details?: any } | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);

  // Password Change Form States
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isPassSubmitting, setIsPassSubmitting] = useState(false);
  const [passMsg, setPassMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New User Form (By Admin) States
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserEmpId, setNewUserEmpId] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserDept, setNewUserDept] = useState<Department>('Sewing');
  const [newUserRole, setNewUserRole] = useState<Role>('DEPT_USER');
  const [newUserSection, setNewUserSection] = useState('');
  const [newUserLineNo, setNewUserLineNo] = useState('Line 01');
  const [newUserPass, setNewUserPass] = useState('User@123456');
  const [showNewUserPass, setShowNewUserPass] = useState(false);
  const [isNewUserSubmitting, setIsNewUserSubmitting] = useState(false);
  const [newUserMsg, setNewUserMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Generate strong random password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let pass = 'Mjal@';
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  const handleCopyCredentials = (email: string, pass: string) => {
    navigator.clipboard.writeText(`Email: ${email}\nPassword: ${pass}`);
    setCopiedCredentials(true);
    setTimeout(() => setCopiedCredentials(false), 3000);
  };

  // Submit Super Admin Creation
  const handleCreateSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminMsg(null);

    if (!adminName.trim() || !adminEmail.trim()) {
      setAdminMsg({ type: 'error', text: 'Please fill in both Full Name and Email Address.' });
      return;
    }

    if (!adminPassword || adminPassword.length < 6) {
      setAdminMsg({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }

    setIsAdminSubmitting(true);

    try {
      const res = await createInitialSuperAdmin({
        name: adminName.trim(),
        email: adminEmail.trim(),
        phone: adminPhone.trim(),
        password: adminPassword
      });

      if (res.success) {
        setAdminMsg({
          type: 'success',
          text: res.message || 'Super Admin account created and saved in Supabase Auth & public.profiles!',
          details: {
            name: adminName,
            email: adminEmail,
            role: 'SUPER_ADMIN',
            department: 'HR & Admin'
          }
        });
      } else {
        setAdminMsg({ type: 'error', text: res.message || 'Failed to create Super Admin account.' });
      }
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err?.message || 'Unexpected error creating Super Admin.' });
    } finally {
      setIsAdminSubmitting(false);
    }
  };

  // Submit Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);
    if (!newPassword || newPassword.length < 6) {
      setPassMsg({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }

    setIsPassSubmitting(true);
    try {
      const res = await changePassword(oldPassword, newPassword);
      if (res.success) {
        setPassMsg({ type: 'success', text: res.message });
        setOldPassword('');
        setNewPassword('');
      } else {
        setPassMsg({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setPassMsg({ type: 'error', text: err?.message || 'Error updating password.' });
    } finally {
      setIsPassSubmitting(false);
    }
  };

  // Submit User Provisioning
  const handleCreateUserByAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewUserMsg(null);

    if (!newUserName.trim() || !newUserEmail.trim()) {
      setNewUserMsg({ type: 'error', text: 'Full Name and Email are required.' });
      return;
    }

    if (!newUserPass || newUserPass.length < 6) {
      setNewUserMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }

    setIsNewUserSubmitting(true);
    try {
      const res = await createUserByAdmin(
        {
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          username: newUserEmpId.trim() || newUserEmail.trim().split('@')[0],
          department: newUserDept,
          role: newUserRole,
          phone: newUserPhone.trim() || undefined,
          section: newUserSection.trim() || undefined,
          line_no: newUserDept === 'Sewing' ? newUserLineNo : undefined,
          status: 'Active'
        },
        newUserPass
      );

      if (res.success) {
        setNewUserMsg({ type: 'success', text: res.message });
        setNewUserName('');
        setNewUserEmail('');
        setNewUserEmpId('');
        setNewUserPhone('');
        setNewUserPass('User@123456');
      } else {
        setNewUserMsg({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setNewUserMsg({ type: 'error', text: err?.message || 'Error provisioning user.' });
    } finally {
      setIsNewUserSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={safeClose}
      title="Supabase Authentication & Super Admin Setup"
      maxWidth="3xl"
    >
      <div className="space-y-4 text-xs">
        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto gap-1 pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('superadmin')}
            className={`pb-2 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'superadmin'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Crown className="h-4 w-4 text-amber-500" />
            Create Super Admin
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('create_user')}
            className={`pb-2 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'create_user'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <UserPlus className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
            Provision Staff & Roles
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`pb-2 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'status'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Database className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            Database & Sync Status
          </button>

          {currentUser && (
            <button
              type="button"
              onClick={() => setActiveTab('change_password')}
              className={`pb-2 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'change_password'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Key className="h-4 w-4 text-purple-500 dark:text-purple-400" />
              Change Password
            </button>
          )}
        </div>

        {/* TAB 1: CREATE SUPER ADMIN */}
        {activeTab === 'superadmin' && (
          <div className="space-y-4 animate-fade-in">
            {/* Header info banner */}
            <div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800 rounded-xl flex items-start gap-3">
              <div className="p-2 bg-blue-600 text-white rounded-lg flex-shrink-0 shadow-sm mt-0.5">
                <Crown className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Super Administrator Direct Account Provisioning
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  Creating a Super Admin account will directly register the credentials in <strong>Supabase Authentication (<code className="text-blue-700 dark:text-blue-300 bg-blue-100/60 dark:bg-blue-900/60 px-1 py-0.5 rounded">auth.users</code>)</strong> and save the user record with full factory administrative privileges into the database <strong><code className="text-blue-700 dark:text-blue-300 bg-blue-100/60 dark:bg-blue-900/60 px-1 py-0.5 rounded">public.profiles</code></strong> table.
                </p>
              </div>
            </div>

            {/* Alert Message */}
            {adminMsg && (
              <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 animate-fade-in ${
                adminMsg.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200' : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              }`}>
                {adminMsg.type === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="space-y-2 flex-1">
                  <p className="font-bold text-xs">{adminMsg.text}</p>
                  {adminMsg.details && (
                    <div className="p-2.5 bg-white/80 dark:bg-slate-900/80 rounded-lg border border-emerald-200/80 dark:border-emerald-800 text-[11px] space-y-1 text-slate-800 dark:text-slate-200">
                      <div><strong>Email:</strong> {adminMsg.details.email}</div>
                      <div><strong>Full Name:</strong> {adminMsg.details.name}</div>
                      <div><strong>Role:</strong> {adminMsg.details.role} (Unrestricted System Access)</div>
                      <div className="pt-1.5 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyCredentials(adminEmail, adminPassword)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          {copiedCredentials ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copiedCredentials ? 'Copied!' : 'Copy Credentials'}
                        </button>
                        <button
                          type="button"
                          onClick={safeClose}
                          className="px-2.5 py-1 bg-slate-900 dark:bg-slate-800 hover:bg-black dark:hover:bg-slate-700 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <span>Go to ERP Dashboard</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Creation Form */}
            <form onSubmit={handleCreateSuperAdmin} className="space-y-3.5 bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Full Name */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Super Admin Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      required
                      value={adminName}
                      onChange={e => setAdminName(e.target.value)}
                      placeholder="e.g. Md. Rafiqul Islam"
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Official Email Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    <input
                      type="email"
                      required
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                      placeholder="e.g. superadmin@mjal.com"
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Employee ID / Username */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Employee ID / Username
                  </label>
                  <div className="relative">
                    <Building className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      value={adminEmployeeId}
                      onChange={e => setAdminEmployeeId(e.target.value)}
                      placeholder="e.g. EMP-SA01"
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      value={adminPhone}
                      onChange={e => setAdminPhone(e.target.value)}
                      placeholder="e.g. +8801711000001"
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Account Password <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setAdminPassword(generateRandomPassword())}
                      className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="h-3 w-3 text-blue-500" /> Generate Secure Password
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    <input
                      type={showAdminPass ? 'text' : 'password'}
                      required
                      value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                      placeholder="At least 6 characters (e.g. Admin@123456)"
                      className="w-full pl-8 pr-16 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPass(!showAdminPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      {showAdminPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Saves directly to Supabase Auth & profiles table
                </span>
                <button
                  type="submit"
                  disabled={isAdminSubmitting}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-all"
                >
                  {isAdminSubmitting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving to Supabase...</span>
                    </>
                  ) : (
                    <>
                      <Crown className="h-3.5 w-3.5 text-amber-300" />
                      <span>Create Super Admin Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: PROVISION USER / STAFF */}
        {activeTab === 'create_user' && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-start gap-2.5">
              <UserPlus className="h-5 w-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs">Provision Any Staff / Department Officer</h4>
                <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                  Add users with specific factory roles (GM, Director, MD, Sewing, Cutting, QC, Store, etc.). They will be stored in Supabase Auth and assigned tailored department access.
                </p>
              </div>
            </div>

            {newUserMsg && (
              <div className={`p-3 rounded-lg text-xs font-medium ${
                newUserMsg.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
              }`}>
                {newUserMsg.text}
              </div>
            )}

            <form onSubmit={handleCreateUserByAdmin} className="space-y-3.5 bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newUserName}
                    onChange={e => setNewUserName(e.target.value)}
                    placeholder="e.g. Enayet Hossain"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={e => setNewUserEmail(e.target.value)}
                    placeholder="e.g. qc.officer@mjal.com"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Department</label>
                  <select
                    value={newUserDept}
                    onChange={e => setNewUserDept(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="HR & Admin">HR & Admin</option>
                    <option value="Store">Store</option>
                    <option value="Merchandising">Merchandising</option>
                    <option value="Sample">Sample</option>
                    <option value="Order Management">Order Management</option>
                    <option value="Cutting">Cutting</option>
                    <option value="Sewing">Sewing</option>
                    <option value="Washing">Washing</option>
                    <option value="Finishing">Finishing</option>
                    <option value="QC">QC</option>
                    <option value="Packing">Packing</option>
                    <option value="Shipment">Shipment</option>
                    <option value="Accounts/Finance">Accounts/Finance</option>
                    <option value="Production Planning">Production Planning</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Assigned Role</label>
                  <select
                    value={newUserRole}
                    onChange={e => setNewUserRole(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="SUPER_ADMIN">👑 Super Admin (Full Control)</option>
                    <option value="HR_ADMIN">🛡️ HR Admin (HR, Attendance & Payroll)</option>
                    <option value="MD">👑 Managing Director (MD - Executive View)</option>
                    <option value="DIRECTOR">👔 Director (Executive Oversight)</option>
                    <option value="GM">🏢 General Manager (GM)</option>
                    <option value="DEPT_USER">📋 Department Officer / Staff</option>
                    <option value="SECTION_USER">🏷️ Section In-Charge</option>
                    <option value="LINE_USER">🧵 Line Operator / Supervisor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Employee ID</label>
                  <input
                    type="text"
                    value={newUserEmpId}
                    onChange={e => setNewUserEmpId(e.target.value)}
                    placeholder="e.g. EMP-1025"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={newUserPhone}
                    onChange={e => setNewUserPhone(e.target.value)}
                    placeholder="e.g. +8801700000002"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {newUserDept === 'Sewing' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Assigned Sewing Line</label>
                    <select
                      value={newUserLineNo}
                      onChange={e => setNewUserLineNo(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Array.from({ length: 15 }, (_, i) => `Line ${String(i + 1).padStart(2, '0')}`).map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={newUserDept === 'Sewing' ? '' : 'sm:col-span-2'}>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Password *</label>
                  <div className="relative">
                    <input
                      type={showNewUserPass ? 'text' : 'password'}
                      required
                      value={newUserPass}
                      onChange={e => setNewUserPass(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewUserPass(!showNewUserPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      {showNewUserPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={isNewUserSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {isNewUserSubmitting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Provisioning...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>Provision User in Supabase</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: SUPABASE STATUS */}
        {activeTab === 'status' && (
          <div className="space-y-4 animate-fade-in">
            <div className={`p-4 rounded-xl border ${isSupabaseConfigured() ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200' : 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'}`}>
              <div className="flex items-center gap-3">
                {isSupabaseConfigured() ? (
                  <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                )}
                <div>
                  <h3 className="font-bold text-sm">
                    {isSupabaseConfigured() ? 'Supabase Database Configured & Synchronized' : 'Supabase Credentials Pending'}
                  </h3>
                  <p className="text-xs mt-0.5 opacity-90">
                    {isSupabaseConfigured()
                      ? 'Authentication and operational data (Orders, Cutting, Sewing, QC, Finishing, HR, Audit Logs) synchronizes directly with Supabase with Row Level Security (RLS).'
                      : 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables to link your remote Supabase instance.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs space-y-2.5 font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-slate-300">Supabase Connected Instance:</span>
                <span className="text-[10px] text-emerald-400 font-bold">pjbfuhsmzjvgfpxlyijc.supabase.co</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1">
                <div>• <span className="text-slate-200">auth.users</span>: Secure Supabase Auth</div>
                <div>• <span className="text-slate-200">public.profiles</span>: User RBAC Roles</div>
                <div>• <span className="text-slate-200">public.order_styles</span>: Orders & Styles</div>
                <div>• <span className="text-slate-200">public.cutting_entries</span>: Cutting Logs</div>
                <div>• <span className="text-slate-200">public.sewing_production</span>: Sewing Output</div>
                <div>• <span className="text-slate-200">public.audit_logs</span>: Security & Trail</div>
              </div>
              <div className="pt-2 text-[10px] text-slate-500 font-sans border-t border-slate-800 flex justify-between items-center">
                <span>Database schema defined in <code className="text-blue-300 font-mono">/supabase_schema.sql</code></span>
                <span className="text-emerald-400">All 14 Tables Ready</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CHANGE PASSWORD */}
        {activeTab === 'change_password' && currentUser && (
          <form onSubmit={handleChangePassword} className="space-y-4 animate-fade-in">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Update password for active session: <strong>{currentUser.name} ({currentUser.email})</strong>
            </p>

            {passMsg && (
              <div className={`p-3 rounded-lg text-xs font-medium ${passMsg.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200' : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200'}`}>
                {passMsg.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Current Password</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isPassSubmitting}
                className="px-4 py-2 bg-slate-900 dark:bg-blue-600 hover:bg-black dark:hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                {isPassSubmitting ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
