import React, { useState, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import {
  ClipboardList, Printer, Check, DollarSign, CreditCard,
  Banknote, User, Save, AlertTriangle, History, X, ArrowDownCircle,
  Search, ChevronDown, ChevronUp, ShieldCheck, Clock, CalendarDays,
  BadgeCheck, BarChart3, Download, Loader2
} from 'lucide-react';
import ManagerOverrideModal from './ManagerOverrideModal';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// ─────────────────────────────────────────────
// X-READ RECEIPT MODAL
// A proper in-app receipt modal, consistent with ReceiptPrinter.
// ─────────────────────────────────────────────
const XReadModal = ({ isOpen, onClose, data }) => {
  const receiptRef = useRef(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [printSuccess, setPrintSuccess] = useState(false);

  if (!isOpen || !data) return null;

  const {
    cashierName, date, clockIn, totalOrders, totalSales,
    cashSales, cashlessSales, openingFloat, totalPayouts, expectedCash, declared, variance
  } = data;

  const divider = '────────────────────────────────';
  const varianceLabel = variance > 0 ? 'OVER' : variance < 0 ? 'SHORT' : 'EXACT';

  const handlePrint = () => {
    window.print();
    setPrintSuccess(true);
    setTimeout(() => setPrintSuccess(false), 2500);
  };

  const handleDownloadPDF = async () => {
    if (!receiptRef.current || pdfLoading) return;
    setPdfLoading(true);
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const imgWidthMM = 80;
      const imgHeightMM = (canvas.height / canvas.width) * imgWidthMM;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [imgWidthMM, imgHeightMM + 4] });
      pdf.addImage(imgData, 'PNG', 0, 2, imgWidthMM, imgHeightMM);
      pdf.save(`X-Read_${cashierName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('X-Read PDF failed:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  // The receipt markup (thermal style)
  const ReceiptBody = React.forwardRef((_, ref) => (
    <div ref={ref} style={{
      width: '302px',
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: '12px',
      lineHeight: '1.5',
      color: '#000',
      background: '#fff',
      padding: '16px 12px',
      boxSizing: 'border-box',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <div style={{ fontSize: '16px', fontWeight: 'bold', letterSpacing: '0.5px' }}>Aster POS</div>
        <div style={{ fontSize: '10px', opacity: 0.5, marginTop: '2px' }}>Powered by Aster POS</div>
        <div style={{ opacity: 0.3, margin: '6px 0' }}>{divider}</div>
        <div style={{ fontSize: '15px', fontWeight: 'bold', letterSpacing: '2px' }}>X-READ REPORT</div>
        <div style={{ opacity: 0.3, margin: '6px 0' }}>{divider}</div>
      </div>

      <div style={{ marginBottom: '8px', fontSize: '11px' }}>
        {[['Cashier', cashierName], ['Date', date], ['Clock-In', clockIn]].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{k}</span><span style={{ fontWeight: 'bold' }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ opacity: 0.3, margin: '6px 0' }}>{divider}</div>
      <div style={{ marginBottom: '8px', fontSize: '11px' }}>
        {[['Total Orders', totalOrders], ['Total Sales', `₱${totalSales.toFixed(2)}`], ['Cash Sales', `₱${cashSales.toFixed(2)}`], ['Cashless Sales', `₱${cashlessSales.toFixed(2)}`]].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{k}</span><span style={{ fontWeight: 'bold' }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ opacity: 0.3, margin: '6px 0' }}>{divider}</div>
      <div style={{ marginBottom: '8px', fontSize: '11px' }}>
        {[['Opening Float', `₱${openingFloat.toFixed(2)}`], ['Cash Payouts', `-₱${totalPayouts.toFixed(2)}`], ['Expected Cash', `₱${expectedCash.toFixed(2)}`], ['Declared Cash', `₱${declared.toFixed(2)}`]].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{k}</span><span style={{ fontWeight: 'bold' }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontWeight: 'bold', fontSize: '14px',
        borderTop: '2px solid #000', marginTop: '6px', paddingTop: '6px'
      }}>
        <span>VARIANCE</span>
        <span>{variance >= 0 ? '+' : ''}₱{variance.toFixed(2)} ({varianceLabel})</span>
      </div>

      <div style={{ opacity: 0.3, margin: '8px 0' }}>{divider}</div>
      <div style={{ textAlign: 'center', fontSize: '10px', opacity: 0.55 }}>— END OF X-READ REPORT —</div>
    </div>
  ));
  ReceiptBody.displayName = 'ReceiptBody';

  return (
    <>
      <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 print:hidden" onClick={onClose}>
        <div className="bg-surface rounded-t-3xl sm:rounded-2xl shadow-2xl border border-border w-full sm:max-w-[420px] overflow-hidden flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-surface-hover flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center"><ClipboardList size={20} /></div>
              <div>
                <h2 className="text-base font-semibold text-text-main">X-Read Report</h2>
                <p className="text-[11px] text-text-light font-medium">{cashierName} · {date}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-border rounded-full transition-colors">
              <X size={20} className="text-text-light" />
            </button>
          </div>

          {/* Receipt Preview */}
          <div className="flex-1 overflow-y-auto bg-[#f0ece4] p-4 flex justify-center">
            <div className="bg-white shadow-[0_4px_24px_rgba(0,0,0,0.12)] rounded-sm" style={{ width: '302px' }}>
              <ReceiptBody ref={receiptRef} />
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-border bg-surface-hover flex gap-2.5 flex-shrink-0">
            <button onClick={handlePrint}
              className={`flex-1 min-h-[48px] rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg ${printSuccess ? 'bg-green-500 text-white' : 'bg-primary hover:bg-primary-dark text-white'}`}>
              {printSuccess ? <><Check size={18} /> Sent!</> : <><Printer size={18} /> Print</>}
            </button>
            <button onClick={handleDownloadPDF} disabled={pdfLoading}
              className="flex-1 min-h-[48px] bg-surface border border-border hover:bg-surface-hover text-text-main rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50">
              {pdfLoading ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : <><Download size={18} /> Save PDF</>}
            </button>
            <button onClick={onClose} className="min-h-[48px] px-4 bg-surface-hover border border-border hover:bg-border text-text-light rounded-xl font-semibold text-sm flex items-center justify-center transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Print-only markup */}
      <div className="hidden print:block">
        <ReceiptBody />
      </div>
    </>
  );
};

// ─────────────────────────────────────────────
// UTILITY: Safe Date Formatter
// Handles: Unix ms timestamps, ISO strings, 'YYYY-MM-DD HH:mm:ss' SQLite strings
// ─────────────────────────────────────────────
const parseTs = (ts) => {
  if (!ts) return null;
  // If it's already a number (Unix ms), use directly
  if (typeof ts === 'number') return new Date(ts);
  // SQLite string: replace space with T so iOS/Android parse it correctly
  if (typeof ts === 'string') {
    const fixed = ts.includes('T') ? ts : ts.replace(' ', 'T');
    const d = new Date(fixed);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const fmtDate = (ts) => {
  const d = parseTs(ts);
  if (!d) return '—';
  return d.toLocaleDateString('en-PH', { month: 'long', day: '2-digit', year: 'numeric' });
};

const fmtTime = (ts) => {
  const d = parseTs(ts);
  if (!d) return '--:--';
  return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const fmtDateTime = (ts) => {
  const d = parseTs(ts);
  if (!d) return '—';
  return d.toLocaleString('en-PH', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
};

const fmtDuration = (startTs, endTs) => {
  const s = parseTs(startTs);
  const e = parseTs(endTs);
  if (!s) return '—';
  const end = e || new Date();
  const diffMs = end - s;
  if (diffMs < 0) return '—';
  const hrs = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  if (hrs === 0) return `${mins} min${mins !== 1 ? 's' : ''}`;
  return `${hrs} hr${hrs !== 1 ? 's' : ''} ${mins} min${mins !== 1 ? 's' : ''}`;
};

// ─────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────
const Toast = ({ message, isVisible, type = 'success' }) => {
  if (!isVisible) return null;
  const bg = type === 'error' ? 'bg-red-500' : 'bg-green-500';
  return (
    <div className={`fixed top-4 right-4 z-[70] ${bg} text-white px-5 py-3 rounded-xl font-semibold text-sm shadow-xl flex items-center gap-2`}>
      {type === 'error' ? <X size={16} /> : <Check size={16} />} {message}
    </div>
  );
};

const ConfirmModal = ({ isOpen, onConfirm, onCancel, totalSales, cashSales, declaredCash, variance }) => {
  if (!isOpen) return null;
  const isShort = variance < 0;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-sm overflow-hidden">
        <div className="p-5 border-b border-border bg-surface-hover">
          <h3 className="font-semibold text-text-main text-lg flex items-center gap-2">
            <Save size={20} className="text-primary" /> Save Shift Closing
          </h3>
          <p className="text-sm text-text-light mt-1 font-medium">Review before saving this shift reconciliation</p>
        </div>
        <div className="p-5 space-y-3">
          {[['Total Sales', totalSales], ['Cash Collected', cashSales], ['Declared Cash', declaredCash]].map(([label, val]) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-text-light font-medium">{label}</span>
              <span className="font-semibold">₱{(val || 0).toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between text-base border-t border-border pt-3 mt-3">
            <span className="font-semibold text-text-main">Variance</span>
            <span className={`font-bold text-lg ${isShort ? 'text-red-500' : 'text-green-500'}`}>
              {isShort ? '−' : '+'}₱{Math.abs(variance).toFixed(2)}
              {isShort ? ' (Short)' : variance === 0 ? ' (Exact)' : ' (Over)'}
            </span>
          </div>
          {isShort && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 mt-2">
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-500 font-medium">Cash drawer is short. This will be logged.</p>
            </div>
          )}
        </div>
        <div className="flex gap-2 p-4 pt-0">
          <button onClick={onCancel} className="flex-1 min-h-[44px] bg-surface-hover hover:bg-border border border-border text-text-main rounded-xl font-semibold text-sm">Cancel</button>
          <button onClick={onConfirm} className="flex-1 min-h-[44px] bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2">
            <Save size={16} /> Save Closing
          </button>
        </div>
      </div>
    </div>
  );
};

// Variance badge for audit view
const VarianceBadge = ({ variance }) => {
  if (variance == null) return <span className="text-xs text-text-light font-medium">N/A</span>;
  if (variance === 0) return <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">BALANCED ₱0.00</span>;
  if (variance < 0) return <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">SHORT −₱{Math.abs(variance).toFixed(2)}</span>;
  return <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">OVER +₱{variance.toFixed(2)}</span>;
};

// ─────────────────────────────────────────────
// MANAGER SHIFT AUDIT CARD
// ─────────────────────────────────────────────
const AuditCard = ({ shift, cashiers, onApprove }) => {
  const [expanded, setExpanded] = useState(false);
  const [managerNote, setManagerNote] = useState(shift.managerNote || '');
  const cashier = cashiers.find(u => u.id === shift.cashierId);
  const isActive = shift.status === 'active';
  const float = shift.openingFloat || 0;
  const cashSales = shift.cashSales || 0;
  const totalPayouts = shift.totalPayouts || 0;
  const expectedCash = float + cashSales - totalPayouts;
  const declared = shift.closingCash || 0;
  const variance = isActive ? null : declared - expectedCash;

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Card Header */}
      <div
        className="p-4 flex items-start justify-between gap-3 cursor-pointer hover:bg-surface-hover transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User size={18} className="text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-text-main text-sm truncate">{cashier?.name || `Cashier #${shift.cashierId}`}</p>
            <p className="text-[11px] text-text-light font-medium">ID: {shift.cashierId} · {fmtDate(shift.clockIn)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${isActive ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-border text-text-light border-border'}`}>
            {isActive ? 'ACTIVE' : 'CLOSED'}
          </span>
          {!isActive && <VarianceBadge variance={variance} />}
          {expanded ? <ChevronUp size={16} className="text-text-light" /> : <ChevronDown size={16} className="text-text-light" />}
        </div>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-border p-4 space-y-4 bg-background">
          {/* Timestamps */}
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Clock-In', fmtTime(shift.clockIn), fmtDate(shift.clockIn)],
              ['Clock-Out', isActive ? 'Still Active' : fmtTime(shift.clockOut), isActive ? '' : fmtDate(shift.clockOut)],
              ['Duration', fmtDuration(shift.clockIn, shift.clockOut), isActive ? 'Ongoing' : 'Total worked'],
            ].map(([label, main, sub]) => (
              <div key={label} className="bg-surface rounded-xl p-3 border border-border">
                <p className="text-[10px] font-medium text-text-light uppercase tracking-wide">{label}</p>
                <p className="text-sm font-semibold text-text-main mt-0.5">{main}</p>
                {sub && <p className="text-[10px] text-text-light font-medium">{sub}</p>}
              </div>
            ))}
          </div>

          {/* Financial Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              ['Opening Float', `₱${float.toFixed(2)}`, 'text-text-main'],
              ['Cash Sales', `₱${cashSales.toFixed(2)}`, 'text-green-500'],
              ['Cashless Sales', `₱${(shift.cashlessSales || 0).toFixed(2)}`, 'text-blue-500'],
              ['Total Gross Sales', `₱${(shift.totalSales || 0).toFixed(2)}`, 'text-text-main'],
              ['Cash Payouts', `−₱${totalPayouts.toFixed(2)}`, 'text-red-500'],
              ['Expected Cash', `₱${expectedCash.toFixed(2)}`, 'text-primary'],
            ].map(([k, v, color]) => (
              <div key={k} className="bg-surface rounded-lg p-2.5 border border-border">
                <p className="text-[10px] font-medium text-text-light uppercase">{k}</p>
                <p className={`text-sm font-bold mt-0.5 ${color}`}>{v}</p>
              </div>
            ))}
          </div>

          {/* Reconciliation */}
          {!isActive && (
            <div className={`rounded-xl p-3 border flex justify-between items-center ${variance < 0 ? 'bg-red-500/5 border-red-500/20' : variance > 0 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-green-500/5 border-green-500/20'}`}>
              <div>
                <p className="text-xs font-medium text-text-light">Declared Physical Cash</p>
                <p className="font-semibold text-text-main text-sm">₱{declared.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-text-light">Discrepancy</p>
                <VarianceBadge variance={variance} />
              </div>
            </div>
          )}

          {/* Manager Sign-Off */}
          {!isActive && !shift.approvedBy && (
            <div className="space-y-2 pt-2 border-t border-border">
              <label className="text-xs font-medium text-text-light uppercase tracking-wide">Manager Audit Note (optional)</label>
              <input
                type="text"
                value={managerNote}
                onChange={e => setManagerNote(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-main text-sm font-regular"
                placeholder="e.g. Discrepancy explained by paid out change..."
              />
              <button
                onClick={() => onApprove(shift.id, managerNote)}
                className="w-full min-h-[44px] bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
              >
                <BadgeCheck size={16} /> Approve & Lock Shift Report
              </button>
            </div>
          )}
          {shift.approvedBy && (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl p-3">
              <BadgeCheck size={16} className="text-green-500" />
              <div>
                <p className="text-xs font-semibold text-green-500">Shift Approved & Locked</p>
                {shift.managerNote && <p className="text-[11px] text-text-light font-medium mt-0.5">"{shift.managerNote}"</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// MANAGER AUDIT DASHBOARD
// ─────────────────────────────────────────────
const ManagerAuditDashboard = ({ currentUser }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('');

  const allShifts = useLiveQuery(() =>
    db.shift_sessions.toArray().then(arr => arr.sort((a, b) => b.clockIn - a.clockIn))
  ) || [];

  const allUsers = useLiveQuery(() => db.users.toArray()) || [];

  const filtered = useMemo(() => {
    return allShifts.filter(s => {
      const cashier = allUsers.find(u => u.id === s.cashierId);
      const name = cashier?.name?.toLowerCase() || '';
      const matchSearch = !searchQuery || name.includes(searchQuery.toLowerCase()) || String(s.cashierId).includes(searchQuery);
      const matchStatus = filterStatus === 'all' || s.status === filterStatus;
      const matchDate = !filterDate || fmtDate(s.clockIn).includes(new Date(filterDate).toLocaleDateString('en-PH', { month: 'long', day: '2-digit', year: 'numeric' }));
      return matchSearch && matchStatus && matchDate;
    });
  }, [allShifts, allUsers, searchQuery, filterStatus, filterDate]);

  const handleApprove = async (shiftId, note) => {
    await db.shift_sessions.update(shiftId, {
      approvedBy: currentUser.id,
      approvedAt: new Date().getTime(),
      managerNote: note
    });
  };

  // Summary stats
  const totalActive = allShifts.filter(s => s.status === 'active').length;
  const totalClosed = allShifts.filter(s => s.status === 'closed').length;
  const totalGross = allShifts.reduce((sum, s) => sum + (s.totalSales || 0), 0);

  return (
    <div className="flex flex-col h-full p-4 sm:p-6 gap-4">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-text-main flex items-center gap-3">
            <ShieldCheck size={28} className="text-primary" /> Shift Audit Center
          </h2>
          <p className="text-text-light font-medium mt-1 text-sm">Review, audit, and approve all cashier shift reports</p>
        </div>
        <div className="flex items-center gap-2 bg-surface border border-border px-3 py-2 rounded-xl shadow-sm">
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
            <User size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-main">{currentUser.name}</p>
            <p className="text-[10px] font-medium text-text-light capitalize">{currentUser.role.replace('_', ' ')}</p>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Active Shifts', value: totalActive, icon: Clock, color: 'text-green-500', bg: 'bg-green-500/10' },
          { label: 'Closed Shifts', value: totalClosed, icon: History, color: 'text-text-main', bg: 'bg-surface-hover' },
          { label: 'Total Gross Sales', value: `₱${totalGross.toFixed(2)}`, icon: BarChart3, color: 'text-primary', bg: 'bg-primary/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-surface border border-border rounded-2xl p-4 shadow-sm">
            <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-2`}>
              <Icon size={18} className={color} />
            </div>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-xs font-medium text-text-light mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light" />
          <input
            type="text"
            placeholder="Search cashier name or ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-surface border border-border rounded-xl text-text-main text-sm font-regular focus:ring-2 focus:ring-primary"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 bg-surface border border-border rounded-xl text-text-main text-sm font-medium"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="closed">Closed Only</option>
        </select>
        <input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          className="px-3 py-2.5 bg-surface border border-border rounded-xl text-text-main text-sm font-medium"
        />
      </div>

      {/* Shift List */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-light opacity-50">
            <ClipboardList size={40} className="mb-2" />
            <p className="font-semibold text-sm">No shifts found</p>
            <p className="text-xs mt-1">Adjust your filters or wait for cashiers to log in</p>
          </div>
        ) : (
          filtered.map(shift => (
            <AuditCard
              key={shift.id}
              shift={shift}
              cashiers={allUsers}
              onApprove={handleApprove}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// CASHIER SHIFT REPORT
// ─────────────────────────────────────────────
const CashierShiftReport = ({ currentUser, activeShift, onShiftClosed }) => {
  const [cashDrawerEnd, setCashDrawerEnd] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [activeView, setActiveView] = useState('current');
  const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutType, setPayoutType] = useState('Safe Drop');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutReason, setPayoutReason] = useState('');
  const [payoutManagerAuth, setPayoutManagerAuth] = useState(false);
  const [showXRead, setShowXRead] = useState(false);

  const orders = useLiveQuery(() =>
    activeShift
      ? db.orders.where('cashierId').equals(currentUser.id).and(o => o.timestamp >= activeShift.clockIn).toArray()
      : []
  , [activeShift]) || [];

  const cashPayouts = useLiveQuery(() =>
    activeShift ? db.cash_payouts.where('shiftId').equals(activeShift.id).toArray() : []
  , [activeShift]) || [];

  const shiftHistory = useLiveQuery(() =>
    db.shift_sessions.where('cashierId').equals(currentUser.id).toArray().then(arr => arr.sort((a, b) => b.clockIn - a.clockIn))
  ) || [];

  const shiftOrders = activeShift ? orders.filter(o => o.status !== 'voided') : [];
  const totalOrders = shiftOrders.length;
  const totalSales = shiftOrders.reduce((sum, o) => sum + o.total, 0);
  const cashSales = shiftOrders.filter(o => o.paymentMethod === 'Cash').reduce((sum, o) => sum + o.total, 0);
  const cashlessSales = totalSales - cashSales;
  const openingFloat = activeShift?.openingFloat || 0;
  const totalPayouts = cashPayouts.reduce((sum, p) => sum + p.amount, 0);
  const expectedCash = openingFloat + cashSales - totalPayouts;
  const declared = parseFloat(cashDrawerEnd) || 0;
  const variance = declared - expectedCash;

  const varianceBg = variance < 0 ? 'bg-red-500/10 border-red-500/30' : variance > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-green-500/10 border-green-500/30';
  const varianceColor = variance < 0 ? 'text-red-500' : variance > 0 ? 'text-amber-500' : 'text-green-500';

  const flash = (message, type = 'success') => {
    setToast({ isVisible: true, message, type });
    setTimeout(() => setToast({ isVisible: false, message: '', type }), 3000);
  };

  const handleSaveShift = () => {
    if (!cashDrawerEnd) { flash('Please enter the drawer cash amount.', 'error'); return; }
    setShowConfirm(true);
  };

  const handleConfirmSave = async () => {
    setShowConfirm(false);
    if (!activeShift) return;
    try {
      await db.shift_sessions.update(activeShift.id, {
        clockOut: new Date().getTime(),
        closingCash: declared,
        status: 'closed',
        totalSales,
        cashSales,
        cashlessSales,
        totalPayouts,
        variance,
        notes: variance < 0 ? 'Cash Short' : variance === 0 ? 'Exact' : 'Cash Over'
      });
      setIsSaved(true);
      flash('Shift closing saved successfully!');
      setTimeout(() => { setIsSaved(false); if (onShiftClosed) onShiftClosed(); }, 2500);
    } catch {
      flash('Failed to save. Please try again.', 'error');
    }
  };

  const handleExecutePayout = async (managerUser) => {
    if (!payoutAmount || !payoutReason) { flash('Amount and reason required', 'error'); return; }
    await db.cash_payouts.add({
      shiftId: activeShift.id,
      managerId: managerUser.id,
      type: payoutType,
      amount: parseFloat(payoutAmount),
      description: payoutReason,
      timestamp: new Date().getTime()
    });
    flash(`${payoutType} recorded successfully.`);
    setShowPayoutModal(false);
    setPayoutAmount('');
    setPayoutReason('');
  };

  const handlePrint = () => {
    setShowXRead(true);
  };

  const xReadData = {
    cashierName: currentUser.name,
    date: fmtDate(activeShift?.clockIn),
    clockIn: fmtTime(activeShift?.clockIn),
    totalOrders,
    totalSales,
    cashSales,
    cashlessSales,
    openingFloat,
    totalPayouts,
    expectedCash,
    declared,
    variance,
  };

  const kpiData = [
    { label: 'Orders', value: totalOrders, icon: ClipboardList, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Total Sales', value: `₱${totalSales.toFixed(2)}`, icon: DollarSign, color: 'text-green-500', bg: 'bg-green-500/10' },
    { label: 'Cash', value: `₱${cashSales.toFixed(2)}`, icon: Banknote, color: 'text-text-main', bg: 'bg-surface-hover' },
    { label: 'Cashless', value: `₱${cashlessSales.toFixed(2)}`, icon: CreditCard, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  ];

  return (
    <div className="flex flex-col h-full p-4 sm:p-6 gap-4 overflow-y-auto">
      <Toast message={toast.message} isVisible={toast.isVisible} type={toast.type} />
      <ConfirmModal isOpen={showConfirm} onConfirm={handleConfirmSave} onCancel={() => setShowConfirm(false)}
        totalSales={totalSales} cashSales={cashSales} declaredCash={declared} variance={variance} />
      <ManagerOverrideModal isOpen={payoutManagerAuth} onClose={() => setPayoutManagerAuth(false)}
        actionName={`${payoutType} (₱${payoutAmount})`}
        onSuccess={(mgr) => { setPayoutManagerAuth(false); handleExecutePayout(mgr); }} />
      <XReadModal isOpen={showXRead} onClose={() => setShowXRead(false)} data={xReadData} />

      {/* Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowPayoutModal(false)}>
          <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-border bg-surface-hover flex justify-between items-center">
              <h3 className="font-semibold text-text-main text-lg">Cash Payout</h3>
              <button onClick={() => setShowPayoutModal(false)}><X size={20} className="text-text-light" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-2">
                {['Safe Drop', 'Petty Cash'].map(t => (
                  <button key={t} onClick={() => setPayoutType(t)}
                    className={`flex-1 py-2 font-semibold text-sm border-2 rounded-lg ${payoutType === t ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-light'}`}>{t}</button>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-text-light uppercase tracking-wider mb-1">Amount Removed</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-medium text-text-light">₱</span>
                  <input type="number" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 border border-border rounded-lg bg-background text-text-main font-semibold" placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-light uppercase tracking-wider mb-1">Description / Reason</label>
                <input type="text" value={payoutReason} onChange={e => setPayoutReason(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-text-main font-regular" placeholder="e.g. Bought ice" />
              </div>
              <button onClick={() => setPayoutManagerAuth(true)} disabled={!payoutAmount || !payoutReason}
                className="w-full min-h-[44px] bg-primary hover:bg-primary-dark disabled:bg-border disabled:text-text-light text-white rounded-xl font-semibold transition-all active:scale-95 shadow">
                Request Manager Auth
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-text-main flex items-center gap-3">
            <ClipboardList size={28} className="text-primary" /> My Daily Shift
          </h2>
          {activeShift && (
            <p className="text-text-light font-medium mt-1 text-sm flex items-center gap-1.5">
              <CalendarDays size={13} /> {fmtDate(activeShift.clockIn)}
              <span className="opacity-40 mx-1">·</span>
              <Clock size={13} /> Clock-in: <span className="font-semibold text-text-main ml-1">{fmtTime(activeShift.clockIn)}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-surface-hover border border-border rounded-xl p-1">
            {['current', 'history'].map(v => (
              <button key={v} onClick={() => setActiveView(v)}
                className={`px-4 h-9 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${activeView === v ? 'bg-surface shadow text-primary' : 'text-text-light hover:text-text-main'}`}>
                {v === 'history' && <History size={13} />}
                {v === 'current' ? 'Current' : 'Past Shifts'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-surface border border-border px-3 py-2 rounded-xl shadow-sm">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center"><User size={16} className="text-primary" /></div>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-text-main">{currentUser.name}</p>
              <p className="text-[10px] font-medium text-text-light">ID: {currentUser.id}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== CURRENT SHIFT VIEW ===== */}
      {activeView === 'current' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
            {kpiData.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-surface rounded-2xl border border-border shadow-sm p-4">
                <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-2`}>
                  <Icon size={18} className={color} />
                </div>
                <p className={`text-xl sm:text-2xl font-bold ${color} mt-1`}>{value}</p>
                <p className="text-xs font-medium text-text-light mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Cash Reconciliation */}
          <div className="bg-surface rounded-2xl border border-border shadow-sm p-5 flex-shrink-0">
            <h3 className="text-lg font-semibold text-text-main mb-1 flex justify-between items-center">
              Cash Drawer Reconciliation
              <button onClick={() => setShowPayoutModal(true)}
                className="text-xs bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-colors">
                <ArrowDownCircle size={14} /> Add Payout
              </button>
            </h3>
            <p className="text-sm font-regular text-text-light mb-4">Enter the physical cash in your drawer.</p>
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Input */}
              <div className="flex-1">
                <label className="block text-xs font-medium text-text-light uppercase tracking-wider mb-2">Drawer Cash Count</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-semibold text-text-light">₱</span>
                  <input type="number" value={cashDrawerEnd} onChange={e => setCashDrawerEnd(e.target.value)}
                    className="w-full pl-10 pr-4 py-4 border-2 border-border rounded-xl focus:border-primary focus:ring-0 bg-background text-text-main text-2xl font-bold transition-colors"
                    placeholder="0.00" inputMode="decimal" />
                </div>
              </div>
              {/* Breakdown */}
              <div className="flex-1 flex flex-col gap-2">
                {[
                  ['Opening Float', `₱${openingFloat.toFixed(2)}`, 'text-text-main'],
                  ['Cash Sales', `+₱${cashSales.toFixed(2)}`, 'text-green-500'],
                  ['Cash Payouts', `−₱${totalPayouts.toFixed(2)}`, 'text-red-500'],
                  ['Expected Cash', `₱${expectedCash.toFixed(2)}`, 'text-primary font-bold'],
                ].map(([label, val, cls]) => (
                  <div key={label} className="flex justify-between items-center p-2.5 bg-background rounded-xl border border-border text-sm">
                    <span className="text-text-light font-medium">{label}</span>
                    <span className={`font-semibold ${cls}`}>{val}</span>
                  </div>
                ))}
                <div className={`flex justify-between items-center p-3 rounded-xl border text-base mt-1 ${varianceBg}`}>
                  <span className="font-semibold text-text-main">Variance (from Expected)</span>
                  <span className={`font-bold ${varianceColor}`}>
                    {variance >= 0 ? '+' : ''}₱{variance.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
            <button onClick={handleSaveShift} disabled={isSaved || !cashDrawerEnd}
              className={`flex-1 h-14 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${isSaved ? 'bg-green-500 text-white' : 'bg-primary hover:bg-primary-dark text-white shadow-primary/30'}`}>
              {isSaved ? <><Check size={22} /> Shift Saved!</> : <><Save size={22} /> Save Shift Closing</>}
            </button>
            <button onClick={handlePrint}
              className={`flex-1 sm:flex-none sm:px-6 h-14 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all active:scale-95 border ${isPrinting ? 'bg-green-500/10 text-green-500 border-green-500/30' : 'bg-surface-hover hover:bg-border text-text-main border-border'}`}>
              {isPrinting ? <><Check size={20} /> Sent to Printer</> : <><Printer size={20} /> Print X-Read</>}
            </button>
          </div>
        </>
      )}

      {/* ===== HISTORY VIEW ===== */}
      {activeView === 'history' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="bg-surface border border-border rounded-2xl overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="p-4 bg-surface-hover border-b border-border">
              <p className="text-sm font-medium text-text-light">Your past shift closing records</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {shiftHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-text-light opacity-50 py-12">
                  <History size={40} className="mb-2" />
                  <p className="font-semibold text-sm">No past shifts saved yet</p>
                  <p className="text-xs mt-1 font-regular">Save your first shift closing on the Current tab</p>
                </div>
              ) : (
                shiftHistory.map(s => {
                  const v = s.variance || 0;
                  const isShort = v < 0;
                  const isOver = v > 0;
                  return (
                    <div key={s.id} className="bg-background border border-border rounded-xl p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-text-main text-sm">{fmtDate(s.clockIn)}</p>
                          <p className="text-[11px] text-text-light font-medium">
                            {fmtTime(s.clockIn)} → {s.clockOut ? fmtTime(s.clockOut) : 'Active'}
                            {s.clockOut && <span className="ml-1 text-text-light opacity-70">· {fmtDuration(s.clockIn, s.clockOut)}</span>}
                          </p>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${isShort ? 'bg-red-500/10 text-red-500 border-red-500/20' : isOver ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'}`}>
                          {s.status === 'closed' ? (s.notes || 'Reconciled') : 'Active'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          ['Total Sales', `₱${(s.totalSales || 0).toFixed(2)}`, ''],
                          ['Cash', `₱${(s.cashSales || 0).toFixed(2)}`, ''],
                          ['Declared', `₱${(s.closingCash || 0).toFixed(2)}`, ''],
                          ['Variance', `${v >= 0 ? '+' : ''}₱${v.toFixed(2)}`, isShort ? 'text-red-500' : isOver ? 'text-amber-500' : 'text-green-500'],
                        ].map(([k, val, cls]) => (
                          <div key={k} className="bg-surface rounded-lg p-2.5 border border-border">
                            <p className="text-[10px] font-medium text-text-light uppercase">{k}</p>
                            <p className={`text-sm font-semibold mt-0.5 ${cls || 'text-text-main'}`}>{val}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// ROOT EXPORT: Role-Gated Entry Point
// ─────────────────────────────────────────────
export default function ShiftReport({ currentUser, activeShift, onShiftClosed }) {
  const isManagerOrAbove = ['manager', 'super_admin'].includes(currentUser?.role);

  if (isManagerOrAbove) {
    return <ManagerAuditDashboard currentUser={currentUser} />;
  }

  return <CashierShiftReport currentUser={currentUser} activeShift={activeShift} onShiftClosed={onShiftClosed} />;
}
