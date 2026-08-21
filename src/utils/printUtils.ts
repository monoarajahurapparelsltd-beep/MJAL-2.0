import { InterDeptTransfer } from '../types';
import { resolveChallanAuthorities, getDepartmentIncharge, getDepartmentManager } from './authorityUtils';

/**
 * Opens a formatted PDF print view window for an Inter-Department Delivery Challan & Gate Pass
 * and automatically triggers browser print dialog.
 */
export function printTransferChallanPDF(transfer: InterDeptTransfer) {
  const printWindow = window.open('', '_blank', 'width=950,height=850');
  if (!printWindow) {
    alert('Please allow popup windows in your browser to view and print the delivery challan PDF.');
    return;
  }

  const isReturn = transfer.transferType === 'Return';
  const docTitle = isReturn ? 'PRODUCT RETURN CHALLAN' : 'INTER-DEPARTMENT DELIVERY CHALLAN & GATE PASS';
  const themeColor = isReturn ? '#dc2626' : '#2563eb';
  const badgeBg = isReturn ? '#991b1b' : '#0f172a';

  const auth = resolveChallanAuthorities(transfer.fromDepartment, transfer.toDepartment, transfer.transferType);
  const senderIncharge = transfer.senderName && transfer.senderName !== 'Department In-charge'
    ? { name: transfer.senderName, designation: getDepartmentIncharge(transfer.fromDepartment).designation }
    : auth.senderIncharge;
  const receiverIncharge = transfer.receiverName && transfer.receiverName !== 'Pending Receiver'
    ? { name: transfer.receiverName, designation: getDepartmentIncharge(transfer.toDepartment).designation }
    : auth.receiverIncharge;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${isReturn ? 'Return_Challan_' : 'Delivery_Challan_'}${transfer.challanNo}</title>
  <style>
    @media print {
      @page { size: A4 landscape; margin: 8mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      font-size: 11px;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 16px 20px;
    }
    .print-container {
      max-width: 900px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .company-title {
      font-size: 20px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -0.5px;
      color: #0f172a;
      margin: 0 0 2px 0;
    }
    .company-sub {
      font-size: 10.5px;
      color: #475569;
      margin: 0 0 6px 0;
    }
    .challan-badge {
      display: inline-block;
      background: ${badgeBg};
      color: #ffffff;
      font-weight: 800;
      font-size: 10.5px;
      padding: 4px 14px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 10px 14px;
      border-radius: 6px;
      margin-bottom: 12px;
    }
    .meta-item label {
      display: block;
      font-size: 8.5px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .meta-item span {
      font-size: 11.5px;
      font-weight: 800;
      color: #0f172a;
    }
    .meta-item .highlight {
      color: ${themeColor};
      font-family: monospace;
      font-size: 12.5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 800;
      font-size: 9.5px;
      text-transform: uppercase;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      text-align: left;
    }
    td {
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      font-size: 10.5px;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }
    .font-black { font-weight: 900; }
    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 16px;
    }
    .detail-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 8px 10px;
      border-radius: 6px;
    }
    .detail-card-title {
      font-size: 9.5px;
      font-weight: 800;
      color: #475569;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .detail-card-body {
      font-size: 10.5px;
      color: #0f172a;
    }
    .signature-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
      margin-top: 20px;
      text-align: center;
    }
    .sig-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 4px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 90px;
    }
    .sig-box.auth-box {
      border: 1.5px solid #0f172a;
      background: #fefce8;
      box-shadow: inset 0 0 0 1px #ca8a04;
    }
    .sig-line {
      border-top: 1px dashed #94a3b8;
      margin-top: auto;
      padding-top: 4px;
      margin-bottom: 3px;
    }
    .sig-box.auth-box .sig-line {
      border-top: 1.5px solid #0f172a;
    }
    .sig-name {
      font-weight: 900;
      font-size: 10px;
      color: #0f172a;
      line-height: 1.2;
    }
    .sig-title {
      font-size: 8.5px;
      color: #64748b;
      font-weight: 700;
      margin-top: 2px;
      line-height: 1.2;
    }
    .auth-badge {
      display: inline-block;
      font-size: 7.5px;
      font-weight: 900;
      color: #b91c1c;
      border: 1px solid #b91c1c;
      background: #fff;
      padding: 1px 4px;
      border-radius: 2px;
      text-transform: uppercase;
      margin-bottom: 4px;
      letter-spacing: 0.5px;
    }
    .toolbar {
      position: fixed;
      top: 12px;
      right: 12px;
      display: flex;
      gap: 8px;
      z-index: 1000;
    }
    .btn {
      padding: 8px 16px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 6px;
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .btn:hover { background: #1d4ed8; }
    .btn-secondary { background: #64748b; }
    .btn-secondary:hover { background: #475569; }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button class="btn" onclick="window.print()">🖨️ Open PDF / Print Challan</button>
    <button class="btn btn-secondary" onclick="window.close()">✕ Close</button>
  </div>

  <div class="print-container">
    <div class="header">
      <h1 class="company-title">MONOARA JAHUR APPARELS LTD.</h1>
      <p class="company-sub">Samair, Birulia, Savar, Dhaka-1340 | Ready-Made Garments Manufacturer & Exporter</p>
      <div class="challan-badge">${docTitle}</div>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <label>${isReturn ? 'Return Challan No' : 'Challan No'}</label>
        <span class="highlight">${transfer.challanNo}</span>
      </div>
      <div class="meta-item">
        <label>Date</label>
        <span>${transfer.transferDate}</span>
      </div>
      <div class="meta-item">
        <label>From Section</label>
        <span style="color: #0f172a; font-weight: 900;">${transfer.fromDepartment}</span>
      </div>
      <div class="meta-item">
        <label>Destination Section</label>
        <span style="color: ${themeColor}; font-weight: 900;">${transfer.toDepartment}</span>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Buyer</th>
          <th>Style No</th>
          <th>PO No</th>
          <th>Colour</th>
          <th>Garment Type</th>
          <th>Size</th>
          <th class="text-center">Bundles</th>
          <th class="text-right">Quantity (Pcs)</th>
        </tr>
      </thead>
      <tbody>
        ${
          transfer.items && transfer.items.length > 0
            ? transfer.items.map((it, idx) => `
              <tr>
                <td style="color: #64748b; font-weight: bold;">${idx + 1}</td>
                <td class="font-bold">${it.buyer || transfer.buyer || 'N/A'}</td>
                <td class="font-black" style="color: ${themeColor}; font-size: 11px;">${it.styleNo}</td>
                <td class="font-bold">${it.poNo}</td>
                <td>${it.colour}</td>
                <td>
                  ${it.garmentType || 'Garment'}
                  <div style="font-size: 8px; color: #64748b;">
                    (${it.isWashGarment ? 'Wash' : 'Non-Wash'})
                  </div>
                </td>
                <td class="font-bold">${it.size || 'All Sizes'}</td>
                <td class="text-center font-bold">${it.bundleCount || '-'}</td>
                <td class="text-right font-black" style="font-size: 11px; color: ${isReturn ? '#dc2626' : '#16a34a'};">${(it.quantity || 0).toLocaleString()} pcs</td>
              </tr>
            `).join('')
            : `
              <tr>
                <td style="color: #64748b; font-weight: bold;">1</td>
                <td class="font-bold">${transfer.buyer || 'N/A'}</td>
                <td class="font-black" style="color: ${themeColor}; font-size: 11.5px;">${transfer.styleNo}</td>
                <td class="font-bold">${transfer.poNo}</td>
                <td>${transfer.colour}</td>
                <td>
                  ${transfer.garmentType || 'Garment'}
                  <div style="font-size: 8.5px; color: #64748b;">
                    (${transfer.isWashGarment ? 'Wash Garment' : 'Non-Wash Direct'})
                  </div>
                </td>
                <td class="font-bold">${transfer.size || 'All Sizes'}</td>
                <td class="text-center font-bold">${transfer.bundleCount || '-'}</td>
                <td class="text-right font-black" style="font-size: 12px; color: ${isReturn ? '#dc2626' : '#16a34a'};">${(transfer.quantity || 0).toLocaleString()} pcs</td>
              </tr>
            `
        }
      </tbody>
      <tfoot>
        <tr style="background: #f8fafc; font-weight: bold;">
          <td colspan="7" class="text-right" style="padding: 8px; font-weight: 900; text-transform: uppercase; font-size: 11px;">
            Total Challan Quantity:
          </td>
          <td class="text-center" style="padding: 8px; font-weight: 900; font-size: 11px;">
            ${
              transfer.items && transfer.items.length > 0
                ? transfer.items.reduce((s, it) => s + (it.bundleCount || 0), 0) || '-'
                : transfer.bundleCount || '-'
            }
          </td>
          <td class="text-right font-black" style="padding: 8px; font-size: 13px; color: ${isReturn ? '#dc2626' : '#16a34a'};">
            ${(transfer.quantity || 0).toLocaleString()} pcs
          </td>
        </tr>
      </tfoot>
    </table>

    <div class="details-grid">
      <div class="detail-card">
        <div class="detail-card-title">Routing & Logistics Details</div>
        <div class="detail-card-body">
          ${transfer.lineNo ? `<div><strong>Sewing Line:</strong> ${transfer.lineNo}</div>` : ''}
          ${transfer.vendorName ? `<div><strong>Washing Plant:</strong> ${transfer.vendorName}</div>` : ''}
          ${transfer.vehicleNo ? `<div><strong>Vehicle No:</strong> ${transfer.vehicleNo}</div>` : ''}
          ${transfer.driverName ? `<div><strong>Driver / Carrier:</strong> ${transfer.driverName}</div>` : ''}
          ${isReturn && transfer.originalChallanNo ? `<div><strong>Ref Original Challan:</strong> ${transfer.originalChallanNo}</div>` : ''}
          ${!transfer.lineNo && !transfer.vendorName && !transfer.vehicleNo ? '<div>Internal Department Product Transfer & Handover</div>' : ''}
        </div>
      </div>
      <div class="detail-card">
        <div class="detail-card-title">${isReturn ? 'Return Reason & Remarks' : 'Special Instructions & Remarks'}</div>
        <div class="detail-card-body">
          ${isReturn && transfer.returnReason ? `<div style="color: #dc2626; font-weight: bold; margin-bottom: 3px;">Reason: ${transfer.returnReason}</div>` : ''}
          <div>${transfer.remarks || (isReturn ? 'Departmental product return for rectification/rework.' : 'Standard inter-department bundle transfer. Checked & Passed QC Inspection.')}</div>
        </div>
      </div>
    </div>

    <!-- Official 6-Tier Department Authority Signatures -->
    <div class="signature-grid">
      <!-- 1. Sender Section Incharge -->
      <div class="sig-box">
        <div style="font-size: 7.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">1. DISPATCHED BY</div>
        <div class="sig-line"></div>
        <div class="sig-name">${senderIncharge.name}</div>
        <div class="sig-title">${senderIncharge.designation}</div>
      </div>

      <!-- 2. Quality Incharge / Quality Assurance -->
      <div class="sig-box">
        <div style="font-size: 7.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">2. QUALITY CHECK</div>
        <div class="sig-line"></div>
        <div class="sig-name">${auth.qualityIncharge.name}</div>
        <div class="sig-title">${auth.qualityIncharge.designation}</div>
      </div>

      <!-- 3. Department / Production Manager -->
      <div class="sig-box">
        <div style="font-size: 7.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">3. DEPT. MANAGER</div>
        <div class="sig-line"></div>
        <div class="sig-name">${auth.deptManager.name}</div>
        <div class="sig-title">${auth.deptManager.designation}</div>
      </div>

      <!-- 4. Security Assurance / Gate Pass -->
      <div class="sig-box">
        <div style="font-size: 7.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">4. SECURITY ASSURANCE</div>
        <div class="sig-line"></div>
        <div class="sig-name">${auth.securityAssurance.name}</div>
        <div class="sig-title">${auth.securityAssurance.designation}</div>
      </div>

      <!-- 5. Receiver Section Incharge -->
      <div class="sig-box">
        <div style="font-size: 7.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">5. RECEIVED BY</div>
        <div class="sig-line"></div>
        <div class="sig-name">${receiverIncharge.name}</div>
        <div class="sig-title">${receiverIncharge.designation}</div>
      </div>

      <!-- 6. General Manager / Factory Authorized Sign -->
      <div class="sig-box auth-box">
        <div>
          <div class="auth-badge">★ AUTHORIZED SIGN ★</div>
        </div>
        <div class="sig-line"></div>
        <div class="sig-name">${auth.authorizedBy}</div>
        <div class="sig-title">${auth.authorizedDesignation}</div>
        <div style="font-size: 7.5px; color: #b45309; font-weight: bold; margin-top: 2px;">Date: ${transfer.authorizedDate || transfer.transferDate}</div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Opens a formatted PDF print view window for an External Third-Party Washing Delivery Challan & Outward Gate Pass
 */
export function printThirdPartyWashChallanPDF(wash: {
  challanNo: string;
  date: string;
  vendorName: string;
  vendorAddress?: string;
  washType: string;
  styleNo: string;
  poNo: string;
  colour: string;
  size?: string;
  sentQty: number;
  vehicleNo?: string;
  driverName?: string;
  driverPhone?: string;
  expectedReturnDate?: string;
  authorizedBy?: string;
  remarks?: string;
  processInstructions?: string;
  buyer?: string;
  items?: Array<{ size: string; sentQty: number; receivedQty?: number; damageQty?: number; rejectQty?: number; balanceQty?: number }>;
}) {
  const printWindow = window.open('', '_blank', 'width=950,height=850');
  if (!printWindow) {
    alert('Please allow popup windows in your browser to view and print the outward washing challan PDF.');
    return;
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Washing_Challan_${wash.challanNo}</title>
  <style>
    @media print {
      @page { size: A4 landscape; margin: 8mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      font-size: 11px;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 16px 20px;
    }
    .print-container { max-width: 900px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid #0891b2; padding-bottom: 8px; margin-bottom: 12px; }
    .company-title { font-size: 20px; font-weight: 900; color: #0f172a; margin: 0 0 2px 0; letter-spacing: -0.5px; }
    .company-sub { font-size: 10.5px; color: #475569; margin: 0 0 6px 0; }
    .challan-badge {
      display: inline-block;
      background: #0891b2;
      color: #ffffff;
      font-weight: 800;
      font-size: 10.5px;
      padding: 4px 14px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      background: #f0fdfa;
      border: 1px solid #ccfbf1;
      padding: 10px 14px;
      border-radius: 6px;
      margin-bottom: 12px;
    }
    .meta-item label { display: block; font-size: 8.5px; font-weight: 700; color: #0891b2; text-transform: uppercase; margin-bottom: 2px; }
    .meta-item span { font-size: 11.5px; font-weight: 800; color: #0f172a; }
    .meta-item .highlight { color: #0891b2; font-family: monospace; font-size: 12.5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th { background: #f1f5f9; color: #334155; font-weight: 800; font-size: 9.5px; text-transform: uppercase; padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left; }
    td { padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 10.5px; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }
    .font-black { font-weight: 900; }
    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
    .detail-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 10px; border-radius: 6px; }
    .detail-card-title { font-size: 9.5px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 3px; }
    .detail-card-body { font-size: 10.5px; color: #0f172a; }
    .signature-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 20px; text-align: center; }
    .sig-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 4px; display: flex; flex-direction: column; justify-content: space-between; min-height: 90px; }
    .sig-box.auth-box { border: 1.5px solid #0891b2; background: #ecfeff; }
    .sig-line { border-top: 1px dashed #94a3b8; margin-top: auto; padding-top: 4px; margin-bottom: 3px; }
    .sig-box.auth-box .sig-line { border-top: 1.5px solid #0891b2; }
    .sig-name { font-weight: 900; font-size: 10px; color: #0f172a; line-height: 1.2; }
    .sig-title { font-size: 8.5px; color: #64748b; font-weight: 700; margin-top: 2px; line-height: 1.2; }
    .toolbar { position: fixed; top: 12px; right: 12px; display: flex; gap: 8px; z-index: 1000; }
    .btn { padding: 8px 16px; background: #0891b2; color: white; border: none; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer; }
    .btn:hover { background: #0e7490; }
    .btn-secondary { background: #64748b; }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button class="btn" onclick="window.print()">🖨️ Open PDF / Print Outward Challan</button>
    <button class="btn btn-secondary" onclick="window.close()">✕ Close</button>
  </div>

  <div class="print-container">
    <div class="header">
      <h1 class="company-title">MONOARA JAHUR APPARELS LTD.</h1>
      <p class="company-sub">Samair, Birulia, Savar, Dhaka-1340 | Ready-Made Garments Manufacturer & Exporter</p>
      <div class="challan-badge">THIRD-PARTY OUTWARD WASHING CHALLAN & GATE PASS</div>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <label>Challan / Gate Pass No</label>
        <span class="highlight">${wash.challanNo}</span>
      </div>
      <div class="meta-item">
        <label>Dispatched Date</label>
        <span>${wash.date}</span>
      </div>
      <div class="meta-item">
        <label>Third-Party Wash Plant</label>
        <span style="color: #0891b2; font-weight: 900;">${wash.vendorName}</span>
      </div>
      <div class="meta-item">
        <label>Wash Recipe / Type</label>
        <span style="color: #047857; font-weight: 900;">${wash.washType} Wash</span>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Buyer</th>
          <th>Style No</th>
          <th>PO No</th>
          <th>Colour</th>
          <th>Wash Process</th>
          <th>Size</th>
          <th class="text-right">Outward Qty (Pcs)</th>
          <th>Expected Return</th>
        </tr>
      </thead>
      <tbody>
        ${wash.items && wash.items.length > 0 ? wash.items.map(si => `
          <tr>
            <td class="font-bold">${wash.buyer || 'As per Master PO'}</td>
            <td class="font-black" style="color: #0891b2; font-size: 12px;">${wash.styleNo}</td>
            <td class="font-bold">${wash.poNo}</td>
            <td>${wash.colour}</td>
            <td><strong style="color: #0e7490;">${wash.washType}</strong> (Wet Processing)</td>
            <td class="font-bold" style="color: #0284c7;">${si.size}</td>
            <td class="text-right font-black" style="font-size: 12px; color: #0891b2;">${(si.sentQty || 0).toLocaleString()} pcs</td>
            <td class="font-bold" style="color: #b45309;">${wash.expectedReturnDate || 'Standard Cycle'}</td>
          </tr>
        `).join('') + `
          <tr style="background: #f8fafc; border-top: 2px solid #0891b2;">
            <td colspan="5" class="font-black text-right uppercase" style="color: #0f172a; padding: 8px;">Total Outward Gate Pass:</td>
            <td class="font-black" style="color: #0f172a;">${wash.items.length} Sizes</td>
            <td class="text-right font-black" style="font-size: 13px; color: #0891b2; padding: 8px;">${(wash.sentQty || 0).toLocaleString()} pcs</td>
            <td></td>
          </tr>
        ` : `
          <tr>
            <td class="font-bold">${wash.buyer || 'As per Master PO'}</td>
            <td class="font-black" style="color: #0891b2; font-size: 12px;">${wash.styleNo}</td>
            <td class="font-bold">${wash.poNo}</td>
            <td>${wash.colour}</td>
            <td><strong style="color: #0e7490;">${wash.washType}</strong> (Wet Processing)</td>
            <td class="font-bold">${wash.size || 'All Sizes'}</td>
            <td class="text-right font-black" style="font-size: 13px; color: #0891b2;">${(wash.sentQty || 0).toLocaleString()} pcs</td>
            <td class="font-bold" style="color: #b45309;">${wash.expectedReturnDate || 'Standard Cycle'}</td>
          </tr>
        `}
      </tbody>
    </table>

    <div class="details-grid">
      <div class="detail-card">
        <div class="detail-card-title">Vendor & Transport Gate Pass Details</div>
        <div class="detail-card-body">
          <div><strong>External Washing Plant:</strong> ${wash.vendorName}</div>
          ${wash.vendorAddress ? `<div><strong>Plant Address:</strong> ${wash.vendorAddress}</div>` : ''}
          ${wash.vehicleNo ? `<div><strong>Outward Vehicle No:</strong> ${wash.vehicleNo}</div>` : ''}
          ${wash.driverName ? `<div><strong>Carrier / Driver:</strong> ${wash.driverName} ${wash.driverPhone ? '(' + wash.driverPhone + ')' : ''}</div>` : ''}
        </div>
      </div>
      <div class="detail-card">
        <div class="detail-card-title">Process Recipe & Special Instructions</div>
        <div class="detail-card-body">
          ${wash.processInstructions ? `<div style="color: #0891b2; font-weight: bold; margin-bottom: 2px;">Recipe: ${wash.processInstructions}</div>` : ''}
          <div>${wash.remarks || 'Outward batch for third-party wet processing. Must maintain approved wash shade swatch and GSM limits.'}</div>
        </div>
      </div>
    </div>

    <div class="signature-grid">
      <div class="sig-box">
        <div style="font-size: 7.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">1. PREPARED BY</div>
        <div class="sig-line"></div>
        <div class="sig-name">Wash Coordinator</div>
        <div class="sig-title">Washing Officer</div>
      </div>
      <div class="sig-box">
        <div style="font-size: 7.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">2. QC VERIFIED</div>
        <div class="sig-line"></div>
        <div class="sig-name">Md. Arif Hossain</div>
        <div class="sig-title">Quality Assurance Lead</div>
      </div>
      <div class="sig-box">
        <div style="font-size: 7.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">3. GATE SECURITY OUT</div>
        <div class="sig-line"></div>
        <div class="sig-name">Security In-Charge</div>
        <div class="sig-title">Factory Main Gate</div>
      </div>
      <div class="sig-box auth-box">
        <div style="font-size: 7.5px; font-weight: 900; color: #0891b2; text-transform: uppercase;">4. AUTHORIZED BY</div>
        <div class="sig-line"></div>
        <div class="sig-name">${wash.authorizedBy || 'Md Myeedul Islam'}</div>
        <div class="sig-title">General Manager</div>
      </div>
      <div class="sig-box">
        <div style="font-size: 7.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">5. 3RD-PARTY WASH RECEIVED</div>
        <div class="sig-line"></div>
        <div class="sig-name">Plant Representative</div>
        <div class="sig-title">Seal & Signature</div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Opens a formatted PDF print view window for an Inward Return Delivery Challan & Factory Gate Pass from 3rd-Party Washing
 * Standardized to match the exact same size, dimensions and styling as the Outward Send Challan.
 */
export function printThirdPartyWashReturnChallanPDF(wash: {
  challanNo: string;
  date?: string;
  returnDate?: string;
  vendorName: string;
  vendorAddress?: string;
  washType: string;
  styleNo: string;
  poNo: string;
  colour: string;
  size?: string;
  sentQty: number;
  receivedQty?: number;
  damageQty?: number;
  rejectQty?: number;
  balanceQty?: number;
  vehicleNo?: string;
  driverName?: string;
  driverPhone?: string;
  receivedBy?: string;
  authorizedBy?: string;
  remarks?: string;
  buyer?: string;
  items?: Array<{ size: string; sentQty: number; receivedQty?: number; damageQty?: number; rejectQty?: number; balanceQty?: number }>;
}) {
  const printWindow = window.open('', '_blank', 'width=950,height=850');
  if (!printWindow) {
    alert('Please allow popup windows in your browser to view and print the inward washing return challan PDF.');
    return;
  }

  const recDate = wash.returnDate || wash.date || new Date().toISOString().substring(0, 10);
  const goodQty = wash.receivedQty || 0;
  const defectQty = (wash.damageQty || 0) + (wash.rejectQty || 0);
  const balQty = wash.balanceQty !== undefined ? wash.balanceQty : Math.max(0, wash.sentQty - goodQty - defectQty);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Wash_Inward_Return_${wash.challanNo}</title>
  <style>
    @media print {
      @page { size: A4 landscape; margin: 8mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      font-size: 11px;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 16px 20px;
    }
    .print-container { max-width: 900px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid #059669; padding-bottom: 8px; margin-bottom: 12px; }
    .company-title { font-size: 20px; font-weight: 900; color: #0f172a; margin: 0 0 2px 0; letter-spacing: -0.5px; }
    .company-sub { font-size: 10.5px; color: #475569; margin: 0 0 6px 0; }
    .challan-badge {
      display: inline-block;
      background: #059669;
      color: #ffffff;
      font-weight: 800;
      font-size: 10.5px;
      padding: 4px 14px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      padding: 10px 14px;
      border-radius: 6px;
      margin-bottom: 12px;
    }
    .meta-item label { display: block; font-size: 8.5px; font-weight: 700; color: #059669; text-transform: uppercase; margin-bottom: 2px; }
    .meta-item span { font-size: 11.5px; font-weight: 800; color: #0f172a; }
    .meta-item .highlight { color: #059669; font-family: monospace; font-size: 12.5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th { background: #f1f5f9; color: #334155; font-weight: 800; font-size: 9.5px; text-transform: uppercase; padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left; }
    td { padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 10.5px; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }
    .font-black { font-weight: 900; }
    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
    .detail-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 10px; border-radius: 6px; }
    .detail-card-title { font-size: 9.5px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 3px; }
    .detail-card-body { font-size: 10.5px; color: #0f172a; }
    .signature-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 20px; text-align: center; }
    .sig-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 4px; display: flex; flex-direction: column; justify-content: space-between; min-height: 90px; }
    .sig-box.auth-box { border: 1.5px solid #059669; background: #f0fdf4; }
    .sig-line { border-top: 1px dashed #94a3b8; margin-top: auto; padding-top: 4px; margin-bottom: 3px; }
    .sig-box.auth-box .sig-line { border-top: 1.5px solid #059669; }
    .sig-name { font-weight: 900; font-size: 10px; color: #0f172a; line-height: 1.2; }
    .sig-title { font-size: 8.5px; color: #64748b; font-weight: 700; margin-top: 2px; line-height: 1.2; }
    .toolbar { position: fixed; top: 12px; right: 12px; display: flex; gap: 8px; z-index: 1000; }
    .btn { padding: 8px 16px; background: #059669; color: white; border: none; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer; }
    .btn:hover { background: #047857; }
    .btn-secondary { background: #64748b; }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button class="btn" onclick="window.print()">🖨️ Open PDF / Print Inward Challan</button>
    <button class="btn btn-secondary" onclick="window.close()">✕ Close</button>
  </div>

  <div class="print-container">
    <div class="header">
      <h1 class="company-title">MONOARA JAHUR APPARELS LTD.</h1>
      <p class="company-sub">Samair, Birulia, Savar, Dhaka-1340 | Ready-Made Garments Manufacturer & Exporter</p>
      <div class="challan-badge">THIRD-PARTY INWARD WASHING RETURN CHALLAN & RECEIVING GATE PASS</div>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <label>Ref Challan No</label>
        <span class="highlight">${wash.challanNo}</span>
      </div>
      <div class="meta-item">
        <label>Inward Return Date</label>
        <span>${recDate}</span>
      </div>
      <div class="meta-item">
        <label>Third-Party Wash Plant</label>
        <span style="color: #059669; font-weight: 900;">${wash.vendorName}</span>
      </div>
      <div class="meta-item">
        <label>Wash Recipe Processed</label>
        <span style="color: #047857; font-weight: 900;">${wash.washType} Wash</span>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Buyer</th>
          <th>Style No</th>
          <th>PO No</th>
          <th>Colour</th>
          <th>Size</th>
          <th class="text-right">Sent Qty</th>
          <th class="text-right">Good Received (Pcs)</th>
          <th class="text-right">Damage / Reject</th>
          <th class="text-right">Plant Balance</th>
        </tr>
      </thead>
      <tbody>
        ${wash.items && wash.items.length > 0 ? wash.items.map(si => {
          const siRec = si.receivedQty || 0;
          const siDam = (si.damageQty || 0) + (si.rejectQty || 0);
          const siBal = si.balanceQty !== undefined ? si.balanceQty : Math.max(0, (si.sentQty || 0) - siRec - siDam);
          return `
            <tr>
              <td class="font-bold">${wash.buyer || 'As per Master PO'}</td>
              <td class="font-black" style="color: #059669; font-size: 12px;">${wash.styleNo}</td>
              <td class="font-bold">${wash.poNo}</td>
              <td>${wash.colour}</td>
              <td class="font-bold" style="color: #059669;">${si.size}</td>
              <td class="text-right font-bold" style="color: #64748b;">${(si.sentQty || 0).toLocaleString()} pcs</td>
              <td class="text-right font-black" style="font-size: 12px; color: #059669;">${siRec.toLocaleString()} pcs</td>
              <td class="text-right font-bold" style="color: #e11d48;">${siDam > 0 ? `${siDam.toLocaleString()} pcs` : '-'}</td>
              <td class="text-right font-black" style="color: ${siBal > 0 ? '#b45309' : '#64748b'};">${siBal.toLocaleString()} pcs</td>
            </tr>
          `;
        }).join('') + `
          <tr style="background: #f0fdf4; border-top: 2px solid #059669;">
            <td colspan="4" class="font-black text-right uppercase" style="color: #0f172a; padding: 8px;">Total Inward Received:</td>
            <td class="font-black" style="color: #0f172a;">${wash.items.length} Sizes</td>
            <td class="text-right font-black" style="color: #64748b; padding: 8px;">${(wash.sentQty || 0).toLocaleString()} pcs</td>
            <td class="text-right font-black" style="font-size: 13px; color: #059669; padding: 8px;">${goodQty.toLocaleString()} pcs</td>
            <td class="text-right font-black" style="color: #e11d48; padding: 8px;">${defectQty > 0 ? `${defectQty.toLocaleString()} pcs` : '-'}</td>
            <td class="text-right font-black" style="color: ${balQty > 0 ? '#b45309' : '#059669'}; padding: 8px;">${balQty.toLocaleString()} pcs</td>
          </tr>
        ` : `
          <tr>
            <td class="font-bold">${wash.buyer || 'As per Master PO'}</td>
            <td class="font-black" style="color: #059669; font-size: 12px;">${wash.styleNo}</td>
            <td class="font-bold">${wash.poNo}</td>
            <td>${wash.colour}</td>
            <td class="font-bold">${wash.size || 'All Sizes'}</td>
            <td class="text-right font-bold" style="color: #64748b;">${(wash.sentQty || 0).toLocaleString()} pcs</td>
            <td class="text-right font-black" style="font-size: 13px; color: #059669;">${goodQty.toLocaleString()} pcs</td>
            <td class="text-right font-bold" style="color: #e11d48;">${defectQty > 0 ? `${defectQty.toLocaleString()} pcs` : '-'}</td>
            <td class="text-right font-black" style="color: ${balQty > 0 ? '#b45309' : '#64748b'};">${balQty.toLocaleString()} pcs</td>
          </tr>
        `}
      </tbody>
      <tfoot>
        <tr style="background: #f8fafc; font-weight: bold;">
          <td colspan="6" class="text-right" style="padding: 8px; font-weight: 900; text-transform: uppercase;">
            Total Good Washed Pcs Ready for Finishing:
          </td>
          <td class="text-right font-black" style="padding: 8px; font-size: 13px; color: #059669;">
            ${goodQty.toLocaleString()} pcs
          </td>
          <td colspan="2" class="text-center font-bold" style="font-size: 10px; color: #64748b;">
            ${balQty === 0 ? '✓ Order Lot Completed' : `⚠ ${balQty} pcs remaining at plant`}
          </td>
        </tr>
      </tfoot>
    </table>

    <div class="details-grid">
      <div class="detail-card">
        <div class="detail-card-title">Receiving & Transport Details</div>
        <div class="detail-card-body">
          <div><strong>External Washing Vendor:</strong> ${wash.vendorName}</div>
          ${wash.vendorAddress ? `<div><strong>Plant Location:</strong> ${wash.vendorAddress}</div>` : ''}
          ${wash.vehicleNo ? `<div><strong>Receiving Vehicle No:</strong> ${wash.vehicleNo}</div>` : ''}
          <div><strong>Factory Received By:</strong> ${wash.receivedBy || 'Washing Section In-charge'}</div>
        </div>
      </div>
      <div class="detail-card">
        <div class="detail-card-title">Quality Verification & QC Inspection Notes</div>
        <div class="detail-card-body">
          <div>${wash.remarks || 'Washed goods received back in factory. Checked against approved shade swatch and passed inspection.'}</div>
        </div>
      </div>
    </div>

    <div class="signature-grid">
      <div class="sig-box">
        <div style="font-size: 7.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">1. FACTORY RECEIVED BY</div>
        <div class="sig-line"></div>
        <div class="sig-name">${wash.receivedBy || 'Md. Shahinur Alam'}</div>
        <div class="sig-title">Wash Section In-Charge</div>
      </div>
      <div class="sig-box">
        <div style="font-size: 7.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">2. QC SHADE INSPECTOR</div>
        <div class="sig-line"></div>
        <div class="sig-name">Md. Arif Hossain</div>
        <div class="sig-title">Quality Assurance Lead</div>
      </div>
      <div class="sig-box">
        <div style="font-size: 7.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">3. GATE SECURITY IN</div>
        <div class="sig-line"></div>
        <div class="sig-name">Security In-Charge</div>
        <div class="sig-title">Factory Main Gate</div>
      </div>
      <div class="sig-box auth-box">
        <div style="font-size: 7.5px; font-weight: 900; color: #059669; text-transform: uppercase;">4. AUTHORIZED BY</div>
        <div class="sig-line"></div>
        <div class="sig-name">${wash.authorizedBy || 'Md Myeedul Islam'}</div>
        <div class="sig-title">General Manager</div>
      </div>
      <div class="sig-box">
        <div style="font-size: 7.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">5. 3RD-PARTY CARRIER</div>
        <div class="sig-line"></div>
        <div class="sig-name">${wash.driverName || 'Plant Carrier'}</div>
        <div class="sig-title">Driver / Delivery Rep</div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Opens a formatted PDF print view window for a Commercial Export Invoice & Packing List
 * supporting Multi-Buyer and Multi-Style consignments.
 */
export function printCommercialShipmentPDF(shipment: any, customItems?: any[]) {
  const printWindow = window.open('', '_blank', 'width=950,height=850');
  if (!printWindow) {
    alert('Please allow popup windows in your browser to view and print the Commercial Export Invoice.');
    return;
  }

  const items = (customItems && customItems.length > 0)
    ? customItems
    : (shipment.items && shipment.items.length > 0 ? shipment.items : [{
        buyer: shipment.buyer,
        styleNo: shipment.styleNo,
        poNo: shipment.poNo,
        colour: shipment.colour,
        size: shipment.size || 'All Sizes',
        shippedQty: shipment.shippedQty,
        orderQty: shipment.orderQty,
        cartonCount: shipment.cartonCount,
        balanceQty: shipment.balanceQty
      }]);

  const totalQty = items.reduce((sum: number, it: any) => sum + (it.shippedQty || 0), 0);
  const totalCartons = items.reduce((sum: number, it: any) => sum + (it.cartonCount || Math.ceil((it.shippedQty || 0) / 20) || 1), 0);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Commercial_Invoice_${shipment.invoiceNo || 'Export'}</title>
  <style>
    @media print {
      @page { size: A4 portrait; margin: 10mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      font-size: 11px;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 16px 20px;
    }
    .print-container { max-width: 850px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
    .company-title { font-size: 20px; font-weight: 900; letter-spacing: 0.5px; margin: 0; color: #0f172a; }
    .company-sub { font-size: 10px; color: #475569; margin: 2px 0 0 0; font-weight: 600; }
    .doc-badge {
      display: inline-block;
      margin-top: 6px;
      padding: 4px 16px;
      background: #0f172a;
      color: #ffffff;
      font-weight: 800;
      font-size: 11px;
      letter-spacing: 1px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 12px;
      padding: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
    }
    .meta-item { font-size: 10.5px; }
    .meta-label { font-weight: 700; color: #64748b; text-transform: uppercase; font-size: 9px; }
    .meta-val { font-weight: 800; color: #0f172a; font-size: 11.5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10.5px; }
    th { background: #0f172a; color: #ffffff; padding: 7px 6px; font-weight: 800; text-transform: uppercase; font-size: 9.5px; border: 1px solid #0f172a; }
    td { padding: 6px 6px; border: 1px solid #cbd5e1; vertical-align: middle; }
    tr:nth-child(even) td { background: #f8fafc; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: 700; }
    .font-black { font-weight: 900; }
    .total-row td { background: #e2e8f0 !important; font-weight: 900; font-size: 11.5px; border-top: 2px solid #0f172a; }
    .signatures {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-top: 36px;
      padding-top: 8px;
    }
    .sig-box {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 6px;
      text-align: center;
      background: #ffffff;
    }
    .sig-line { height: 35px; }
    .sig-name { font-weight: 800; font-size: 10px; color: #0f172a; }
    .sig-title { font-size: 9px; color: #64748b; }
  </style>
</head>
<body>
  <div class="print-container">
    <div class="header">
      <h1 class="company-title">MONOARA JAHUR APPARELS LTD.</h1>
      <p class="company-sub">Commercial Logistics & Export Division • 100% Export Oriented Garments Manufacturer</p>
      <div class="doc-badge">COMMERCIAL EXPORT CONSIGNMENT INVOICE & PACKING LIST</div>
    </div>

    <div class="meta-grid">
      <div class="meta-item"><span class="meta-label">Invoice No:</span><div class="meta-val">${shipment.invoiceNo}</div></div>
      <div class="meta-item"><span class="meta-label">Packing List No:</span><div class="meta-val">${shipment.packingListNo}</div></div>
      <div class="meta-item"><span class="meta-label">Export Date:</span><div class="meta-val">${shipment.shipmentDate}</div></div>
      <div class="meta-item"><span class="meta-label">Vessel / Carrier:</span><div class="meta-val">${shipment.vesselOrFlight || 'MSC GULSUN V-204'}</div></div>
      <div class="meta-item"><span class="meta-label">Container No:</span><div class="meta-val">${shipment.containerNo || 'MSCU7829102'}</div></div>
      <div class="meta-item"><span class="meta-label">Status:</span><div class="meta-val" style="color: #059669;">${shipment.status}</div></div>
      <div class="meta-item"><span class="meta-label">Port of Loading:</span><div class="meta-val">${shipment.portOfLoading || 'Chittagong Port, Bangladesh'}</div></div>
      <div class="meta-item"><span class="meta-label">Port of Discharge:</span><div class="meta-val">${shipment.portOfDischarge || 'Global Destination Port'}</div></div>
      <div class="meta-item"><span class="meta-label">Prepared By:</span><div class="meta-val">${shipment.preparedBy || 'Commercial Officer'}</div></div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 30px;">#</th>
          <th>Buyer</th>
          <th>Style No</th>
          <th>PO No</th>
          <th>Colour</th>
          <th>Size</th>
          <th class="text-right">Order Qty</th>
          <th class="text-right">Shipped Qty</th>
          <th class="text-right">Cartons</th>
          <th class="text-right">Balance</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((it: any, idx: number) => `
          <tr>
            <td class="text-center font-bold">${idx + 1}</td>
            <td class="font-bold" style="color: #1e40af;">${it.buyer}</td>
            <td class="font-bold">${it.styleNo}</td>
            <td>${it.poNo}</td>
            <td>${it.colour}</td>
            <td class="text-center">${it.size || 'All Sizes'}</td>
            <td class="text-right">${(it.orderQty || 0).toLocaleString()} pcs</td>
            <td class="text-right font-black" style="color: #047857;">${(it.shippedQty || 0).toLocaleString()} pcs</td>
            <td class="text-right font-bold">${(it.cartonCount || Math.ceil((it.shippedQty || 0) / 20) || 1).toLocaleString()} ctns</td>
            <td class="text-right" style="color: #b45309;">${(it.balanceQty || Math.max(0, (it.orderQty || 0) - (it.shippedQty || 0))).toLocaleString()} pcs</td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="6" class="text-right">TOTAL CONSIGNMENT EXPORT:</td>
          <td class="text-right">${items.reduce((s: number, i: any) => s + (i.orderQty || 0), 0).toLocaleString()} pcs</td>
          <td class="text-right" style="color: #047857;">${totalQty.toLocaleString()} pcs</td>
          <td class="text-right">${totalCartons.toLocaleString()} ctns</td>
          <td class="text-right" style="color: #b45309;">${items.reduce((s: number, i: any) => s + (i.balanceQty || Math.max(0, (i.orderQty || 0) - (i.shippedQty || 0))), 0).toLocaleString()} pcs</td>
        </tr>
      </tfoot>
    </table>

    <div class="signatures">
      <div class="sig-box">
        <div style="font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase;">1. PACKING / FINISHING</div>
        <div class="sig-line"></div>
        <div class="sig-name">Floor In-Charge</div>
        <div class="sig-title">Finishing & Packing</div>
      </div>
      <div class="sig-box">
        <div style="font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase;">2. COMMERCIAL / SHIPMENT</div>
        <div class="sig-line"></div>
        <div class="sig-name">${shipment.preparedBy || 'Shipment Officer'}</div>
        <div class="sig-title">Commercial Executive</div>
      </div>
      <div class="sig-box">
        <div style="font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase;">3. FACTORY CUSTOMS / GATE</div>
        <div class="sig-line"></div>
        <div class="sig-name">Gate Security Officer</div>
        <div class="sig-title">Main Gate Pass</div>
      </div>
      <div class="sig-box">
        <div style="font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase;">4. AUTHORIZED BY</div>
        <div class="sig-line"></div>
        <div class="sig-name">General Manager</div>
        <div class="sig-title">Commercial & Operations</div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}


