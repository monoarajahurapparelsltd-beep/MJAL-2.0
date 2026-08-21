import React, { useState } from 'react';
import {
  Users,
  Clock,
  Search,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  Building2,
  DollarSign
} from 'lucide-react';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { ReportPrintHeader, ReportPrintFooter } from './ReportPrintHeader';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';

export const HRReport: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [sortField, setSortField] = useState<string>('empName');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const attendanceRecords = supabaseDataService.getAttendance();
  const employees = supabaseDataService.getEmployees();

  // Combine attendance with employee metadata for rich reporting
  const empMap = new Map(employees.map(e => [e.empId, e]));

  const enrichedRecords = attendanceRecords.map(att => {
    const emp = empMap.get(att.empId);
    return {
      id: att.id,
      date: att.date,
      empId: att.empId,
      empName: att.empName || emp?.name || 'Staff Member',
      designation: emp?.designation || 'Operator',
      department: att.department || emp?.department || 'Production',
      section: emp?.section || 'General',
      shift: emp?.shift || 'Day',
      inTime: att.inTime || '-',
      outTime: att.outTime || '-',
      otHours: att.otHours || 0,
      status: att.status || 'Present'
    };
  });

  const departments = Array.from(new Set(enrichedRecords.map(h => h.department).filter(Boolean)));

  const filtered = enrichedRecords.filter(h => {
    const q = (searchQuery || '').trim().toLowerCase();
    const matchSearch =
      !q ||
      (h.empId || '').toLowerCase().includes(q) ||
      (h.empName || '').toLowerCase().includes(q) ||
      (h.designation || '').toLowerCase().includes(q) ||
      (h.section || '').toLowerCase().includes(q);

    const matchDept = selectedDept === 'All' || h.department === selectedDept;
    const matchStatus = selectedStatus === 'All' || h.status === selectedStatus;

    return matchSearch && matchDept && matchStatus;
  });

  const sorted = [...filtered].sort((a, b) => {
    let valA = (a as any)[sortField] ?? '';
    let valB = (b as any)[sortField] ?? '';
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortAsc ? valA - valB : valB - valA;
    }
    return sortAsc
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA));
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // KPIs
  const totalEmployees = enrichedRecords.length;
  const presentCount = enrichedRecords.filter(h => h.status === 'Present' || h.status === 'Late').length;
  const absentCount = enrichedRecords.filter(h => h.status === 'Absent').length;
  const leaveCount = enrichedRecords.filter(h => h.status === 'Leave').length;
  const totalOTHours = enrichedRecords.reduce((sum, h) => sum + (h.otHours || 0), 0);
  const attendanceRate = totalEmployees > 0 ? Math.round((presentCount / totalEmployees) * 100) : 0;

  const exportData = sorted.map(item => ({
    Date: item.date,
    EmployeeID: item.empId,
    Name: item.empName,
    Designation: item.designation,
    Department: item.department,
    Section: item.section,
    Shift: item.shift,
    InTime: item.inTime,
    OutTime: item.outTime,
    OTHours: item.otHours,
    Status: item.status
  }));

  return (
    <div className="space-y-6">
      <ReportPrintHeader
        title="HUMAN RESOURCES & WORKFORCE ATTENDANCE REPORT"
        subtitle="Daily Workforce Strength, Line-Wise Manpower Allocation & Overtime Hours Audit"
        department="Human Resources & Compliance"
        filtersSummary={[
          `Department: ${selectedDept}`,
          `Status: ${selectedStatus}`,
          searchQuery ? `Search: "${searchQuery}"` : ''
        ].filter(Boolean)}
      />

      {/* Control Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Employee, ID, Designation..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-blue-600 w-56"
            />
          </div>

          <select
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
          >
            <option value="All">All Departments ({departments.length})</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
          >
            <option value="All">All Statuses</option>
            <option value="Present">Present</option>
            <option value="Late">Late</option>
            <option value="Absent">Absent</option>
            <option value="Leave">On Leave</option>
          </select>

          {(selectedDept !== 'All' || selectedStatus !== 'All' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedDept('All');
                setSelectedStatus('All');
                setSearchQuery('');
              }}
              className="text-xs font-bold text-rose-600 hover:underline px-2 py-1"
            >
              Reset Filters
            </button>
          )}
        </div>

        <ExportPrintToolbar
          title="HR_Attendance_Report"
          filename="MJAL_HR_Attendance_Report"
          data={exportData}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Workforce</p>
          <h3 className="text-base font-black text-slate-900 mt-1">{totalEmployees} Persons</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Present Today</p>
          <h3 className="text-base font-black text-emerald-900 mt-1">{presentCount} ({attendanceRate}%)</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Absent</p>
          <h3 className="text-base font-black text-rose-900 mt-1">{absentCount} Persons</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Approved Leave</p>
          <h3 className="text-base font-black text-amber-900 mt-1">{leaveCount} Persons</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Total Overtime Hours</p>
          <h3 className="text-base font-black text-indigo-900 mt-1">{totalOTHours} Hours</h3>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
            Attendance Log & Manpower Roster ({sorted.length} Records)
          </h3>
          <span className="text-[11px] font-bold text-slate-500">
            Click column headers to sort
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <th onClick={() => handleSort('date')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Date <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('empId')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Emp ID <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('empName')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Employee Name <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th className="p-3">Designation</th>
                <th onClick={() => handleSort('department')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Department <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th className="p-3">Section / Shift</th>
                <th className="p-3">In Time</th>
                <th className="p-3">Out Time</th>
                <th onClick={() => handleSort('otHours')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">OT Hrs <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 font-medium">
                    No matching attendance records found.
                  </td>
                </tr>
              ) : (
                sorted.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 text-slate-700 whitespace-nowrap">{item.date}</td>
                    <td className="p-3 font-mono font-bold text-slate-800">{item.empId}</td>
                    <td className="p-3 font-bold text-slate-900">{item.empName}</td>
                    <td className="p-3 text-slate-700">{item.designation}</td>
                    <td className="p-3 font-semibold text-slate-800">{item.department}</td>
                    <td className="p-3 text-slate-600">{item.section} ({item.shift})</td>
                    <td className="p-3 font-mono text-slate-700">{item.inTime}</td>
                    <td className="p-3 font-mono text-slate-700">{item.outTime}</td>
                    <td className="p-3 text-right font-bold text-indigo-700">{item.otHours}h</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.status === 'Present' ? 'bg-emerald-100 text-emerald-800' : item.status === 'Late' ? 'bg-amber-100 text-amber-800' : item.status === 'Leave' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {sorted.length > 0 && (
              <tfoot className="bg-slate-100/90 font-black border-t-2 border-slate-300 text-slate-900">
                <tr>
                  <td colSpan={8} className="p-3 uppercase text-slate-700">Total Filtered Strength ({sorted.length} staff):</td>
                  <td className="p-3 text-right text-indigo-900">
                    {sorted.reduce((s, h) => s + (h.otHours || 0), 0)}h
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <ReportPrintFooter />
    </div>
  );
};
