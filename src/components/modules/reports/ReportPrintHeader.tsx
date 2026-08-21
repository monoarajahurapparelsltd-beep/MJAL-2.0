import React from 'react';
import { Building2, Calendar, Clock, User, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

interface ReportPrintHeaderProps {
  title: string;
  subtitle?: string;
  department?: string;
  filtersSummary?: string[];
}

export const ReportPrintHeader: React.FC<ReportPrintHeaderProps> = ({
  title,
  subtitle,
  department,
  filtersSummary = []
}) => {
  const { currentUser } = useAuth();
  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-4">
      {/* Factory Official Printable Header */}
      <div className="border-b-2 border-slate-900 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-blue-700 text-white font-black text-xl flex items-center justify-center shadow-sm">
              MJ
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-slate-950 uppercase">
                MONOARA JAHUR APPARELS LTD. (MJAL)
              </h1>
              <p className="text-[11px] font-medium text-slate-600">
                100% Export Oriented Garments Manufacturing Complex • ERP Production Systems
              </p>
              <p className="text-[10px] text-slate-500">
                Plot #14-16, Export Processing Zone, Bangladesh • Quality ISO 9001:2015 Certified
              </p>
            </div>
          </div>

          <div className="text-right text-[11px] space-y-0.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded border border-slate-200 font-bold text-slate-800">
              <Building2 className="h-3.5 w-3.5 text-blue-600" />
              <span>{department ? `${department} Department` : 'Central Management'}</span>
            </div>
            <div className="text-slate-500 font-medium flex items-center justify-end gap-1 mt-1">
              <Calendar className="h-3 w-3" />
              <span>Printed: {currentDate} {currentTime}</span>
            </div>
            <div className="text-slate-500 text-[10px] flex items-center justify-end gap-1">
              <User className="h-3 w-3" />
              <span>By: {currentUser?.name} ({currentUser?.role})</span>
            </div>
          </div>
        </div>

        {/* Report Specific Title */}
        <div className="mt-3 pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-black text-blue-900 uppercase tracking-wide">
              {title}
            </h2>
            {subtitle && <p className="text-[11px] text-slate-600 font-medium">{subtitle}</p>}
          </div>

          {filtersSummary.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="font-bold text-slate-500 uppercase tracking-wider">Applied Filters:</span>
              {filtersSummary.map((f, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded font-semibold text-blue-800"
                >
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const ReportPrintFooter: React.FC = () => {
  return (
    <div className="pt-10 mt-8 border-t border-slate-300">
      <div className="grid grid-cols-4 gap-4 text-center text-xs">
        <div className="space-y-10">
          <div className="border-b border-slate-400 w-3/4 mx-auto"></div>
          <div>
            <p className="font-bold text-slate-800">Prepared By</p>
            <p className="text-[10px] text-slate-500">Data Entry / Line Executive</p>
          </div>
        </div>
        <div className="space-y-10">
          <div className="border-b border-slate-400 w-3/4 mx-auto"></div>
          <div>
            <p className="font-bold text-slate-800">Verified By (QC/Audit)</p>
            <p className="text-[10px] text-slate-500">Quality & Process Audit</p>
          </div>
        </div>
        <div className="space-y-10">
          <div className="border-b border-slate-400 w-3/4 mx-auto"></div>
          <div>
            <p className="font-bold text-slate-800">Department In-Charge</p>
            <p className="text-[10px] text-slate-500">Floor Manager / Head</p>
          </div>
        </div>
        <div className="space-y-10">
          <div className="border-b border-slate-400 w-3/4 mx-auto"></div>
          <div>
            <p className="font-bold text-slate-800">Authorized Signature</p>
            <p className="text-[10px] text-slate-500">General Manager / Director</p>
          </div>
        </div>
      </div>
      <div className="mt-6 text-center text-[10px] text-slate-400">
        This is a computer-generated official production report from Monoara Jahur Apparels Ltd. ERP System.
      </div>
    </div>
  );
};
