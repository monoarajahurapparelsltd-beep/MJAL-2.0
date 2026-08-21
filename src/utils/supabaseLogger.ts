/**
 * Centralized Supabase Database Transaction & Error Logger
 * 
 * Captures, formats, and stores detailed audit logs for Supabase database transactions,
 * RPC calls, and mutation errors (e.g., HR allowance updates, order allowance syncs,
 * schema mismatches, and column constraint violations).
 */

export type DbOperationType = 'UPSERT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'RPC' | 'SELECT' | 'BATCH';
export type DbLogStatus = 'SUCCESS' | 'ERROR' | 'WARN' | 'INFO';

export interface PostgrestErrorDetail {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
  table?: string;
  schema?: string;
  statusText?: string;
}

export interface DbTransactionRecord {
  id: string;
  timestamp: string;
  operation: DbOperationType;
  table: string;
  status: DbLogStatus;
  module?: string;
  user?: string;
  durationMs?: number;
  payload?: any;
  error?: PostgrestErrorDetail;
  suggestedFix?: string;
}

export interface LogFilterOptions {
  status?: DbLogStatus;
  table?: string;
  module?: string;
  limit?: number;
}

type LogListener = (logs: DbTransactionRecord[]) => void;

class SupabaseLogger {
  private logs: DbTransactionRecord[] = [];
  private readonly maxLogs: number = 250;
  private listeners: Set<LogListener> = new Set();
  private readonly STORAGE_KEY = 'mjal_supabase_db_logs';

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(this.STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            this.logs = parsed.slice(0, this.maxLogs);
          }
        }
      }
    } catch {
      this.logs = [];
    }
  }

  private persistToStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.logs.slice(0, 100)));
      }
    } catch {
      // Ignore quota exceeded or storage blocked
    }
  }

  private notify() {
    const logsCopy = [...this.logs];
    this.listeners.forEach(fn => {
      try {
        fn(logsCopy);
      } catch (err) {
        console.error('SupabaseLogger listener error:', err);
      }
    });
    this.persistToStorage();
  }

  /**
   * Translates PostgreSQL / PostgREST error codes to helpful resolution hints.
   */
  public diagnosePostgresError(error: any, table?: string): { cleanMessage: string; suggestedFix?: string } {
    if (!error) return { cleanMessage: 'Unknown database error' };

    const rawMessage = error.message || (typeof error === 'string' ? error : JSON.stringify(error));
    const code = error.code || '';
    const details = error.details || '';
    const hint = error.hint || '';

    let suggestedFix: string | undefined;

    // Undefined column (e.g. missing allowance_pct, medical_allowance, etc.)
    if (code === '42703' || rawMessage.includes('column') || rawMessage.includes('does not exist')) {
      const match = rawMessage.match(/column "([^"]+)"/i) || details.match(/column "([^"]+)"/i);
      const colName = match ? match[1] : 'field';
      suggestedFix = `Missing column "${colName}" in table "${table || 'public'}". Run the migration: ALTER TABLE public.${table || 'target_table'} ADD COLUMN IF NOT EXISTS ${colName} NUMERIC/TEXT DEFAULT ...;`;
    } 
    // Undefined table
    else if (code === '42P01' || rawMessage.includes('relation') && rawMessage.includes('does not exist')) {
      suggestedFix = `The table "${table || 'unknown'}" does not exist in the Supabase schema. Execute the table creation script in your Supabase SQL Editor.`;
    }
    // Foreign key violation
    else if (code === '23503' || rawMessage.includes('foreign key constraint')) {
      suggestedFix = `Foreign key reference failure. Ensure parent record (e.g. style_id, emp_id, po_id) exists before referencing it.`;
    }
    // Unique violation
    else if (code === '23505' || rawMessage.includes('duplicate key value') || rawMessage.includes('unique constraint')) {
      suggestedFix = `Duplicate key violation. Use upsert with ON CONFLICT or verify that unique identifiers (ID, Emp ID, Style No, PO No) are unique.`;
    }
    // Permission denied / RLS
    else if (code === '42501' || rawMessage.includes('permission denied') || rawMessage.includes('row-level security')) {
      suggestedFix = `Row-Level Security (RLS) or permission denied. Check RLS policies on table "${table}" or run: ALTER TABLE public.${table} DISABLE ROW LEVEL SECURITY; for internal tooling.`;
    }
    // PostgREST Schema Cache mismatch
    else if (code === 'PGRST204' || rawMessage.includes('schema cache')) {
      suggestedFix = `PostgREST schema cache is stale. Reload your Supabase schema cache from the Supabase dashboard or execute: NOTIFY pgrst, 'reload schema';`;
    }
    // Invalid input syntax / type mismatch
    else if (code === '22P02' || rawMessage.includes('invalid input syntax')) {
      suggestedFix = `Data type mismatch (e.g. passing a string to a numeric or UUID field). Validate and cast payload types before sending.`;
    }

    if (hint && !suggestedFix) {
      suggestedFix = `PostgreSQL Hint: ${hint}`;
    }

    return {
      cleanMessage: rawMessage,
      suggestedFix
    };
  }

  /**
   * Log an error from a database mutation or RPC call.
   */
  public logError(
    table: string,
    operation: DbOperationType,
    error: any,
    payload?: any,
    options?: { module?: string; user?: string; durationMs?: number }
  ): DbTransactionRecord {
    const { cleanMessage, suggestedFix } = this.diagnosePostgresError(error, table);

    const errorDetail: PostgrestErrorDetail = {
      message: cleanMessage,
      code: error?.code,
      details: error?.details || null,
      hint: error?.hint || null,
      table,
      statusText: error?.statusText
    };

    const record: DbTransactionRecord = {
      id: `db-err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      operation,
      table,
      status: 'ERROR',
      module: options?.module,
      user: options?.user,
      durationMs: options?.durationMs,
      payload: this.sanitizePayload(payload),
      error: errorDetail,
      suggestedFix
    };

    this.logs.unshift(record);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    // Console output for immediate developer visibility
    console.error(
      `%c[Supabase DB Error] [${operation}] [${table}] ${cleanMessage}`,
      'background: #fee2e2; color: #b91c1c; font-weight: bold; padding: 2px 6px; border-radius: 4px;',
      {
        payload,
        error: errorDetail,
        suggestedFix,
        module: options?.module,
        user: options?.user
      }
    );

    this.notify();
    return record;
  }

  /**
   * Log a successful database transaction.
   */
  public logSuccess(
    table: string,
    operation: DbOperationType,
    payload?: any,
    options?: { module?: string; user?: string; durationMs?: number }
  ): DbTransactionRecord {
    const record: DbTransactionRecord = {
      id: `db-ok-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      operation,
      table,
      status: 'SUCCESS',
      module: options?.module,
      user: options?.user,
      durationMs: options?.durationMs,
      payload: this.sanitizePayload(payload)
    };

    this.logs.unshift(record);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    this.notify();
    return record;
  }

  /**
   * Log a warning (e.g., fallback invoked, missing optional field).
   */
  public logWarning(
    table: string,
    operation: DbOperationType,
    warningMessage: string,
    payload?: any,
    options?: { module?: string; user?: string; suggestedFix?: string }
  ): DbTransactionRecord {
    const record: DbTransactionRecord = {
      id: `db-warn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      operation,
      table,
      status: 'WARN',
      module: options?.module,
      user: options?.user,
      payload: this.sanitizePayload(payload),
      error: { message: warningMessage, table },
      suggestedFix: options?.suggestedFix
    };

    this.logs.unshift(record);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    console.warn(`[Supabase DB Warning] [${operation}] [${table}] ${warningMessage}`, { payload });
    this.notify();
    return record;
  }

  /**
   * Clean/truncate big payloads to prevent local storage bloat while keeping debug keys.
   */
  private sanitizePayload(payload: any): any {
    if (payload === undefined || payload === null) return null;
    try {
      const serialized = JSON.stringify(payload);
      if (serialized.length > 5000) {
        if (Array.isArray(payload)) {
          return payload.slice(0, 5).map(item => this.sanitizePayload(item));
        }
        if (typeof payload === 'object') {
          const shallow: Record<string, any> = {};
          for (const k of Object.keys(payload)) {
            const val = payload[k];
            if (Array.isArray(val)) {
              shallow[k] = `[Array (${val.length} items)]`;
            } else if (typeof val === 'object' && val !== null) {
              shallow[k] = `[Object (${Object.keys(val).length} keys)]`;
            } else {
              shallow[k] = val;
            }
          }
          return shallow;
        }
      }
      return JSON.parse(serialized);
    } catch {
      return String(payload);
    }
  }

  /**
   * Subscribe to live transaction logs.
   */
  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    listener([...this.logs]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get all captured transaction logs with optional filters.
   */
  public getLogs(options?: LogFilterOptions): DbTransactionRecord[] {
    let result = [...this.logs];

    if (options?.status) {
      result = result.filter(l => l.status === options.status);
    }
    if (options?.table) {
      result = result.filter(l => l.table.toLowerCase() === options.table?.toLowerCase());
    }
    if (options?.module) {
      result = result.filter(l => l.module?.toLowerCase().includes(options.module?.toLowerCase() || ''));
    }
    if (options?.limit && options.limit > 0) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  /**
   * Get all failed transactions.
   */
  public getErrors(moduleOrTable?: string): DbTransactionRecord[] {
    return this.getLogs({
      status: 'ERROR',
      module: moduleOrTable,
      table: moduleOrTable
    });
  }

  /**
   * Clear in-memory and persisted transaction logs.
   */
  public clearLogs(): void {
    this.logs = [];
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(this.STORAGE_KEY);
    }
    this.notify();
  }

  /**
   * Export all transaction logs as formatted JSON string.
   */
  public exportAsJSON(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Export summary report as plain text for easy sharing.
   */
  public exportSummaryText(): string {
    const errorCount = this.logs.filter(l => l.status === 'ERROR').length;
    const successCount = this.logs.filter(l => l.status === 'SUCCESS').length;
    const warnCount = this.logs.filter(l => l.status === 'WARN').length;

    let text = `====================================================\n`;
    text += `  MJAL ERP - Supabase DB Transaction Audit Report   \n`;
    text += `====================================================\n`;
    text += `Generated: ${new Date().toLocaleString()}\n`;
    text += `Total Logged Transactions: ${this.logs.length}\n`;
    text += `Success: ${successCount} | Errors: ${errorCount} | Warnings: ${warnCount}\n\n`;

    if (errorCount > 0) {
      text += `--- RECENT ERRORS & DIAGNOSTICS ---\n`;
      this.logs
        .filter(l => l.status === 'ERROR')
        .slice(0, 10)
        .forEach((err, idx) => {
          text += `\n[${idx + 1}] [${err.timestamp}] [${err.operation}] Table: ${err.table}\n`;
          text += `    Module: ${err.module || 'General'}\n`;
          text += `    Message: ${err.error?.message || 'Unknown error'}\n`;
          if (err.error?.code) text += `    PG Code: ${err.error.code}\n`;
          if (err.suggestedFix) text += `    Suggested Fix: ${err.suggestedFix}\n`;
          if (err.payload) text += `    Payload Sample: ${JSON.stringify(err.payload)}\n`;
        });
    }

    return text;
  }
}

export const supabaseLogger = new SupabaseLogger();
