import React, { useRef, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Printer, Download, X, Check, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Format an order ID into a professional receipt number.
 * e.g. orderId=89, timestamp=1728043500000 → "ORD-20261004-0089"
 */
const formatOrderNumber = (orderId, timestamp) => {
  const d = new Date(timestamp);
  const dateStr = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ].join('');
  return `ORD-${dateStr}-${String(orderId).padStart(4, '0')}`;
};

/**
 * Format a timestamp into a human-readable date/time line.
 * e.g. "Oct 04, 2026 | 11:15 AM"
 */
const formatDateTime = (timestamp) => {
  const d = new Date(timestamp);
  const dateOpts = { year: 'numeric', month: 'short', day: '2-digit' };
  const timeOpts = { hour: '2-digit', minute: '2-digit', hour12: true };
  return `${d.toLocaleDateString('en-US', dateOpts)} | ${d.toLocaleTimeString('en-US', timeOpts)}`;
};

/**
 * The thermal receipt content rendered inside the preview.
 * This is the EXACT same markup that gets printed and captured for PDF.
 */
const ReceiptContent = React.forwardRef(({ order, isVoided, cashierName, settings }, ref) => {
  const currency = settings?.currency || '₱';
  const cafeName = settings?.cafeName || 'Aster POS';
  const receiptFooter = settings?.receiptFooter || 'Thank you for visiting! Please come again.';
  const storeAddress = settings?.storeAddress || '';
  const storeContact = settings?.storeContact || '';
  const storeTIN = settings?.storeTIN || '';

  const orderNumber = formatOrderNumber(order.id, order.timestamp);
  const dateTime = formatDateTime(order.timestamp);

  const subtotal = order.subtotal ?? order.total;
  const discountAmt = order.discountAmount || 0;
  const amountTendered = order.amountTendered || 0;
  const changeDue = order.changeDue || 0;

  const divider = '────────────────────────────────';

  return (
    <div ref={ref} id="thermal-receipt" style={{
      width: '302px', /* ≈ 80mm at 96dpi */
      fontFamily: "'Courier New', 'Courier', monospace",
      fontSize: '12px',
      lineHeight: '1.4',
      color: '#000',
      background: '#fff',
      padding: '16px 12px',
      boxSizing: 'border-box',
    }}>
      {/* === HEADER === */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        {settings?.logoDataUrl && (
          <img
            src={settings.logoDataUrl}
            alt="Store Logo"
            style={{ maxHeight: '48px', maxWidth: '180px', margin: '0 auto 6px', display: 'block', objectFit: 'contain' }}
          />
        )}
        <div style={{ fontSize: '16px', fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '2px' }}>
          {cafeName}
        </div>
        <div style={{ fontSize: '9px', opacity: 0.55, marginBottom: '4px', letterSpacing: '0.3px' }}>
          Powered by Aster POS
        </div>
        {storeAddress && <div style={{ fontSize: '10px', opacity: 0.7 }}>{storeAddress}</div>}
        {storeContact && <div style={{ fontSize: '10px', opacity: 0.7 }}>{storeContact}</div>}
        {storeTIN && <div style={{ fontSize: '10px', opacity: 0.7 }}>TIN: {storeTIN}</div>}
        <div style={{ fontSize: '10px', opacity: 0.3, margin: '6px 0 0' }}>{divider}</div>
      </div>

      {/* === VOIDED BANNER === */}
      {isVoided && (
        <div style={{
          textAlign: 'center', fontWeight: 'bold', fontSize: '14px',
          border: '2px solid #000', padding: '4px 0', margin: '0 0 6px',
          letterSpacing: '2px'
        }}>
          ★ VOIDED ★
        </div>
      )}

      {/* === TRANSACTION METADATA === */}
      <div style={{ marginBottom: '6px', fontSize: '11px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 'bold' }}>Receipt #</span>
          <span>{orderNumber}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Date/Time</span>
          <span>{dateTime}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Cashier</span>
          <span>{cashierName}</span>
        </div>
        {order.orderType && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Type</span>
            <span>{order.orderType}{order.tableNumber ? ` #${order.tableNumber}` : ''}</span>
          </div>
        )}
        <div style={{ fontSize: '10px', opacity: 0.3, margin: '4px 0' }}>{divider}</div>
      </div>

      {/* === ITEMIZED TABLE === */}
      <div style={{ marginBottom: '4px' }}>
        {/* Column Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontWeight: 'bold', fontSize: '11px',
          borderBottom: '1px dashed #999', paddingBottom: '3px', marginBottom: '4px'
        }}>
          <span style={{ flex: 1 }}>Item</span>
          <span style={{ width: '28px', textAlign: 'center' }}>Qty</span>
          <span style={{ width: '55px', textAlign: 'right' }}>Price</span>
          <span style={{ width: '60px', textAlign: 'right' }}>Subtotal</span>
        </div>
        {/* Line Items */}
        {order.items?.map((item, idx) => {
          const name = item.productName || `Item #${item.productId}`;
          const price = item.price || 0;
          const lineTotal = price * item.quantity;
          return (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px', alignItems: 'flex-start' }}>
              <span style={{ flex: 1, paddingRight: '4px', wordBreak: 'break-word' }}>{name}</span>
              <span style={{ width: '28px', textAlign: 'center', flexShrink: 0 }}>{item.quantity}</span>
              <span style={{ width: '55px', textAlign: 'right', flexShrink: 0 }}>{currency}{price.toFixed(2)}</span>
              <span style={{ width: '60px', textAlign: 'right', flexShrink: 0 }}>{currency}{lineTotal.toFixed(2)}</span>
            </div>
          );
        })}
        <div style={{ fontSize: '10px', opacity: 0.3, margin: '6px 0 4px' }}>{divider}</div>
      </div>

      {/* === FINANCIAL SUMMARY === */}
      <div style={{ marginBottom: '6px', fontSize: '11px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Subtotal</span>
          <span>{currency}{subtotal.toFixed(2)}</span>
        </div>
        {discountAmt > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Discount ({order.discountType || 'Promo'})</span>
            <span>-{currency}{discountAmt.toFixed(2)}</span>
          </div>
        )}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontWeight: 'bold', fontSize: '15px',
          borderTop: '2px solid #000', marginTop: '6px', paddingTop: '6px'
        }}>
          <span>TOTAL</span>
          <span>{currency}{order.total.toFixed(2)}</span>
        </div>
      </div>

      {/* === PAYMENT INFO === */}
      <div style={{ fontSize: '11px', marginBottom: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Payment</span>
          <span style={{ fontWeight: 'bold' }}>{order.paymentMethod || 'Cash'}</span>
        </div>
        {order.paymentMethod === 'Cash' && amountTendered > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Tendered</span>
              <span>{currency}{amountTendered.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>Change</span>
              <span>{currency}{changeDue.toFixed(2)}</span>
            </div>
          </>
        )}
        {order.paymentRef && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Ref #</span>
            <span>{order.paymentRef}</span>
          </div>
        )}
        {order.loyaltyNumber && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Loyalty #</span>
            <span>{order.loyaltyNumber}</span>
          </div>
        )}
        <div style={{ fontSize: '10px', opacity: 0.3, margin: '6px 0 0' }}>{divider}</div>
      </div>

      {/* === FOOTER === */}
      <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '11px' }}>
        <div style={{ marginBottom: '6px', fontStyle: 'italic', opacity: 0.7 }}>
          {receiptFooter}
        </div>
        {/* Receipt barcode representation via order number */}
        <div style={{
          fontFamily: "'Courier New', monospace",
          fontSize: '18px',
          letterSpacing: '3px',
          fontWeight: 'bold',
          margin: '6px auto',
          padding: '4px 0'
        }}>
          {`|||${String(order.id).padStart(6, '0')}|||`}
        </div>
        <div style={{ fontSize: '9px', opacity: 0.45, marginTop: '2px' }}>
          {orderNumber}
        </div>
      </div>
    </div>
  );
});

ReceiptContent.displayName = 'ReceiptContent';

/**
 * ReceiptPrinter — Interactive Receipt Preview Modal
 *
 * Props:
 * - order: the order object
 * - isVoided: boolean
 * - onClose: function to dismiss the modal (replaces old onPrintComplete)
 * - cafeName, receiptFooter: legacy props (settings obj preferred)
 */
const ReceiptPrinter = ({ order, isVoided = false, onClose, onPrintComplete, cafeName, receiptFooter }) => {
  const receiptRef = useRef(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [printSuccess, setPrintSuccess] = useState(false);

  const settings = useLiveQuery(() => db.app_settings.get('default'));
  const users = useLiveQuery(() => db.users.toArray());

  // Dismiss handler — supports both new onClose and legacy onPrintComplete
  const handleDismiss = useCallback(() => {
    if (onClose) onClose();
    else if (onPrintComplete) onPrintComplete();
  }, [onClose, onPrintComplete]);

  if (!order || !users || !settings) return null;

  const cashier = users.find(u => u.id === order.cashierId) || { name: 'Staff' };

  // Merge legacy props into settings object
  const mergedSettings = {
    ...settings,
    cafeName: settings?.cafeName || cafeName || 'Aster POS',
    receiptFooter: settings?.receiptFooter || receiptFooter || 'Thank you for visiting! Please come again.'
  };

  const orderNumber = formatOrderNumber(order.id, order.timestamp);

  // === PRINT ===
  const handlePrint = () => {
    window.print();
    setPrintSuccess(true);
    setTimeout(() => setPrintSuccess(false), 2000);
  };

  // === PDF EXPORT ===
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

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [imgWidthMM, imgHeightMM + 4] // 2mm top + 2mm bottom margin
      });

      pdf.addImage(imgData, 'PNG', 0, 2, imgWidthMM, imgHeightMM);

      const timestamp = new Date().toISOString().split('T')[0];
      pdf.save(`Receipt_${orderNumber}_${timestamp}.pdf`);
    } catch (err) {
      // Graceful fallback — log error but don't crash UI
      console.error('PDF generation failed:', err.message);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <>
      {/* ===== MODAL OVERLAY — visible on screen ===== */}
      <div
        className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 print:hidden"
        onClick={handleDismiss}
      >
        <div
          id="pos-receipt-preview"
          className="bg-surface rounded-t-3xl sm:rounded-2xl shadow-2xl border border-border w-full sm:max-w-[420px] overflow-hidden animate-in flex flex-col max-h-[95vh] sm:max-h-[90vh]"
          onClick={e => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-surface-hover flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/15 text-green-500 rounded-xl flex items-center justify-center">
                <Check size={22} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-text-main">
                  {isVoided ? 'Voided Receipt' : 'Sale Complete'}
                </h2>
                <p className="text-[11px] text-text-light font-medium">{orderNumber}</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="w-10 h-10 flex items-center justify-center hover:bg-border rounded-full transition-colors"
            >
              <X size={20} className="text-text-light" />
            </button>
          </div>

          {/* Thermal Receipt Preview */}
          <div className="flex-1 overflow-y-auto bg-[#f0ece4] p-4 sm:p-5 flex justify-center">
            {/* Paper shadow container */}
            <div className="bg-white shadow-[0_4px_24px_rgba(0,0,0,0.12)] rounded-sm" style={{ width: '302px' }}>
              <ReceiptContent
                ref={receiptRef}
                order={order}
                isVoided={isVoided}
                cashierName={cashier.name}
                settings={mergedSettings}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-4 sm:p-5 border-t border-border bg-surface-hover flex gap-2.5 flex-shrink-0 safe-bottom">
            <button
              onClick={handlePrint}
              className={`flex-1 min-h-[48px] rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg ${
                printSuccess
                  ? 'bg-green-500 text-white'
                  : 'bg-primary hover:bg-primary-dark text-white'
              }`}
            >
              {printSuccess ? <><Check size={18} /> Sent!</> : <><Printer size={18} /> Print</>}
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={pdfLoading}
              className="flex-1 min-h-[48px] bg-surface border border-border hover:bg-surface-hover text-text-main rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              {pdfLoading
                ? <><Loader2 size={18} className="animate-spin" /> Generating...</>
                : <><Download size={18} /> Save PDF</>
              }
            </button>

            <button
              onClick={handleDismiss}
              className="min-h-[48px] px-4 bg-surface-hover border border-border hover:bg-border text-text-light rounded-xl font-semibold text-sm flex items-center justify-center gap-1 transition-colors"
            >
              <X size={16} /> Close
            </button>
          </div>
        </div>
      </div>

      {/* ===== PRINT-ONLY MARKUP — hidden on screen, visible only during @media print ===== */}
      <div id="thermal-receipt-print" className="hidden print:block">
        <ReceiptContent
          order={order}
          isVoided={isVoided}
          cashierName={cashier.name}
          settings={mergedSettings}
        />
      </div>
    </>
  );
};

export default ReceiptPrinter;
