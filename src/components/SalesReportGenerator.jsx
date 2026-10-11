import React, { useRef, useState } from 'react';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Download, FileSpreadsheet, X, Loader2, Check } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { downloadOrShareFile } from '../utils/fileDownloader';

const COLORS = ['#92400e', '#d97706', '#f59e0b', '#fbbf24', '#fcd34d', '#10b981'];

export default function SalesReportGenerator({ orders, filter, onComplete }) {
  const reportRef = useRef(null);
  const [status, setStatus] = useState('idle'); // 'idle' | 'pdf' | 'excel' | 'done'

  // Pre-calculate metrics
  const validOrders = (orders || []).filter(o => o.status !== 'voided');
  const totalGross = validOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const transactionCount = validOrders.length;
  const aov = transactionCount ? totalGross / transactionCount : 0;

  // Hourly trend
  const hourlyDataMap = {};
  validOrders.forEach(o => {
    const hr = new Date(o.timestamp).getHours();
    hourlyDataMap[hr] = (hourlyDataMap[hr] || 0) + (o.total || 0);
  });
  const salesTrend = Object.keys(hourlyDataMap).map(hr => ({
    time: `${hr}:00`,
    sales: hourlyDataMap[hr]
  })).sort((a, b) => parseInt(a.time) - parseInt(b.time));

  let peakHour = 'N/A';
  if (salesTrend.length > 0) {
    const peak = salesTrend.reduce((prev, curr) => (prev.sales > curr.sales) ? prev : curr);
    peakHour = peak.time;
  }

  // Category & Product Breakdown
  const catMap = {};
  const productMap = {};
  validOrders.forEach(o => {
    if (o.items) {
      o.items.forEach(item => {
        const cat = item.category || 'Other';
        catMap[cat] = (catMap[cat] || 0) + (item.price * item.quantity || 0);
        const pName = item.productName || `Product #${item.productId}`;
        if (!productMap[pName]) productMap[pName] = { name: pName, category: cat, units: 0, revenue: 0 };
        productMap[pName].units += item.quantity;
        productMap[pName].revenue += (item.price * item.quantity);
      });
    }
  });

  const categoryBreakdown = Object.keys(catMap).map(cat => ({ name: cat, value: catMap[cat] })).filter(c => c.value > 0);
  const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  // Payment Methods
  const paymentMap = {};
  validOrders.forEach(o => {
    const method = o.paymentMethod || 'Cash';
    paymentMap[method] = (paymentMap[method] || 0) + (o.total || 0);
  });
  const paymentSummary = Object.keys(paymentMap).map(m => ({ method: m, amount: paymentMap[m] }));

  // ── Excel Generator ─────────────────────────────────────
  const generateExcel = async () => {
    setStatus('excel');
    try {
      const workbook = new ExcelJS.Workbook();

      // Tab 1: Summary Dashboard
      const dashSheet = workbook.addWorksheet('Summary Dashboard');
      dashSheet.columns = [
        { header: 'Metric', key: 'metric', width: 28 },
        { header: 'Value', key: 'value', width: 20 },
        { header: '', width: 5 },
        { header: 'Payment Method', key: 'pmethod', width: 22 },
        { header: 'Amount (₱)', key: 'pamount', width: 18 }
      ];

      const headerRow = dashSheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92400E' } };

      dashSheet.addRow({ metric: 'Total Gross Revenue', value: totalGross });
      dashSheet.addRow({ metric: 'Total Transactions', value: transactionCount });
      dashSheet.addRow({ metric: 'Average Order Value', value: aov });
      dashSheet.addRow({ metric: 'Peak Sales Hour', value: peakHour });
      dashSheet.addRow([]);

      paymentSummary.forEach((p, i) => {
        dashSheet.getCell(`D${i + 2}`).value = p.method;
        dashSheet.getCell(`E${i + 2}`).value = p.amount;
        dashSheet.getCell(`E${i + 2}`).numFmt = '₱#,##0.00';
      });

      dashSheet.addRow([]);
      const topHeader = dashSheet.addRow({ metric: '— Top Selling Products —', value: '' });
      topHeader.font = { bold: true };

      const colHeader = dashSheet.addRow(['Rank', 'Item Name', 'Category', 'Units Sold', 'Total Revenue (₱)']);
      colHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      colHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92400E' } };

      topProducts.forEach((p, idx) => {
        const row = dashSheet.addRow([idx + 1, p.name, p.category, p.units, p.revenue]);
        row.getCell(5).numFmt = '₱#,##0.00';
      });

      dashSheet.getColumn('value').numFmt = '₱#,##0.00';

      // Tab 2: Transaction Logs
      const logSheet = workbook.addWorksheet('Transaction Logs');
      logSheet.columns = [
        { header: 'Date & Time', key: 'date', width: 22 },
        { header: 'Order #', key: 'id', width: 12 },
        { header: 'Items', key: 'items', width: 45 },
        { header: 'Subtotal (₱)', key: 'subtotal', width: 16 },
        { header: 'Discount (₱)', key: 'discount', width: 16 },
        { header: 'Total (₱)', key: 'total', width: 16 },
        { header: 'Payment', key: 'method', width: 18 },
        { header: 'Ref #', key: 'ref', width: 18 }
      ];

      const logHeader = logSheet.getRow(1);
      logHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      logHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92400E' } };

      validOrders.forEach(o => {
        const itemsStr = (o.items || []).map(i => `${i.quantity}× ${i.productName || 'Product'}`).join(', ');
        const row = logSheet.addRow({
          date: new Date(o.timestamp).toLocaleString('en-PH'),
          id: `#${o.id}`,
          items: itemsStr,
          subtotal: o.subtotal ?? o.total,
          discount: o.discountAmount || 0,
          total: o.total || 0,
          method: o.paymentMethod || 'Cash',
          ref: o.paymentRef || '—'
        });
        row.getCell('subtotal').numFmt = '₱#,##0.00';
        row.getCell('discount').numFmt = '₱#,##0.00';
        row.getCell('total').numFmt = '₱#,##0.00';
      });

      // Auto-total row
      logSheet.addRow([]);
      const totalRow = logSheet.addRow({
        items: 'GRAND TOTAL:',
        total: { formula: `SUM(F2:F${validOrders.length + 1})` }
      });
      totalRow.font = { bold: true };
      totalRow.getCell('total').numFmt = '₱#,##0.00';

      // Save
      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = `Sales_Report_${filter.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      await downloadOrShareFile({
        fileName,
        data: buffer,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        shareTitle: 'Sales Report Excel',
        shareText: `Aster POS Sales Report (${filter})`
      });
      setStatus('done');
      setTimeout(() => { setStatus('idle'); if (onComplete) onComplete(); }, 1500);
    } catch (err) {
      console.error('Excel generation failed:', err);
      setStatus('idle');
    }
  };

  // ── PDF Generator ────────────────────────────────────────
  const generatePDF = async () => {
    setStatus('pdf');
    try {
      // Wait two animation frames so the DOM is fully painted
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const element = reportRef.current;
      if (!element) throw new Error('Report element not found');

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        // Ensure element is scrolled to origin and fully sized
        scrollX: 0,
        scrollY: 0,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Multi-page support if content is taller than one page
      let yOffset = 0;
      while (yOffset < pdfHeight) {
        if (yOffset > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, -yOffset, pdfWidth, pdfHeight);
        yOffset += pageHeight;
      }

      const pdfBlob = pdf.output('blob');
      const fileName = `Sales_Analytics_Report_${filter.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      await downloadOrShareFile({
        fileName,
        data: pdfBlob,
        mimeType: 'application/pdf',
        shareTitle: 'Sales Analytics PDF Report',
        shareText: `Aster POS Sales Analytics Report (${filter})`
      });
      setStatus('done');
      setTimeout(() => { setStatus('idle'); if (onComplete) onComplete(); }, 1500);
    } catch (err) {
      console.error('PDF generation failed:', err);
      setStatus('idle');
    }
  };

  const isLoading = status === 'pdf' || status === 'excel';
  const isDone = status === 'done';

  return (
    <>
      {/* ── Modal UI ── */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-sm overflow-hidden animate-in">
          {/* Header */}
          <div className="p-5 border-b border-border bg-surface-hover flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-text-main text-base">Export Sales Report</h3>
              <p className="text-xs text-text-light mt-0.5">Period: <span className="font-semibold text-text-main">{filter}</span> · {transactionCount} transactions</p>
            </div>
            <button onClick={onComplete} disabled={isLoading} className="w-8 h-8 rounded-full hover:bg-border flex items-center justify-center text-text-light transition-colors disabled:opacity-40">
              <X size={18} />
            </button>
          </div>

          {/* Summary */}
          <div className="px-5 pt-4 grid grid-cols-2 gap-2">
            {[
              ['Gross Revenue', `₱${totalGross.toFixed(2)}`],
              ['Transactions', transactionCount],
              ['Avg Order Value', `₱${aov.toFixed(2)}`],
              ['Peak Hour', peakHour],
            ].map(([label, val]) => (
              <div key={label} className="bg-background rounded-xl p-3 border border-border">
                <p className="text-[10px] text-text-light font-semibold uppercase tracking-wider">{label}</p>
                <p className="text-sm font-bold text-text-main mt-0.5">{val}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="p-5 space-y-2.5 mt-1">
            <button
              onClick={generatePDF}
              disabled={isLoading}
              className="w-full h-12 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-primary/20"
            >
              {status === 'pdf'
                ? <><Loader2 size={18} className="animate-spin" /> Generating PDF...</>
                : isDone
                  ? <><Check size={18} /> Done!</>
                  : <><Download size={18} /> Download PDF Report</>
              }
            </button>
            <button
              onClick={generateExcel}
              disabled={isLoading}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-emerald-500/20"
            >
              {status === 'excel'
                ? <><Loader2 size={18} className="animate-spin" /> Building Excel...</>
                : isDone
                  ? <><Check size={18} /> Done!</>
                  : <><FileSpreadsheet size={18} /> Download Excel (.xlsx)</>
              }
            </button>
            <button
              onClick={onComplete}
              disabled={isLoading}
              className="w-full h-11 bg-surface-hover hover:bg-border border border-border text-text-main rounded-xl font-semibold transition-colors disabled:opacity-50 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* ── Hidden PDF Render Template ──
          Positioned off-screen (not opacity-0 or display:none) so html2canvas can capture it.
          visibility:hidden would also block capture, so we use left:-9999px. ── */}
      <div
        ref={reportRef}
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          width: '900px',
          background: '#fff',
          color: '#000',
          padding: '40px',
          fontFamily: 'system-ui, sans-serif',
          boxSizing: 'border-box',
          zIndex: -1,
        }}
      >
        {/* Report Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '3px solid #92400e', paddingBottom: '16px', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#92400e', margin: '0 0 4px' }}>Sales & Operations Analytics Report</h1>
            <p style={{ color: '#6b7280', margin: 0 }}>Period: {filter} &nbsp;|&nbsp; Generated: {new Date().toLocaleString('en-PH')}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>Aster POS</h2>
          </div>
        </div>

        {/* KPI Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '32px' }}>
          {[
            ['Gross Revenue', `₱${totalGross.toFixed(2)}`],
            ['Transactions', transactionCount],
            ['Avg Order Value', `₱${aov.toFixed(2)}`],
            ['Peak Hour', peakHour],
          ].map(([label, val]) => (
            <div key={label} style={{ background: '#f9fafb', padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <p style={{ fontSize: '11px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>{label}</p>
              <p style={{ fontSize: '22px', fontWeight: 800, color: '#111827', margin: 0 }}>{val}</p>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
          <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontWeight: 700, color: '#111827', marginBottom: '12px', textAlign: 'center' }}>Sales Trend (Hourly)</h3>
            <div style={{ height: '200px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesTrend}>
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <Bar dataKey="sales" fill="#92400e" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontWeight: 700, color: '#111827', marginBottom: '12px', textAlign: 'center' }}>Category Breakdown</h3>
            <div style={{ height: '200px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryBreakdown} cx="50%" cy="50%" outerRadius={70} innerRadius={40} dataKey="value" isAnimationActive={false}>
                    {categoryBreakdown.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Legend verticalAlign="bottom" height={20} wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Tables Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px' }}>
          {/* Top Products */}
          <div>
            <h3 style={{ fontWeight: 700, color: '#111827', marginBottom: '8px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px' }}>Top Best-Selling Products</h3>
            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 700 }}>Rank</th>
                  <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 700 }}>Item Name</th>
                  <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 700 }}>Category</th>
                  <th style={{ textAlign: 'right', padding: '8px 4px', fontWeight: 700 }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '8px 4px', fontWeight: 700 }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '7px 4px', fontWeight: 700, color: '#9ca3af' }}>#{i + 1}</td>
                    <td style={{ padding: '7px 4px', fontWeight: 600 }}>{p.name}</td>
                    <td style={{ padding: '7px 4px', fontSize: '11px', color: '#6b7280' }}>{p.category}</td>
                    <td style={{ padding: '7px 4px', textAlign: 'right' }}>{p.units}</td>
                    <td style={{ padding: '7px 4px', textAlign: 'right', fontWeight: 700 }}>₱{p.revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Payment Summary */}
          <div>
            <h3 style={{ fontWeight: 700, color: '#111827', marginBottom: '8px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px' }}>Payment Methods</h3>
            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 700 }}>Method</th>
                  <th style={{ textAlign: 'right', padding: '8px 4px', fontWeight: 700 }}>Total Collected</th>
                </tr>
              </thead>
              <tbody>
                {paymentSummary.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '7px 4px', fontWeight: 600 }}>{p.method}</td>
                    <td style={{ padding: '7px 4px', textAlign: 'right', fontWeight: 700 }}>₱{p.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '11px', color: '#9ca3af' }}>
          ★ This report was generated automatically by Aster POS. DO NOT tamper with financial records. ★
        </div>
      </div>
    </>
  );
}
