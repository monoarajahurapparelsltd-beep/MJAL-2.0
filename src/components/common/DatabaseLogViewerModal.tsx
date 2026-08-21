import React, { useState, useEffect } from 'react';
import { 
  Database, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  RefreshCw, 
  Trash2, 
  Download, 
  Copy, 
  Check, 
  Search, 
  Filter, 
  Terminal,
  Code2,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { Modal } from './Modal';
import { supabaseLogger, DbTransactionRecord, DbLogStatus } from '../../utils/supabaseLogger';

interface DatabaseLogViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialModuleFilter?: string;
}

export const DatabaseLogViewerModal: React.FC<DatabaseLogViewerModalProps> = ({
  isOpen,
  onClose,
  initialModuleFilter
}) => {
  const [logs, setLogs] = useState<DbTransactionRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | DbLogStatus>('ALL');
  const [moduleFilter, setModuleFilter] = useState<string>(initialModuleFilter || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<DbTransactionRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);
  const [expandedPayloads, setExpandedPayloads] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (initialModuleFilter) {
      setModuleFilter(initialModuleFilter);
    }
  }, [initialModuleFilter]);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = supabaseLogger.subscribe(updatedLogs => {
      setLogs([...updatedLogs]);
    });
    return unsub;
  }, [isOpen]);

  const filteredLogs = logs.filter(log => {
    if (statusFilter !== 'ALL' && log.status !== statusFilter) return false;
    if (moduleFilter && !log.module?.toLowerCase().includes(moduleFilter.toLowerCase()) && !log.table.toLowerCase().includes(moduleFilter.toLowerCase())) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTable = log.table.toLowerCase().includes(q);
      const matchOp = log.operation.toLowerCase().includes(q);
      const matchErr = log.error?.message?.toLowerCase().includes(q) || false;
      const matchFix = log.suggestedFix?.toLowerCase().includes(q) || false;
      const matchUser = log.user?.toLowerCase().includes(q) || false;
      const matchPayload = JSON.stringify(log.payload || {}).toLowerCase().includes(q);
      if (!matchTable && !matchOp && !matchErr && !matchFix && !matchUser && !matchPayload) {
        return false;
      }
    }
    return true;
  });

  const errorCount = logs.filter(l => l.status === 'ERROR').length;
  const warnCount = logs.filter(l => l.status === 'WARN').length;
  const successCount = logs.filter(l => l.status === 'SUCCESS').length;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyReport = () => {
    const report = supabaseLogger.exportSummaryText();
    navigator.clipboard.writeText(report);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const handleDownloadJSON = () => {
    const json = supabaseLogger.exportAsJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supabase_db_logs_${new Date().toISOString().substring(0, 19).replace(/[:T]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const togglePayloadExpand = (id: string) => {
    setExpandedPayloads(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Supabase Database Transaction Diagnostics & Audit Logs"
      maxWidth="max-w-5xl"
    >
      <div className="space-y-4">
        {/* Header KPI Strip */}
        <div className="grid grid-cols-4 gap-3">
          <div 
            onClick={() => setStatusFilter('ALL')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              statusFilter === 'ALL' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Transactions</span>
              <Database className="h-4 w-4 opacity-70" />
            </div>
            <p className="text-xl font-black mt-1">{logs.length}</p>
          </div>

          <div 
            onClick={() => setStatusFilter('ERROR')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              statusFilter === 'ERROR' ? 'bg-rose-600 text-white border-rose-600 shadow-sm' : 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider">Errors</span>
              <AlertCircle className="h-4 w-4 opacity-70" />
            </div>
            <p className="text-xl font-black mt-1">{errorCount}</p>
          </div>

          <div 
            onClick={() => setStatusFilter('WARN')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              statusFilter === 'WARN' ? 'bg-amber-600 text-white border-amber-600 shadow-sm' : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider">Warnings</span>
              <AlertTriangle className="h-4 w-4 opacity-70" />
            </div>
            <p className="text-xl font-black mt-1">{warnCount}</p>
          </div>

          <div 
            onClick={() => setStatusFilter('SUCCESS')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              statusFilter === 'SUCCESS' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider">Success</span>
              <CheckCircle2 className="h-4 w-4 opacity-70" />
            </div>
            <p className="text-xl font-black mt-1">{successCount}</p>
          </div>
        </div>

        {/* Filter & Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center gap-2 flex-1 min-w-[260px]">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by table, error, fix, payload, or user..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <select
              value={moduleFilter}
              onChange={e => setModuleFilter(e.target.value)}
              className="py-1.5 px-2.5 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-700"
            >
              <option value="">All Modules / Tables</option>
              <option value="HR & Admin">HR & Admin (Payroll & Allowances)</option>
              <option value="payroll_records">payroll_records</option>
              <option value="employees">employees</option>
              <option value="attendance_records">attendance_records</option>
              <option value="Order Management">Order Management & Styles</option>
              <option value="order_styles">order_styles</option>
              <option value="purchase_orders">purchase_orders</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyReport}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition-colors"
              title="Copy formatted diagnostic report to clipboard"
            >
              {copiedReport ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedReport ? 'Copied' : 'Copy Report'}</span>
            </button>

            <button
              onClick={handleDownloadJSON}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition-colors"
              title="Download raw JSON log export"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export JSON</span>
            </button>

            <button
              onClick={() => supabaseLogger.clearLogs()}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors"
              title="Clear all stored logs"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Logs Stream List */}
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Database className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600">No database transactions recorded matching your filter.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Database mutation logs and errors will automatically appear here live.</p>
            </div>
          ) : (
            filteredLogs.map(log => {
              const isError = log.status === 'ERROR';
              const isWarn = log.status === 'WARN';
              const isSuccess = log.status === 'SUCCESS';
              const isExpanded = expandedPayloads[log.id];

              return (
                <div
                  key={log.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isError 
                      ? 'bg-rose-50/70 border-rose-200' 
                      : isWarn 
                      ? 'bg-amber-50/70 border-amber-200' 
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        isError ? 'bg-rose-600 text-white' : isWarn ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white'
                      }`}>
                        {log.status}
                      </span>

                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800">
                        {log.operation}
                      </span>

                      <span className="text-xs font-bold text-slate-900 font-mono">
                        public.{log.table}
                      </span>

                      {log.module && (
                        <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {log.module}
                        </span>
                      )}

                      {log.durationMs !== undefined && (
                        <span className="text-[10px] font-mono text-slate-400">
                          {log.durationMs}ms
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <button
                        onClick={() => handleCopy(JSON.stringify(log, null, 2), log.id)}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                        title="Copy log entry JSON"
                      >
                        {copiedId === log.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Error Message & Suggested Fix Banner */}
                  {isError && (
                    <div className="mt-2.5 space-y-2">
                      <div className="p-2.5 rounded-lg bg-rose-100/90 text-rose-900 text-xs font-mono font-medium flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                        <div>
                          <p className="font-bold">{log.error?.message}</p>
                          {log.error?.code && <p className="text-[11px] text-rose-700 mt-0.5">PostgreSQL Code: {log.error.code}</p>}
                        </div>
                      </div>

                      {log.suggestedFix && (
                        <div className="p-2.5 rounded-lg bg-amber-100/90 border border-amber-300 text-amber-950 text-xs flex items-start gap-2 font-sans">
                          <Terminal className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
                          <div className="flex-1">
                            <span className="font-bold text-amber-900">Diagnosis & Recommended Fix: </span>
                            <span>{log.suggestedFix}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {isWarn && log.error?.message && (
                    <div className="mt-2 p-2 rounded-lg bg-amber-100/80 text-amber-900 text-xs flex items-center gap-2 font-medium">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                      <span>{log.error.message}</span>
                    </div>
                  )}

                  {/* Payload Toggle */}
                  {log.payload && (
                    <div className="mt-2">
                      <button
                        onClick={() => togglePayloadExpand(log.id)}
                        className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 py-1"
                      >
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        <Code2 className="h-3.5 w-3.5 text-slate-500" />
                        <span>{isExpanded ? 'Hide Payload' : 'View Payload Data'}</span>
                      </button>

                      {isExpanded && (
                        <pre className="mt-1.5 p-2.5 bg-slate-900 text-emerald-400 rounded-lg text-[11px] font-mono overflow-x-auto max-h-40">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200">
          <span>All Supabase transaction mutations are logged in memory and backed up locally.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors"
          >
            Close Diagnostics
          </button>
        </div>
      </div>
    </Modal>
  );
};
