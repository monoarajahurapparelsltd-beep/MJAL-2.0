import React from 'react';
import { History, UserCheck, Clock } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { supabaseDataService } from '../../services/supabaseDataService';
import { Modal } from './Modal';

export const AuditTrailModal: React.FC = () => {
  const { isAuditOpen, setIsAuditOpen } = useERP();
  const auditLogs = supabaseDataService.getAuditLogs();

  if (!isAuditOpen) return null;

  return (
    <Modal
      isOpen={isAuditOpen}
      onClose={() => setIsAuditOpen(false)}
      title="System & Production Audit Trail Log"
      maxWidth="4xl"
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Complete operational audit logs recording all data entries, target modifications, order status shifts, and user authorization updates across MJAL Garments ERP.
        </p>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden max-h-[65vh] overflow-y-auto">
          {auditLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500">
              <History className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm">No audit logs recorded yet.</p>
            </div>
          ) : (
            auditLogs.map(log => (
              <div key={log.id} className="p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                      <UserCheck className="h-4 w-4" />
                    </span>
                    <div>
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{log.user}</span>
                      <span className="ml-2 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        {log.role} • {log.department}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{log.timestamp}</span>
                  </div>
                </div>

                <div className="mt-2 pl-8">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {log.action} <span className="font-normal text-slate-500 dark:text-slate-400">({log.module})</span>
                  </p>
                  {log.newValue && (
                    <div className="mt-1 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-slate-700 dark:text-slate-300 font-mono">
                      {log.previousValue && (
                        <div className="text-rose-600 dark:text-rose-400 line-through mb-0.5">Prev: {log.previousValue}</div>
                      )}
                      <div className="text-emerald-700 dark:text-emerald-400">New: {log.newValue}</div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
};
