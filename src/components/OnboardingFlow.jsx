import React, { useState, useEffect, useCallback } from 'react';
import {
  X, CheckCircle2, Circle, ArrowRight, ArrowLeft,
  Printer, CreditCard, Scan, Upload, Wallet,
  HelpCircle, ChevronRight, ChevronDown, Sparkles,
  Monitor, Wifi, Zap, Package, MapPin, Star,
  Play, SkipForward, FileText, Check, Shield,
  Settings, BookOpen, LifeBuoy, ExternalLink,
  ClipboardList, BarChart3, Receipt, UtensilsCrossed, Network, Download,
  Filter, LayoutGrid, ShoppingBag, Tag, Crown
} from 'lucide-react';

// ─── Security Note ─────────────────────────────────────────────────────────────
// All user-facing text is rendered via JSX text nodes (React auto-escaping).
// No dangerouslySetInnerHTML is used anywhere in this component.
// CSV import uses client-side FileReader; file content is never sent to a server
// from this UI layer. TODO(security): When wiring real CSV import, validate file
// extension + MIME type server-side, impose a size limit (≤ 5 MB), and strip
// dangerous characters before persisting to the database.
// ─────────────────────────────────────────────────────────────────────────────

const MODULE_TOURS = {
  nav: [
    { id: 'pos', title: 'POS Register', description: 'Process orders, apply discounts, and manage cart items from the main register screen.', icon: Wallet, highlight: 'nav-tab-pos' },
    { id: 'shift', title: 'Shift Management', description: 'Start and end cashier shifts, track opening float, and print closing reports.', icon: ClipboardList, highlight: 'nav-tab-shift' },
    { id: 'dashboard', title: 'Analytics Dashboard', description: 'View daily revenue, top products, and overall store performance in real time.', icon: BarChart3, highlight: 'nav-tab-dashboard', roles: ['manager', 'super_admin'] },
    { id: 'inventory', title: 'Inventory Tracker', description: 'Monitor raw ingredient stock levels and receive low-stock alerts automatically.', icon: Package, highlight: 'nav-tab-inventory' },
    { id: 'sales', title: 'Sales History', description: 'Review past transactions, reprint receipts, or process refunds and voids.', icon: Receipt, highlight: 'nav-tab-sales' },
    { id: 'menu', title: 'Menu Manager', description: 'Add or edit products, set up recipes for inventory deduction, and organize categories.', icon: UtensilsCrossed, highlight: 'nav-tab-menu', roles: ['manager', 'super_admin'] },
    { id: 'network', title: 'Wi-Fi Sync', description: 'Connect multiple POS registers to a manager device without internet access.', icon: Network, highlight: 'nav-tab-network', roles: ['manager', 'super_admin'] },
    { id: 'settings', title: 'Settings & Admin', description: 'Configure taxes, staff accounts, payment QR codes, and hardware devices.', icon: Settings, highlight: 'nav-tab-settings', roles: ['manager', 'super_admin'] },
    { id: 'admin', title: 'Super Admin', description: 'Manage global system settings and master resets.', icon: Shield, highlight: 'nav-tab-admin', roles: ['super_admin'] },
  ],
  pos: [
    { id: 'pos-grid', title: 'Product Grid', description: 'Tap product cards or categories to add drinks/pastries to the current cart.', highlight: 'pos-product-grid', icon: LayoutGrid },
    { id: 'pos-cart', title: 'Cart Drawer', description: 'Review item quantities, apply custom item notes, or adjust unit counts.', highlight: 'pos-cart-panel', icon: ShoppingBag },
    { id: 'pos-discount', title: 'Discount Button', description: 'Apply Senior Citizen, PWD, or promotional discounts here.', highlight: 'pos-discount-btn', icon: Tag },
    { id: 'pos-checkout', title: 'Checkout Button', description: 'Tap Pay to select payment method (Cash, GCash/Maya QR) and compute change.', highlight: 'pos-checkout-btn', icon: CreditCard },
    { id: 'pos-receipt', title: 'Receipt Modal', description: 'Preview styled receipt, trigger Bluetooth/USB printing, or start a new order.', highlight: 'pos-receipt-preview', icon: Receipt },
    { id: 'pos-void', title: 'Item Void Action', description: 'Swipe left on any cart item to initiate a Manager Void. Requires PIN authorization.', highlight: 'pos-cart-panel', icon: Shield, roles: ['manager', 'super_admin'] },
  ],
  network: [
    { id: 'wifi-host', title: 'Host Mode Toggle', description: 'Ensure this device is set as Main Counter POS (Host).', highlight: 'wifi-host-toggle', icon: Monitor },
    { id: 'wifi-ip', title: 'IP & SSID Display', description: 'Verify your connected local Wi-Fi SSID and assigned local IP address.', highlight: 'wifi-ip-display', icon: Wifi },
    { id: 'wifi-qr', title: 'Dynamic Pairing QR Code', description: 'Display this QR code for Manager devices to scan for instant sub-second pairing.', highlight: 'wifi-qr-code', icon: Scan },
    { id: 'wifi-status', title: 'Status Badge', description: 'Monitor connected client devices and WebSocket heartbeat health in real time.', highlight: 'wifi-status-badge', icon: Zap },
    // Client steps
    { id: 'wifi-client', title: 'Client Mode Toggle', description: 'Select Manager Device (Subscriber).', highlight: 'wifi-client-toggle', icon: Monitor },
    { id: 'wifi-scan', title: 'Scan Counter QR', description: 'Tap to open camera scanner and scan the Main Counter QR code to pair instantly.', highlight: 'wifi-scan-btn', icon: Scan },
    { id: 'wifi-ping', title: 'Live Ping Test', description: 'Tap to verify <200ms round-trip socket connection to the Main Counter.', highlight: 'wifi-ping-btn', icon: Zap },
  ],
  inventory: [
    { id: 'inv-template', title: 'Download Template', description: 'Download the official two-tab Excel file (Raw_Inventory and Menu_Products).', highlight: 'inv-template-btn', icon: Download },
    { id: 'inv-import', title: 'Bulk Import', description: 'Upload your completed .xlsx file to perform bulk inventory and recipe updates.', highlight: 'inv-import-btn', icon: Upload },
    { id: 'inv-stage', title: 'Staging & Validation', description: 'Review pre-import checks. Fix missing units or unmapped raw ingredients directly inline.', highlight: 'inv-stage-modal', icon: FileText },
    { id: 'inv-stock', title: 'Stock Level Column', description: 'View real-time raw ingredient counts (deducted automatically upon sales).', highlight: 'inv-stock-col', icon: Package },
    { id: 'inv-export', title: 'Full Export', description: 'Export styled inventory spreadsheets with dark headers and automated currency formatting.', highlight: 'inv-export-btn', icon: Download },
  ],
  dashboard: [
    { id: 'dash-sales', title: 'Real-Time Revenue', description: 'Monitor live daily net sales streamed directly from the Main Counter over Wi-Fi.', highlight: 'dash-sales-card', icon: BarChart3 },
    { id: 'dash-drawer', title: 'Cash Drawer Balance', description: 'Track live cash-in-drawer tallies and shift opening/closing floats.', highlight: 'dash-drawer-card', icon: Wallet },
    { id: 'dash-products', title: 'Top Products Widget', description: 'View best-selling menu items updated dynamically in real time.', highlight: 'dash-top-products', icon: Star },
    { id: 'dash-leaderboard', title: 'Staff Performance', description: 'Monitor cashier shift sales metrics and gamified performance goals.', highlight: 'dash-leaderboard', icon: Crown },
  ],
  menu: [
    { id: 'menu-add', title: 'Add Product', description: 'Create a new product by specifying its name, category, and price.', highlight: 'menu-add-btn', icon: Package },
    { id: 'menu-recipe', title: 'Recipe Configuration', description: 'Link raw ingredients to this product. When a sale is made, these ingredients will be automatically deducted from your inventory.', highlight: 'menu-recipe-section', icon: FileText },
    { id: 'menu-bulk', title: 'Bulk Catalog', description: 'Import or export your entire menu and recipes using a CSV/Excel file.', highlight: 'menu-bulk-btn', icon: Upload },
  ],
  admin: [
    { id: 'audit-filters', title: 'Event Type Filters', description: 'Filter audit streams by Voids, Refunds, Price Overrides, or Cash Drawer Kicks.', highlight: 'audit-filters', icon: Filter },
    { id: 'audit-stream', title: 'Audit Log Stream', description: 'Review timestamped events, active cashier IDs, manager approvers, and mandatory reason tags.', highlight: 'audit-stream', icon: FileText },
    { id: 'audit-pin', title: 'Manager PIN Config', description: 'Update master security PINs for authorization overrides.', highlight: 'audit-pin-config', icon: Shield },
    { id: 'audit-export', title: 'Export Audit Report', description: 'Export complete activity streams to CSV/PDF for internal bookkeeping.', highlight: 'audit-export-btn', icon: Download },
  ]
};

// ── Checklist items ───────────────────────────────────────────────────────────
const CHECKLIST_ITEMS = [
  { id: 'tour',     label: 'Take the guided tour',           icon: Play },
  { id: 'products', label: 'Import or add products',         icon: Package },
  { id: 'payment',  label: 'Set up payment methods',         icon: CreditCard },
  { id: 'branding', label: 'Add store name & logo (Super Admin)', icon: Star, roles: ['super_admin'] },
  { id: 'staff',    label: 'Create staff accounts (Manager+)', icon: Shield, roles: ['manager', 'super_admin'] },
];

// ── FAQ entries for Help Drawer ───────────────────────────────────────────────
const FAQS = [
  { q: 'How do I add a new product?', a: 'Go to Menu Manager → tap "Add Product", fill in name, price, and category, then save.' },
  { q: 'How do I print a receipt?', a: 'After completing a sale the receipt preview opens automatically. Tap "Print" or connect a Bluetooth/USB thermal printer in Settings.' },
  { q: 'Can I use this offline?', a: 'Yes! All data is stored locally on the device using IndexedDB. Wi-Fi sync to a manager device is optional.' },
  { q: 'How do I apply a senior discount?', a: 'On the cart sidebar, select "20% Senior / PWD" from the discount dropdown and enter the ID number before checkout.' },
  { q: 'How do I export sales reports?', a: 'Open Sales History or Shift Report and tap the Export button to download an Excel or PDF file.' },
];


// ══════════════════════════════════════════════════════════════════════════════
//  Sub-component: CSV Import Modal
// ══════════════════════════════════════════════════════════════════════════════
const ImportProductsModal = ({ onClose, onComplete }) => {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [parseStatus, setParseStatus] = useState(null); // null | 'parsing' | 'done' | 'error'
  const [previewRows, setPreviewRows] = useState([]);

  // TODO(security): When connecting to a real backend, validate CSV content
  // server-side, enforce max file size (≤ 5 MB), whitelist allowed MIME types,
  // and sanitize all string values before database insertion.
  const handleFile = (file) => {
    if (!file) return;
    const allowedTypes = ['text/csv', 'text/plain', 'application/vnd.ms-excel'];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.csv')) {
      setParseStatus('error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setParseStatus('error');
      return;
    }
    setFileName(file.name);
    setParseStatus('parsing');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(l => l.trim());
        // Grab up to 4 preview rows (skip header)
        const rows = lines.slice(1, 5).map(line => {
          const cols = line.split(',');
          return {
            name: (cols[0] || '').trim(),
            price: (cols[1] || '').trim(),
            category: (cols[2] || '').trim(),
          };
        });
        setPreviewRows(rows);
        setParseStatus('done');
      } catch {
        setParseStatus('error');
      }
    };
    reader.onerror = () => setParseStatus('error');
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleInputChange = (e) => {
    handleFile(e.target.files[0]);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-lg overflow-hidden animate-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-surface-hover">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Upload size={20} className="text-violet-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-main">Import Products</h2>
              <p className="text-xs text-text-light">Upload a CSV file to bulk-add items</p>
            </div>
          </div>
          <button
            id="import-modal-close"
            onClick={onClose}
            className="btn-compact w-9 h-9 flex items-center justify-center rounded-xl hover:bg-border transition-colors"
          >
            <X size={18} className="text-text-light" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* CSV format hint */}
          <div className="p-3 bg-surface-hover rounded-xl border border-border flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-text-main mb-1.5">Expected CSV format:</p>
              <code className="text-[11px] text-primary font-mono block bg-background rounded-lg px-3 py-1.5 border border-border">
                Name, Price, Category, Description
              </code>
            </div>
            <a
              href="data:text/csv;charset=utf-8,Name,Price,Category,Description%0AExample Product,100.00,Meals,A delicious meal"
              download="Product_Import_Template.csv"
              className="btn-compact px-3 py-1.5 bg-primary/10 text-primary font-semibold text-xs rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-1.5"
            >
              <Download size={14} />
              Template
            </a>
          </div>

          {/* Drop zone */}
          <label
            htmlFor="csv-file-input"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`block w-full border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              dragOver
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : parseStatus === 'done'
                ? 'border-emerald-500 bg-emerald-500/5'
                : parseStatus === 'error'
                ? 'border-red-400 bg-red-400/5'
                : 'border-border hover:border-primary/50 hover:bg-surface-hover'
            }`}
          >
            <input
              id="csv-file-input"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleInputChange}
            />
            {parseStatus === 'done' ? (
              <>
                <CheckCircle2 size={36} className="text-emerald-500 mx-auto mb-2" />
                <p className="font-semibold text-emerald-600 text-sm">{fileName}</p>
                <p className="text-xs text-text-light mt-1">Ready to import — tap another file to replace</p>
              </>
            ) : parseStatus === 'error' ? (
              <>
                <X size={36} className="text-red-400 mx-auto mb-2" />
                <p className="font-semibold text-red-500 text-sm">Invalid file</p>
                <p className="text-xs text-text-light mt-1">Only CSV files under 5 MB are accepted</p>
              </>
            ) : parseStatus === 'parsing' ? (
              <>
                <span className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-3 block" />
                <p className="text-sm font-medium text-text-main">Reading file…</p>
              </>
            ) : (
              <>
                <Upload size={32} className="text-text-light mx-auto mb-3 opacity-60" />
                <p className="font-semibold text-text-main text-sm">Drop your CSV here</p>
                <p className="text-xs text-text-light mt-1">or click to browse · max 5 MB</p>
              </>
            )}
          </label>

          {/* Preview table */}
          {parseStatus === 'done' && previewRows.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-2 bg-surface-hover border-b border-border">
                <p className="text-xs font-semibold text-text-light uppercase tracking-wider">Preview (first {previewRows.length} rows)</p>
              </div>
              <div className="divide-y divide-border">
                {previewRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="font-medium text-text-main flex-1 truncate">{row.name || '—'}</span>
                    <span className="text-primary font-semibold flex-shrink-0">{row.price ? `₱${row.price}` : '—'}</span>
                    <span className="text-xs text-text-light flex-shrink-0 hidden sm:block">{row.category || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border bg-surface-hover flex gap-3">
          <button
            id="import-skip-btn"
            onClick={onClose}
            className="flex-1 min-h-[48px] px-4 bg-background border border-border rounded-xl text-sm font-semibold text-text-main hover:bg-border transition-colors"
          >
            Skip for Now
          </button>
          <button
            id="import-confirm-btn"
            disabled={parseStatus !== 'done'}
            onClick={() => { onComplete('products'); onClose(); }}
            className="flex-[2] min-h-[48px] px-4 bg-primary hover:bg-primary-dark disabled:bg-border disabled:text-text-light text-white rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:active:scale-100 shadow-lg flex items-center justify-center gap-2"
          >
            <Upload size={16} />
            Import Products
          </button>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  Sub-component: Payment Methods Modal
// ══════════════════════════════════════════════════════════════════════════════
const PaymentMethodsModal = ({ onClose, onComplete }) => {
  const methods = [
    { id: 'cash',   label: 'Cash',       sub: 'Always enabled',            icon: Wallet,    enabled: true,  locked: true },
    { id: 'gcash',  label: 'GCash',      sub: 'Upload QR in Settings',     icon: Scan,      enabled: false, locked: false },
    { id: 'maya',   label: 'Maya',       sub: 'Upload QR in Settings',     icon: Scan,      enabled: false, locked: false },
    { id: 'card',   label: 'Card / POS', sub: 'Requires card terminal',    icon: CreditCard, enabled: false, locked: false },
  ];

  const [enabled, setEnabled] = useState(
    methods.reduce((acc, m) => ({ ...acc, [m.id]: m.enabled }), {})
  );

  const toggle = (id) => {
    setEnabled(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-md overflow-hidden animate-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-surface-hover">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CreditCard size={20} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-main">Payment Methods</h2>
              <p className="text-xs text-text-light">Choose which methods to accept</p>
            </div>
          </div>
          <button
            id="payment-modal-close"
            onClick={onClose}
            className="btn-compact w-9 h-9 flex items-center justify-center rounded-xl hover:bg-border transition-colors"
          >
            <X size={18} className="text-text-light" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {methods.map(method => {
            const Icon = method.icon;
            const isOn = enabled[method.id];
            return (
              <div
                key={method.id}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                  isOn ? 'border-primary/40 bg-primary/5' : 'border-border bg-background'
                }`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${isOn ? 'bg-primary/10' : 'bg-surface-hover'}`}>
                  <Icon size={20} className={isOn ? 'text-primary' : 'text-text-light'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-text-main">{method.label}</p>
                  <p className="text-xs text-text-light">{method.sub}</p>
                </div>
                {/* Toggle switch */}
                <button
                  id={`toggle-${method.id}-btn`}
                  onClick={() => !method.locked && toggle(method.id)}
                  disabled={method.locked}
                  aria-pressed={isOn}
                  aria-label={`Toggle ${method.label}`}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                    isOn ? 'bg-primary' : 'bg-border'
                  } ${method.locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                      isOn ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            );
          })}

          <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl flex gap-2 mt-2">
            <Settings size={14} className="text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-text-light leading-relaxed">
              QR codes and advanced gateway config can be managed in <strong className="text-text-main">Settings → Payment Methods</strong>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border bg-surface-hover flex gap-3">
          <button
            id="payment-skip-btn"
            onClick={onClose}
            className="flex-1 min-h-[48px] px-4 bg-background border border-border rounded-xl text-sm font-semibold text-text-main hover:bg-border transition-colors"
          >
            Skip for Now
          </button>
          <button
            id="payment-save-btn"
            onClick={() => { onComplete('payment'); onClose(); }}
            className="flex-[2] min-h-[48px] px-4 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2"
          >
            <Check size={16} />
            Save & Continue
          </button>
        </div>
      </div>
    </div>
  );
};

const SpotlightTour = ({ steps, onClose, onComplete, currentUser }) => {
  const [validSteps, setValidSteps] = useState([]);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  // Filter steps to only include those whose highlight target actually exists in DOM (role-based)
  useEffect(() => {
    // We delay slightly to allow DOM to finish rendering
    const timer = setTimeout(() => {
      const available = steps.filter(s => {
        if (s.roles && currentUser && !s.roles.includes(currentUser.role)) return false;
        return document.getElementById(s.highlight);
      });
      if (available.length === 0) {
        onComplete('tour');
        onClose();
      } else {
        setValidSteps(available);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [steps, onClose, onComplete, currentUser]);

  // Update highlight position
  useEffect(() => {
    if (validSteps.length === 0) return;
    const updateRect = () => {
      const el = document.getElementById(validSteps[step].highlight);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      }
    };
    updateRect();
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [step, validSteps]);

  if (validSteps.length === 0 || !targetRect) return null;

  const current = validSteps[step];
  const Icon = current.icon;
  const isLast = step === validSteps.length - 1;

  const next = () => {
    if (isLast) { onComplete('tour'); onClose(); }
    else setStep(s => s + 1);
  };

  // Smart Positioning to prevent off-screen and overlap
  const isMobile = window.innerWidth < 1024;
  let tooltipTop, tooltipLeft, transform;

  if (isMobile) {
    // On mobile, keep it centered and push it away from the target
    const isTargetTopHalf = targetRect.top < window.innerHeight / 2;
    tooltipTop = isTargetTopHalf ? window.innerHeight - 280 : 24;
    tooltipLeft = '50%';
    transform = 'translateX(-50%)';
  } else {
    const tooltipWidth = 320;
    const tooltipHeight = 180;
    
    // Try right
    if (targetRect.right + tooltipWidth + 24 < window.innerWidth) {
      tooltipLeft = targetRect.right + 24;
      tooltipTop = Math.max(24, Math.min(targetRect.top, window.innerHeight - tooltipHeight - 24));
      transform = 'none';
    } 
    // Try left
    else if (targetRect.left - tooltipWidth - 24 > 0) {
      tooltipLeft = targetRect.left - tooltipWidth - 24;
      tooltipTop = Math.max(24, Math.min(targetRect.top, window.innerHeight - tooltipHeight - 24));
      transform = 'none';
    }
    // Fallback: top or bottom
    else {
      tooltipLeft = '50%';
      transform = 'translateX(-50%)';
      tooltipTop = targetRect.top < window.innerHeight / 2 ? targetRect.bottom + 24 : targetRect.top - tooltipHeight - 24;
    }
  }

  return (
    <>
      {/* SVG Overlay for Spotlight effect */}
      <svg className="fixed inset-0 z-[85] pointer-events-none w-full h-full" style={{ mixBlendMode: 'hard-light' }}>
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={targetRect.left - 6}
              y={targetRect.top - 6}
              width={targetRect.width + 12}
              height={targetRect.height + 12}
              rx="12"
              fill="black"
              className="transition-all duration-300"
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.85)" mask="url(#spotlight-mask)" />
      </svg>

      {/* Target indicator ring */}
      <div 
        className="fixed z-[86] pointer-events-none rounded-xl border-2 border-primary animate-pulse transition-all duration-300 shadow-[0_0_15px_rgba(var(--primary-color),0.5)]"
        style={{
          top: targetRect.top - 6,
          left: targetRect.left - 6,
          width: targetRect.width + 12,
          height: targetRect.height + 12,
        }}
      />

      {/* Backdrop click to block interaction underneath */}
      <div className="fixed inset-0 z-[84]" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} />

      {/* Tooltip Card */}
      <div 
        className="fixed z-[90] bg-surface rounded-2xl shadow-2xl border-2 border-primary/20 w-[320px] overflow-hidden animate-in fade-in zoom-in duration-300 transition-all"
        style={{
          top: tooltipTop,
          left: tooltipLeft,
          transform: transform,
        }}
      >
        {/* Progress bar */}
        <div className="h-1.5 bg-border">
          <div
            className="h-full bg-primary transition-all duration-500 rounded-full"
            style={{ width: `${((step + 1) / validSteps.length) * 100}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border bg-surface-hover">
          <span className="text-[11px] font-semibold text-text-light uppercase tracking-wider">
            Step {step + 1} of {validSteps.length}
          </span>
          <button
            id="tour-close-btn"
            onClick={onClose}
            className="btn-compact w-7 h-7 flex items-center justify-center rounded-lg hover:bg-border transition-colors"
          >
            <X size={14} className="text-text-light" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-main mb-1">{current.title}</h2>
              <p className="text-xs text-text-light leading-relaxed">{current.description}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-surface-hover flex gap-2">
          <button
            id="tour-skip-btn"
            onClick={onClose}
            className="flex-1 min-h-[36px] bg-background border border-border rounded-lg text-xs font-semibold text-text-main hover:bg-border transition-colors"
          >
            Skip
          </button>
          <button
            id="tour-next-btn"
            onClick={next}
            className="flex-[2] min-h-[36px] bg-primary hover:bg-primary-dark text-white rounded-lg text-xs font-semibold transition-all active:scale-95 shadow-md flex items-center justify-center gap-1.5"
          >
            {isLast ? (
              <><Check size={14} /> Finish</>
            ) : (
              <>Next <ArrowRight size={14} /></>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  Sub-component: Help Drawer (FAB triggered)
// ══════════════════════════════════════════════════════════════════════════════
const HelpDrawer = ({ isOpen, onClose, onStartTour }) => {
  const [openFaq, setOpenFaq] = useState(null);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Drawer panel */}
      <div
        className="fixed bottom-0 right-0 z-[75] w-full sm:w-[400px] max-h-[80vh] bg-surface rounded-t-3xl sm:rounded-tl-3xl sm:rounded-tr-none border-t border-l border-border shadow-2xl flex flex-col"
        style={{ animation: 'slideUpIn 0.3s cubic-bezier(0.32, 0.72, 0, 1)' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <LifeBuoy size={20} className="text-primary" />
            <h2 className="text-base font-semibold text-text-main">Help &amp; Guides</h2>
          </div>
          <button
            id="help-drawer-close"
            onClick={onClose}
            className="btn-compact w-9 h-9 flex items-center justify-center rounded-xl hover:bg-surface-hover transition-colors"
          >
            <X size={18} className="text-text-light" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Quick Actions */}
          <div>
            <p className="text-xs font-semibold text-text-light uppercase tracking-wider mb-2.5">Quick Actions</p>
            <div className="space-y-2">
              <button
                id="help-start-tour-btn"
                onClick={() => { onClose(); onStartTour(); }}
                className="w-full flex items-center gap-3 p-3.5 bg-primary/5 border border-primary/20 rounded-xl hover:bg-primary/10 transition-colors text-left group"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Play size={16} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-main">Restart Guided Tour</p>
                  <p className="text-xs text-text-light">Walk through the key features</p>
                </div>
                <ChevronRight size={16} className="text-text-light group-hover:text-primary transition-colors" />
              </button>
              <a
                href="#"
                id="help-docs-link"
                onClick={(e) => e.preventDefault()}
                className="w-full flex items-center gap-3 p-3.5 bg-background border border-border rounded-xl hover:bg-surface-hover transition-colors text-left group"
              >
                <div className="w-9 h-9 rounded-lg bg-surface-hover flex items-center justify-center flex-shrink-0">
                  <BookOpen size={16} className="text-text-light" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-main">Documentation</p>
                  <p className="text-xs text-text-light">Full user manual &amp; setup guide</p>
                </div>
                <ExternalLink size={14} className="text-text-light group-hover:text-primary transition-colors" />
              </a>
            </div>
          </div>

          {/* FAQ */}
          <div>
            <p className="text-xs font-semibold text-text-light uppercase tracking-wider mb-2.5">Frequently Asked</p>
            <div className="space-y-2">
              {FAQS.map((faq, i) => (
                <div
                  key={i}
                  className="border border-border rounded-xl overflow-hidden"
                >
                  <button
                    id={`faq-${i}-btn`}
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center gap-3 p-4 text-left bg-background hover:bg-surface-hover transition-colors"
                  >
                    <HelpCircle size={15} className="text-primary flex-shrink-0" />
                    <span className="flex-1 text-sm font-medium text-text-main leading-snug">{faq.q}</span>
                    <ChevronDown
                      size={16}
                      className={`text-text-light flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {openFaq === i && (
                    <div className="px-4 pb-4 pt-1 bg-background border-t border-border">
                      <p className="text-sm text-text-light leading-relaxed">{faq.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUpIn {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
};

const StoreBrandingModal = ({ onClose, onComplete }) => (
  <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
    <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-md overflow-hidden animate-in">
      <div className="flex items-center justify-between p-5 border-b border-border bg-surface-hover">
        <h2 className="text-base font-semibold text-text-main flex items-center gap-2"><Star size={18} className="text-blue-500" /> Store Branding</h2>
        <button onClick={onClose} className="btn-compact w-9 h-9 flex items-center justify-center rounded-xl hover:bg-border"><X size={18} /></button>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-sm text-text-light">Store Name and Logo can be managed in the <strong className="text-text-main">Settings</strong> module under "Store Configuration". Close this onboarding guide to edit them.</p>
      </div>
      <div className="p-5 border-t border-border bg-surface-hover flex gap-3">
        <button onClick={() => { onComplete('branding'); onClose(); }} className="w-full min-h-[48px] px-4 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2">Mark as Done</button>
      </div>
    </div>
  </div>
);

const CreateStaffModal = ({ onClose, onComplete }) => (
  <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
    <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-md overflow-hidden animate-in">
      <div className="flex items-center justify-between p-5 border-b border-border bg-surface-hover">
        <h2 className="text-base font-semibold text-text-main flex items-center gap-2"><Shield size={18} className="text-pink-500" /> Staff Management</h2>
        <button onClick={onClose} className="btn-compact w-9 h-9 flex items-center justify-center rounded-xl hover:bg-border"><X size={18} /></button>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-sm text-text-light">You can add, edit, and remove staff accounts in the <strong className="text-text-main">Settings</strong> module under "Staff & PIN Management". Close this guide to add staff.</p>
      </div>
      <div className="p-5 border-t border-border bg-surface-hover flex gap-3">
        <button onClick={() => { onComplete('staff'); onClose(); }} className="w-full min-h-[48px] px-4 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2">Mark as Done</button>
      </div>
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
//  Main: OnboardingFlow
// ══════════════════════════════════════════════════════════════════════════════
const OnboardingFlow = ({ showWelcome, onDismiss, currentUser, activeTab }) => {
  const [completed, setCompleted] = useState(() => {
    // TODO(security): localStorage only stores a lightweight boolean map for
    // UX state — no sensitive data is persisted here.
    try {
      const saved = localStorage.getItem('pos-onboarding-completed');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [activeModal, setActiveModal] = useState(null); // 'tour' | 'hardware' | 'products' | 'payment'
  const [helpOpen, setHelpOpen] = useState(false);
  const [activeModuleTour, setActiveModuleTour] = useState(null);

  // Auto-trigger module tours
  useEffect(() => {
    if (!activeTab || !currentUser) return;
    // Do not trigger module tours if the welcome overlay is currently showing
    if (showWelcome) return;
    
    const tourKey = `pos-tour-${activeTab}-dismissed-${currentUser.id}`;
    if (localStorage.getItem(tourKey) !== 'true' && MODULE_TOURS[activeTab]) {
      setActiveModuleTour(activeTab);
    }
  }, [activeTab, currentUser, showWelcome]);

  // Persist completion state
  useEffect(() => {
    try {
      localStorage.setItem('pos-onboarding-completed', JSON.stringify(completed));
    } catch {
      // Silently ignore storage errors (e.g., private browsing quota exceeded)
    }
  }, [completed]);

  // Global event listener for opening help drawer
  useEffect(() => {
    const handleOpenHelp = () => setHelpOpen(true);
    window.addEventListener('open-help-drawer', handleOpenHelp);
    return () => window.removeEventListener('open-help-drawer', handleOpenHelp);
  }, []);

  const markComplete = useCallback((id) => {
    setCompleted(prev => ({ ...prev, [id]: true }));
  }, []);

  const toggleItem = (id) => {
    setCompleted(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const availableChecklists = CHECKLIST_ITEMS.filter(item => !item.roles || item.roles.includes(currentUser?.role));
  const completedCount = availableChecklists.filter(i => completed[i.id]).length;
  const progressPct = Math.round((completedCount / availableChecklists.length) * 100);

  const setupButtons = [
    {
      id: 'tour',
      label: 'Start Guided Tour',
      sub: 'Step-by-step walkthrough',
      icon: Play,
      color: 'text-amber-600',
      bg: 'bg-amber-500/10 hover:bg-amber-500/20',
      border: 'border-amber-500/30 hover:border-amber-500/60',
      action: () => setActiveModal('tour'),
    },
    {
      id: 'products',
      label: 'Import Products',
      sub: 'Bulk upload via CSV',
      icon: Upload,
      color: 'text-violet-500',
      bg: 'bg-violet-500/10 hover:bg-violet-500/20',
      border: 'border-violet-500/30 hover:border-violet-500/60',
      action: () => setActiveModal('products'),
    },
    {
      id: 'payment',
      label: 'Set Up Payments',
      sub: 'Cash, GCash, Maya, Card',
      icon: CreditCard,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10 hover:bg-emerald-500/20',
      border: 'border-emerald-500/30 hover:border-emerald-500/60',
      action: () => setActiveModal('payment'),
    },
    {
      id: 'branding',
      label: 'Edit Store Branding',
      sub: 'Store Name & Logo',
      icon: Star,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10 hover:bg-blue-500/20',
      border: 'border-blue-500/30 hover:border-blue-500/60',
      action: () => setActiveModal('branding'),
      roles: ['super_admin']
    },
    {
      id: 'staff',
      label: 'Create Staff',
      sub: 'Add Cashiers & Managers',
      icon: Shield,
      color: 'text-pink-500',
      bg: 'bg-pink-500/10 hover:bg-pink-500/20',
      border: 'border-pink-500/30 hover:border-pink-500/60',
      action: () => setActiveModal('staff'),
      roles: ['manager', 'super_admin']
    },
  ].filter(btn => !btn.roles || btn.roles.includes(currentUser?.role));

  return (
    <>
      {/* ── Welcome / Onboarding Overlay ─────────────────────────────────── */}
      {showWelcome && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-surface rounded-3xl shadow-2xl border border-border w-full max-w-2xl my-auto overflow-hidden animate-in">

            {/* ─ Hero Banner ─────────────────────────────────────────────── */}
            <div className="relative overflow-hidden bg-gradient-to-br from-primary to-primary-dark px-6 pt-8 pb-10 text-white">
              {/* Decorative circles */}
              <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/5" />
              <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-white/5" />

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
                    <Sparkles size={24} className="text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest opacity-70">Fresh Installation</p>
                    <h1 className="text-2xl font-bold leading-tight">Welcome to Aster POS</h1>
                  </div>
                </div>
                <p className="text-sm opacity-80 max-w-md leading-relaxed">
                  Your point-of-sale system is ready. Complete the steps below to get your store up and running in minutes.
                </p>

                {/* Progress bar */}
                <div className="mt-5">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-semibold opacity-80">Setup Progress</span>
                    <span className="text-xs font-bold">{progressPct}%</span>
                  </div>
                  <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all duration-700"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="text-xs opacity-60 mt-1.5">
                    {completedCount} of {availableChecklists.length} tasks completed
                  </p>
                </div>
              </div>
            </div>

            {/* ─ Setup Action Buttons ─────────────────────────────────────── */}
            <div className="p-5 sm:p-6 border-b border-border">
              <p className="text-xs font-semibold text-text-light uppercase tracking-wider mb-3">Quick Setup</p>
              <div className="grid grid-cols-2 gap-3">
                {setupButtons.map(btn => {
                  const Icon = btn.icon;
                  const done = completed[btn.id];
                  return (
                    <button
                      key={btn.id}
                      id={`setup-${btn.id}-btn`}
                      onClick={btn.action}
                      className={`relative flex flex-col items-start gap-2.5 p-4 rounded-2xl border-2 transition-all active:scale-[0.97] text-left ${btn.bg} ${btn.border}`}
                    >
                      {done && (
                        <span className="absolute top-2.5 right-2.5">
                          <CheckCircle2 size={16} className="text-emerald-500" />
                        </span>
                      )}
                      <div className={`w-10 h-10 rounded-xl bg-white/50 dark:bg-black/20 flex items-center justify-center`}>
                        <Icon size={20} className={btn.color} />
                      </div>
                      <div>
                        <p className={`text-sm font-semibold text-text-main leading-tight`}>{btn.label}</p>
                        <p className="text-xs text-text-light mt-0.5">{btn.sub}</p>
                      </div>
                      <ChevronRight size={14} className={`${btn.color} mt-auto self-end opacity-70`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ─ Progress Checklist ──────────────────────────────────────── */}
            <div className="p-5 sm:p-6 border-b border-border">
              <p className="text-xs font-semibold text-text-light uppercase tracking-wider mb-3">Checklist</p>
              <div className="space-y-2">
                {availableChecklists.map(item => {
                  const Icon = item.icon;
                  const done = !!completed[item.id];
                  return (
                    <button
                      key={item.id}
                      id={`checklist-${item.id}-btn`}
                      onClick={() => toggleItem(item.id)}
                      className={`w-full flex items-center gap-3.5 p-3.5 rounded-xl border transition-all active:scale-[0.98] text-left ${
                        done
                          ? 'bg-emerald-500/5 border-emerald-500/30'
                          : 'bg-background border-border hover:border-text-light/30 hover:bg-surface-hover'
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 size={20} className="text-emerald-500 flex-shrink-0" />
                      ) : (
                        <Circle size={20} className="text-border flex-shrink-0" />
                      )}
                      <Icon size={16} className={`flex-shrink-0 ${done ? 'text-emerald-500' : 'text-text-light'}`} />
                      <span className={`text-sm font-medium flex-1 ${done ? 'line-through text-text-light' : 'text-text-main'}`}>
                        {item.label}
                      </span>
                      {done && (
                        <span className="text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
                          Done
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ─ Footer ──────────────────────────────────────────────────── */}
            <div className="p-5 sm:p-6 bg-surface-hover flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-text-light text-center sm:text-left">
                You can always return to this guide from <strong className="text-text-main">Settings → Help</strong>.
              </p>
              <button
                id="onboarding-skip-btn"
                onClick={onDismiss}
                className="flex items-center gap-2 min-h-[48px] px-6 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold transition-all active:scale-95 shadow-lg flex-shrink-0 whitespace-nowrap"
              >
                <SkipForward size={16} />
                Skip for Now — Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sub-modals ─────────────────────────────────────────────────────── */}
      {(activeModal === 'tour' || activeModuleTour) && (
        <SpotlightTour
          steps={activeModuleTour ? MODULE_TOURS[activeModuleTour] : MODULE_TOURS['nav']}
          currentUser={currentUser}
          onClose={() => {
            if (activeModuleTour) {
              localStorage.setItem(`pos-tour-${activeModuleTour}-dismissed-${currentUser.id}`, 'true');
              setActiveModuleTour(null);
            } else {
              setActiveModal(null);
            }
          }}
          onComplete={(id) => {
            if (activeModuleTour) {
              localStorage.setItem(`pos-tour-${activeModuleTour}-dismissed-${currentUser.id}`, 'true');
              setActiveModuleTour(null);
            } else {
              markComplete(id);
              setActiveModal(null);
            }
          }}
        />
      )}
      {activeModal === 'products' && (
        <ImportProductsModal
          onClose={() => setActiveModal(null)}
          onComplete={markComplete}
        />
      )}
      {activeModal === 'payment' && (
        <PaymentMethodsModal
          onClose={() => setActiveModal(null)}
          onComplete={markComplete}
        />
      )}
      {activeModal === 'branding' && (
        <StoreBrandingModal
          onClose={() => setActiveModal(null)}
          onComplete={markComplete}
        />
      )}
      {activeModal === 'staff' && (
        <CreateStaffModal
          onClose={() => setActiveModal(null)}
          onComplete={markComplete}
        />
      )}

      {/* ── Help Drawer ────────────────────────────────────────────────────── */}
      <HelpDrawer
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        onStartTour={() => {
          setHelpOpen(false);
          if (MODULE_TOURS[activeTab]) {
            setActiveModuleTour(activeTab);
          } else {
            setActiveModal('tour');
          }
        }}
      />

    </>
  );
};

export default OnboardingFlow;
