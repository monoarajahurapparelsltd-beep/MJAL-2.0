import React from 'react';
import { ShieldAlert, Lock, Building2, ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useERP } from '../../context/ERPContext';

interface AccessDeniedGuardProps {
  reason?: 'UNAUTHORIZED' | 'MISSING_SCOPE' | 'SUSPENDED';
  attemptedModule?: string;
}

export const AccessDeniedGuard: React.FC<AccessDeniedGuardProps> = ({
  reason = 'UNAUTHORIZED',
  attemptedModule
}) => {
  const { currentUser, logout } = useAuth();
  const { setActiveModule } = useERP();

  const getModuleLabel = (mod?: string) => {
    if (!mod) return 'Requested Section';
    return mod.replace('rpt_', 'Report: ').replace('hr_', 'HR: ').replace('_', ' ').toUpperCase();
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-6 sm:p-8 shadow-xl text-center space-y-5 animate-fade-in">
        
        {/* Icon Header */}
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 shadow-inner">
          <ShieldAlert className="h-8 w-8" />
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            {reason === 'MISSING_SCOPE'
              ? 'No Department/Section Assigned'
              : 'Access Denied — Restricted Area'}
          </h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {reason === 'MISSING_SCOPE'
              ? 'Your account profile does not have an assigned factory department or operational scope.'
              : `You do not have authorization to view or operate the ${getModuleLabel(attemptedModule)} module.`}
          </p>
        </div>

        {/* User Scope Box */}
        {currentUser && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-bold text-slate-700">Authenticated Account:</span>
              <span className="font-semibold text-slate-900">{currentUser.name}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-slate-600">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Role</span>
                <span className="font-semibold text-slate-800">{currentUser.role}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Department</span>
                <span className="font-semibold text-slate-800">{currentUser.department || 'None'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Section / Line</span>
                <span className="font-semibold text-slate-800">
                  {currentUser.section || currentUser.line_no || 'General'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Account Status</span>
                <span className="font-semibold text-emerald-600">{currentUser.status}</span>
              </div>
            </div>
          </div>
        )}

        {/* Resolution instructions */}
        <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-center gap-2 text-left">
          <Lock className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <span>
            If you require access to this section, please contact your <strong>HR Manager</strong> or <strong>Super Admin</strong> to update your profile permissions.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setActiveModule('dashboard')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-500 transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to My Authorized Dashboard</span>
          </button>

          <button
            onClick={() => logout()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
            <span>Sign Out & Switch Account</span>
          </button>
        </div>

      </div>
    </div>
  );
};
