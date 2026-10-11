import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initializeDefaultData, hasMinRole, ROLE_LABELS } from './db';
import {
  ShoppingBag, Coffee, Plus, Minus, Trash2, Settings as SettingsIcon,
  X, CreditCard, Banknote, QrCode, Moon, Sun, Monitor, Lock, LogOut,
  LayoutDashboard, UtensilsCrossed, Receipt, ShieldCheck, Search,
  ChevronUp, ChevronDown, BarChart3, Crown, Image as ImageIcon, ClipboardList, Clock,
  Croissant, Utensils, Tag, IceCream, User, Filter, Eye, EyeOff, Menu, LayoutGrid, LayoutList, CheckSquare,
  Package, AlertTriangle, ShieldAlert, Network, HelpCircle, RefreshCw
} from 'lucide-react';
import './index.css';
import { useResponsive } from './hooks/useResponsive';
import { useWifiSync } from './hooks/useWifiSync';
import { EVENT_TYPES } from './services/wifiSyncService';
import { deductIngredientsForOrder, checkStockAvailability } from './services/inventoryService';

// Components
import LockScreen from './components/LockScreen';
import SalesHistory from './components/SalesHistory';
import Settings from './components/Settings';
import MenuManager from './components/MenuManager';
import Dashboard from './components/Dashboard';
import SuperAdminSettings from './components/SuperAdminSettings';
import ManagerOverrideModal from './components/ManagerOverrideModal';
import ShiftReport from './components/ShiftReport';
import AccountSettings from './components/AccountSettings';
import ReceiptPrinter from './components/ReceiptPrinter';
import InventoryManager from './components/InventoryManager';
import ActivationScreen from './components/ActivationScreen';
import SyncStatusBadge from './components/SyncStatusBadge';
import OnboardingFlow from './components/OnboardingFlow';
import NetworkSyncModule from './components/NetworkSyncModule';
import CuteLoadingScreen from './components/CuteLoadingScreen';
import ManagerWebLogin from './components/ManagerWebLogin';
import ManagerWebPortal from './components/ManagerWebPortal';
import cloudSyncService from './services/cloudSyncService';
import { Capacitor } from '@capacitor/core';

// --- Opening Float Modal ---
const OpeningFloatModal = ({ isOpen, onConfirm, userName }) => {
  const [floatAmount, setFloatAmount] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!floatAmount || parseFloat(floatAmount) < 0) return;
    onConfirm(parseFloat(floatAmount));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-sm overflow-hidden animate-in">
        <div className="p-5 border-b border-border bg-surface-hover text-center">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-3">
            <Banknote size={24} />
          </div>
          <h2 className="text-xl font-semibold text-text-main">Start Shift</h2>
          <p className="text-sm text-text-light mt-1">Welcome back, {userName}!</p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-light mb-2 text-center">Declare Opening Cash Float</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-light font-bold text-xl">₱</span>
              <input
                type="number"
                value={floatAmount}
                onChange={e => setFloatAmount(e.target.value)}
                className="min-h-[56px] w-full pl-10 pr-4 bg-background border-2 border-border rounded-xl focus:ring-2 focus:ring-primary text-2xl font-semibold text-text-main text-center"
                placeholder="0.00"
                min="0"
                step="0.01"
                autoFocus
              />
            </div>
            <p className="text-xs text-text-light text-center mt-2">Enter the physical cash currently in the drawer to begin your shift.</p>
          </div>
          <button
            onClick={handleConfirm}
            disabled={!floatAmount}
            className="w-full min-h-[52px] bg-primary hover:bg-primary-dark disabled:bg-border disabled:text-text-light text-white rounded-xl font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg"
          >
            <ClipboardList size={18} /> Start Shift & Clock In
          </button>
        </div>
      </div>
    </div>
  );
};


// --- Payment Modal (with dynamic QR images & Confirmation Intercept) ---
const PaymentModal = ({ isOpen, onClose, total, onProcessPayment, currency, cart }) => {
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [amountTendered, setAmountTendered] = useState('');
  const [referenceRef, setReferenceRef] = useState('');
  const [toastConfig, setToastConfig] = useState({ isVisible: false, message: '', type: 'error' });
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(null);

  // Fetch QR codes from DB
  const qrCodes = useLiveQuery(() => db.payment_qr_codes.toArray()) || [];

  if (!isOpen) return null;

  const flash = (message, type = 'error') => {
    setToastConfig({ isVisible: true, message, type });
    setTimeout(() => setToastConfig({ isVisible: false, message: '', type: 'error' }), 2500);
  };

  const change = amountTendered ? Math.max(0, parseFloat(amountTendered) - total) : 0;

  const handlePayment = () => {
    if (paymentMethod === 'Cash' && parseFloat(amountTendered) < total) {
      return flash('Insufficient cash tendered.');
    }
    if (paymentMethod !== 'Cash' && !referenceRef) {
      return flash('Reference number is required.');
    }

    setConfirmingPayment({ 
      method: paymentMethod, 
      amount: paymentMethod === 'Cash' ? parseFloat(amountTendered) : total, 
      reference: referenceRef, 
      change 
    });
  };

  const presetBills = [100, 200, 500, 1000];

  // Find QR data for current method
  const activeQr = qrCodes.find(qr => qr.methodName === paymentMethod || qr.label === paymentMethod);

  if (confirmingPayment) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setConfirmingPayment(null)}>
        <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-md overflow-hidden animate-in flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="p-5 border-b border-border bg-surface-hover">
            <h2 className="text-xl font-semibold text-text-main">Confirm Payment</h2>
          </div>
          <div className="p-5 flex-1 overflow-y-auto max-h-[50vh]">
            <div className="bg-background rounded-xl border border-border p-4 mb-4">
              <div className="flex justify-between mb-2"><span className="text-sm font-medium text-text-light">Method</span><span className="font-semibold">{confirmingPayment.method}</span></div>
              <div className="flex justify-between mb-2"><span className="text-sm font-medium text-text-light">Total Due</span><span className="font-semibold text-primary">{currency}{total.toFixed(2)}</span></div>
              {confirmingPayment.method === 'Cash' ? (
                <>
                  <div className="flex justify-between mb-2"><span className="text-sm font-medium text-text-light">Tendered</span><span className="font-semibold">{currency}{confirmingPayment.amount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-sm font-medium text-text-light">Change</span><span className="font-semibold text-accent">{currency}{confirmingPayment.change.toFixed(2)}</span></div>
                </>
              ) : (
                <div className="flex justify-between"><span className="text-sm font-medium text-text-light">Ref #</span><span className="font-semibold">{confirmingPayment.reference}</span></div>
              )}
            </div>
            
            <h3 className="text-xs font-medium text-text-light uppercase mb-2">Itemized Order</h3>
            <div className="space-y-2">
              {cart?.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="font-medium text-text-main pr-2 truncate">{item.quantity}x {item.product.name}</span>
                  <span className="font-semibold text-text-main">{currency}{(item.product.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-5 border-t border-border flex gap-3">
            <button onClick={() => setConfirmingPayment(null)} className="flex-1 min-h-[52px] px-6 bg-surface-hover hover:bg-border text-text-main rounded-xl font-semibold text-sm transition-colors">Back to Edit</button>
            <button onClick={() => setShowFinalConfirm(true)} className="flex-[2] min-h-[52px] px-6 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold text-sm transition-transform active:scale-95 shadow-lg">Confirm & Complete</button>
          </div>
        </div>
        
        {/* Final Confirmation Prompt Overlay */}
        {showFinalConfirm && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md rounded-2xl p-4">
            <div className="bg-surface rounded-2xl p-6 text-center w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
              <h3 className="text-xl font-semibold text-text-main mb-2">Finalize Payment?</h3>
              <p className="text-text-light text-sm mb-6">Are you sure you want to complete this transaction?</p>
              <div className="flex gap-3">
                <button onClick={() => setShowFinalConfirm(false)} className="flex-1 min-h-[48px] px-6 bg-surface-hover border border-border text-text-main rounded-xl font-semibold text-sm">Cancel</button>
                <button onClick={() => {
                  setShowFinalConfirm(false);
                  onProcessPayment(confirmingPayment);
                  setConfirmingPayment(null);
                  setPaymentMethod('Cash'); setAmountTendered(''); setReferenceRef('');
                }} className="flex-1 min-h-[48px] px-6 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold text-sm shadow-lg">Complete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      {/* Toast Notification for Payment Modal */}
      {toastConfig.isVisible && (
        <div className={`fixed top-4 right-4 z-[70] ${toastConfig.type === 'error' ? 'bg-red-500' : 'bg-green-500'} text-white px-5 py-3 rounded-xl font-semibold text-sm shadow-xl flex items-center gap-2 animate-in`}>
          <X size={16} /> {toastConfig.message}
        </div>
      )}
      
      <div className="bg-surface rounded-t-3xl sm:rounded-2xl shadow-2xl border border-border w-full sm:max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-5 sm:p-6 border-b border-border bg-surface-hover">
          <h2 className="text-xl sm:text-2xl font-semibold text-text-main">Payment</h2>
          <button onClick={onClose} className="w-11 h-11 flex items-center justify-center hover:bg-border rounded-full transition-colors"><X size={22} className="text-text-light" /></button>
        </div>
        <div className="p-6 sm:p-8 text-center bg-primary text-white">
          <p className="text-xs font-medium uppercase tracking-wider opacity-80 mb-1">Total Due</p>
          <p className="text-4xl sm:text-5xl font-semibold">{currency}{total.toFixed(2)}</p>
        </div>
        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-4 gap-2.5 sm:gap-3 mb-5">
            {['Cash', 'GCash', 'Maya', 'Card'].map(method => (
              <button key={method} onClick={() => setPaymentMethod(method)} className={`min-h-[68px] sm:min-h-[80px] rounded-xl flex flex-col items-center justify-center gap-1.5 px-4 border-2 transition-all ${paymentMethod === method ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-main hover:border-text-light'}`}>
                {method === 'Cash' && <Banknote size={22} />}
                {(method === 'GCash' || method === 'Maya') && <QrCode size={22} />}
                {method === 'Card' && <CreditCard size={22} />}
                <span className="text-xs font-semibold">{method}</span>
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {paymentMethod === 'Cash' ? (
              <>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {presetBills.map(bill => (<button key={bill} onClick={() => setAmountTendered(bill.toString())} className="min-h-[48px] px-4 bg-surface-hover border border-border rounded-xl font-medium text-text-main hover:bg-border text-sm">{currency}{bill}</button>))}
                  <button onClick={() => setAmountTendered(total.toString())} className="min-h-[48px] col-span-4 px-6 bg-primary/10 border-2 border-primary rounded-xl font-semibold text-sm text-primary hover:bg-primary hover:text-white transition-colors">Exact Amount</button>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-light font-semibold">{currency}</span>
                  <input type="number" value={amountTendered} onChange={(e) => setAmountTendered(e.target.value)} className="min-h-[52px] w-full pl-10 pr-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-xl font-semibold text-text-main" placeholder="0.00" />
                </div>
                <div className="flex justify-between items-center p-3 bg-background rounded-xl border border-border">
                  <span className="text-text-light font-medium text-sm">Change Due:</span>
                  <span className={`text-xl font-semibold ${change > 0 ? 'text-accent' : 'text-text-light'}`}>{currency}{change.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                {(paymentMethod === 'GCash' || paymentMethod === 'Maya') && (
                  <div className="bg-background p-5 rounded-xl border border-border flex flex-col items-center">
                    {activeQr?.qrDataUrl ? (
                      <>
                        <p className="text-sm font-semibold text-text-main mb-3">Scan to pay with {paymentMethod}</p>
                        <div className="w-48 h-48 sm:w-56 sm:h-56 bg-white flex items-center justify-center border-4 border-primary rounded-2xl p-2 shadow-lg">
                          <img src={activeQr.qrDataUrl} alt={`${paymentMethod} QR Code`} className="w-full h-full object-contain" />
                        </div>
                        {activeQr.accountName && (
                          <p className="text-sm font-semibold text-text-main mt-3">{activeQr.accountName}</p>
                        )}
                        {activeQr.accountNumber && (
                          <p className="text-xs text-text-light mt-0.5 font-medium">{activeQr.accountNumber}</p>
                        )}
                      </>
                    ) : (
                      <>
                        <QrCode size={48} className="text-text-light mb-2 opacity-40" />
                        <p className="text-sm font-medium text-text-light mb-1">No QR code uploaded for {paymentMethod}</p>
                        <p className="text-xs text-text-light opacity-70">Ask your admin to upload a QR code in Settings</p>
                      </>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-text-light mb-1">Reference Number *</label>
                  <input type="text" value={referenceRef} onChange={(e) => setReferenceRef(e.target.value)} className="min-h-[52px] w-full px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main" placeholder="Enter Ref #" maxLength={50} />
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="p-5 sm:p-6 border-t border-border bg-surface-hover safe-bottom">
          <button onClick={handlePayment} disabled={(paymentMethod === 'Cash' && (!amountTendered || parseFloat(amountTendered) < total)) || (paymentMethod !== 'Cash' && !referenceRef)} className="w-full min-h-[56px] px-6 bg-primary hover:bg-primary-dark disabled:bg-border disabled:text-text-light text-white rounded-xl font-semibold text-base shadow-lg transition-all active:scale-95 disabled:active:scale-100">Confirm Payment</button>
        </div>
      </div>
    </div>
  );
};

// --- POS Register View ---
const POSRegister = ({ currentUser, settings, syncBroadcast }) => {
  const [cart, setCart] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [overrideConfig, setOverrideConfig] = useState({ isOpen: false, actionName: '', onSuccess: null });
  const [lastOrder, setLastOrder] = useState(null);
  const [stockWarnings, setStockWarnings] = useState([]);
  const [showStockWarnings, setShowStockWarnings] = useState(true);
  const [showDiscountErrorModal, setShowDiscountErrorModal] = useState(false);
  
  const [cardLayout, setCardLayout] = useState(() => localStorage.getItem('aster-card-layout') || 'name_icon');
  useEffect(() => { localStorage.setItem('aster-card-layout', cardLayout); }, [cardLayout]);
  
  // Advanced Retail Modules State
  const [orderType, setOrderType] = useState('Dine-In'); // 'Dine-In', 'Takeout', 'Delivery'
  const [tableNumber, setTableNumber] = useState('');
  const [discountType, setDiscountType] = useState('None'); // 'None', 'Senior/PWD'
  const [discountId, setDiscountId] = useState('');
  const [loyaltyNumber, setLoyaltyNumber] = useState('');
  
  // Parked Orders State
  const [showParkModal, setShowParkModal] = useState(false);
  const [parkName, setParkName] = useState('');
  const [showRecallDrawer, setShowRecallDrawer] = useState(false);

  // CRM & Loyalty State
  const [showRewardPrompt, setShowRewardPrompt] = useState(false);
  // Only query the specific customer when a phone is entered (avoids loading full table)
  const activeCustomer = useLiveQuery(
    () => loyaltyNumber.length >= 10 ? db.customers.where('phone').equals(loyaltyNumber).first() : undefined,
    [loyaltyNumber]
  );

  const products = useLiveQuery(() => db.products.toArray()) || [];
  const dbCategories = useLiveQuery(() => db.categories.orderBy('sort_order').toArray()) || [];
  // Fix: Dexie orderBy for parked orders (reverse+sortBy is invalid)
  const parkedOrdersList = useLiveQuery(() => db.parked_orders.orderBy('timestamp').reverse().toArray()) || [];
  
  const activeCategories = dbCategories.filter(c => c.status === 'Active');
  const categories = ['All', ...activeCategories.map(c => c.name)];
  const currency = settings?.currency || '₱';

  const handleAddToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => (item.product.id === product.id)
          ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const executeQuantityUpdate = (productObj, delta) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productObj.product.id) {
        return { ...item, quantity: item.quantity + delta };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const updateQuantity = (productObj, delta) => {
    if (delta < 0 && !hasMinRole(currentUser.role, 'manager')) {
      const actionName = delta === -productObj.quantity ? 'Void Item' : 'Reduce Quantity';
      setOverrideConfig({
        isOpen: true,
        actionName,
        onSuccess: async (managerUser, authType = 'PIN') => {
          await db.audit_logs.add({
            timestamp: new Date().getTime(),
            actionType: actionName,
            itemName: productObj.product.name,
            cashierId: currentUser.id,
            managerId: managerUser.id,
            approvingManagerId: managerUser.id,
            auth_type: authType
          });
          executeQuantityUpdate(productObj, delta);
        }
      });
      return;
    }
    executeQuantityUpdate(productObj, delta);
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (!hasMinRole(currentUser.role, 'manager')) {
      setOverrideConfig({
        isOpen: true,
        actionName: 'Clear Entire Cart',
        onSuccess: async (managerUser, authType = 'PIN') => {
          await db.audit_logs.add({
            timestamp: new Date().getTime(),
            actionType: 'Clear Entire Cart',
            itemName: `${cart.length} items`,
            cashierId: currentUser.id,
            managerId: managerUser.id,
            approvingManagerId: managerUser.id,
            auth_type: authType
          });
          setCart([]);
        }
      });
      return;
    }
    setCart([]);
  };

  const handleParkOrder = async () => {
    if (!parkName.trim() || cart.length === 0) return;
    await db.parked_orders.add({
       name: parkName,
       timestamp: new Date().getTime(),
       cart: JSON.parse(JSON.stringify(cart)), // deep copy to store
       orderType,
       tableNumber
    });
    setCart([]);
    setParkName('');
    setOrderType('Dine-In');
    setTableNumber('');
    setShowParkModal(false);
  };

  const handleRecallOrder = async (parkedOrder) => {
    // If current cart has items, warn or just clear. For now, clear cart if they confirm (handled by UI logic)
    setCart(parkedOrder.cart);
    setOrderType(parkedOrder.orderType || 'Dine-In');
    setTableNumber(parkedOrder.tableNumber || '');
    await db.parked_orders.delete(parkedOrder.id);
    setShowRecallDrawer(false);
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  
  // Discount Engine
  const isSeniorDiscount = discountType === 'Senior/PWD';
  const discountAmount = isSeniorDiscount ? subtotal * 0.20 : 0;
  const discountedSubtotal = subtotal - discountAmount;
  
  const taxRate = settings?.taxRate || 12;
  // Apply VAT exemption for Senior/PWD (often 0% tax) or regular tax
  const tax = isSeniorDiscount ? 0 : discountedSubtotal * (taxRate / 100);
  const total = discountedSubtotal + tax;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckoutClick = () => {
    if (isSeniorDiscount && !discountId) {
       setShowDiscountErrorModal(true);
       return;
    }
    setIsPaymentModalOpen(true);
  };

  const handleProcessPayment = async (paymentDetails) => {
    
    const orderItems = cart.map(item => ({ productId: item.product.id, quantity: item.quantity, productName: item.product.name, price: item.product.price }));
    
    const orderId = await db.orders.add({
      timestamp: new Date().getTime(),
      cashierId: currentUser?.id,
      total,
      subtotal,
      discountType,
      discountAmount,
      discountId,
      loyaltyNumber,
      orderType,
      tableNumber: orderType === 'Dine-In' ? tableNumber : null,
      paymentMethod: paymentDetails.method,
      paymentRef: paymentDetails.reference,
      amountTendered: paymentDetails.amount || 0,
      changeDue: paymentDetails.change || 0,
      status: 'completed',
      items: orderItems
    });
    
    // Automatically deduct raw ingredients from inventory
    const deductionResult = await deductIngredientsForOrder(orderItems);
    if (deductionResult.warnings.length > 0) {
      setStockWarnings(deductionResult.warnings);
      setShowStockWarnings(true);
    }
    
    const newOrder = await db.orders.get(orderId);
    setLastOrder(newOrder);
    
    // Process Loyalty & CRM
    let pointsEarned = 0;
    if (loyaltyNumber && loyaltyNumber.length >= 10) {
      pointsEarned = itemCount; // 1 stamp per item
      
      if (activeCustomer) {
         // Deduct points if reward was redeemed
         const pointsToDeduct = showRewardPrompt ? 10 : 0;
         await db.customers.update(activeCustomer.id, {
            points: (activeCustomer.points || 0) + pointsEarned - pointsToDeduct,
            visits: (activeCustomer.visits || 0) + 1,
            totalSpend: (activeCustomer.totalSpend || 0) + total
         });
      } else {
         await db.customers.add({
            phone: loyaltyNumber,
            name: 'Guest',
            visits: 1,
            totalSpend: total,
            points: pointsEarned
         });
      }
    }
    
    await db.transactions.add({ orderId: undefined, timestamp: new Date().getTime(), type: 'sale', amount: total });

    // --- Wi-Fi Sync: Broadcast transaction + register summary to Manager Devices ---
    if (syncBroadcast) {
      syncBroadcast(EVENT_TYPES.TRANSACTION_COMPLETED, {
        orderId,
        timestamp: new Date().getTime(),
        total,
        subtotal,
        paymentMethod: paymentDetails.method,
        cashierId: currentUser?.id,
        cashierName: currentUser?.name,
        items: orderItems,
        orderType,
      });

      // Build and broadcast updated register summary
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayOrders = await db.orders.where('timestamp').aboveOrEqual(todayStart.getTime()).toArray();
      const completed = todayOrders.filter(o => o.status === 'completed');
      const totalRev = completed.reduce((s, o) => s + (o.total || 0), 0);
      const cashSales = completed.filter(o => o.paymentMethod === 'Cash').reduce((s, o) => s + (o.total || 0), 0);
      syncBroadcast(EVENT_TYPES.REGISTER_SUMMARY_MUTATED, {
        totalRevenue: totalRev,
        totalOrders: completed.length,
        cashSales,
        digitalSales: totalRev - cashSales,
        voidCount: todayOrders.filter(o => o.status === 'voided').length,
        avgOrderValue: completed.length > 0 ? totalRev / completed.length : 0,
      });

      // Broadcast stock mutations for each deducted ingredient
      if (deductionResult.warnings.length > 0) {
        for (const w of deductionResult.warnings) {
          syncBroadcast(EVENT_TYPES.STOCK_MUTATED, {
            ingredientName: w.ingredientName,
            currentStock: w.currentStock,
            unit: w.unit,
            type: w.type,
          });
        }
      }
    }

    setCart([]); 
    setDiscountType('None'); setDiscountId(''); setLoyaltyNumber(''); setTableNumber('');
    setShowRewardPrompt(false);
    setIsPaymentModalOpen(false); setMobileCartOpen(false);

    // Auto-transmit new sale snapshot to Cloud Relay (Manager Website)
    try { cloudSyncService.triggerAutoSync(); } catch {}
  };



  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden relative">
      {lastOrder && (
        <ReceiptPrinter
          order={lastOrder}
          isVoided={false}
          onClose={() => setLastOrder(null)}
        />
      )}

      {/* Low-Stock Warning Banner */}
      {stockWarnings.length > 0 && showStockWarnings && (
        <div className="absolute top-0 left-0 right-0 z-20 bg-amber-500/95 text-white px-4 py-2.5 flex items-center gap-3 shadow-lg animate-in">
          <AlertTriangle size={18} className="flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider">Inventory Alert</p>
            <p className="text-xs font-medium truncate">
              {stockWarnings.map(w => `${w.ingredientName}${w.type === 'out_of_stock' ? ' (OUT)' : w.type === 'insufficient' ? ' (LOW)' : ''}`).join(' • ')}
            </p>
          </div>
          <button onClick={() => { setShowStockWarnings(false); setStockWarnings([]); }} className="btn-compact w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Product Grid Side */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Category Filter + Search */}
        <div id="pos-category-filters" className="px-3 sm:px-5 lg:px-6 py-3 bg-surface flex flex-col gap-2.5 border-b border-border shadow-sm flex-shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[120px] max-w-[200px]">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light pointer-events-none" />
              <select
                value={activeCategory}
                onChange={e => setActiveCategory(e.target.value)}
                className="w-full min-h-[40px] pl-8 pr-8 bg-background border border-border rounded-xl font-medium text-sm text-text-main appearance-none cursor-pointer focus:ring-2 focus:ring-primary focus:outline-none"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Layout Selector */}
            <div className="flex bg-background border border-border rounded-xl p-1 flex-shrink-0">
              <button onClick={() => setCardLayout('text_only')} className={`btn-compact px-2 py-1.5 rounded-lg flex items-center gap-1 transition-colors ${cardLayout === 'text_only' ? 'bg-primary text-white shadow-sm' : 'text-text-light hover:bg-surface-hover'}`} title="Text Only">
                <LayoutList size={14} /><span className="text-[11px] font-medium hidden lg:inline">Text</span>
              </button>
              <button onClick={() => setCardLayout('name_icon')} className={`btn-compact px-2 py-1.5 rounded-lg flex items-center gap-1 transition-colors ${cardLayout === 'name_icon' ? 'bg-primary text-white shadow-sm' : 'text-text-light hover:bg-surface-hover'}`} title="Name & Icon">
                <CheckSquare size={14} /><span className="text-[11px] font-medium hidden lg:inline">Icon</span>
              </button>
              <button onClick={() => setCardLayout('image_card')} className={`btn-compact px-2 py-1.5 rounded-lg flex items-center gap-1 transition-colors ${cardLayout === 'image_card' ? 'bg-primary text-white shadow-sm' : 'text-text-light hover:bg-surface-hover'}`} title="Image Card">
                <ImageIcon size={14} /><span className="text-[11px] font-medium hidden lg:inline">Image</span>
              </button>
              <button onClick={() => setCardLayout('icon_grid')} className={`btn-compact px-2 py-1.5 rounded-lg flex items-center gap-1 transition-colors ${cardLayout === 'icon_grid' ? 'bg-primary text-white shadow-sm' : 'text-text-light hover:bg-surface-hover'}`} title="Icon Grid">
                <LayoutGrid size={14} /><span className="text-[11px] font-medium hidden lg:inline">Grid</span>
              </button>
            </div>
          </div>

          <div className="relative w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light" />
            <input type="text" placeholder="Search items..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="min-h-[40px] w-full pl-9 pr-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:outline-none text-sm" />
          </div>
        </div>

        {/* Products Grid - Grouped by Category */}
        <div id="pos-product-grid" className="flex-1 overflow-y-auto px-3 sm:px-5 lg:px-6 pb-24 lg:pb-6 pt-3 sm:pt-4 space-y-6">
          {activeCategories.filter(cat => activeCategory === 'All' || cat.name === activeCategory).map(cat => {
            const catProducts = products.filter(p => p.category === cat.name && p.name.toLowerCase().includes(searchQuery.toLowerCase()));
            if (catProducts.length === 0) return null;
            
            const CatHeaderIcon = getCategoryIcon(cat.name);
            return (
              <div key={cat.name} className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-text-main mb-4 flex items-center gap-2">
                  <CatHeaderIcon size={20} className="text-primary" />
                  {cat.name}
                </h2>
                <div className={`grid gap-2.5 sm:gap-3 lg:gap-4 ${cardLayout === 'icon_grid' ? 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6' : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
                  {catProducts.map(product => {
                    const Icon = getCategoryIcon(product.category);
                    return (
                      <button key={product.id} onClick={() => {
                        handleAddToCart(product);
                      }} className={`bg-background rounded-xl sm:rounded-2xl border border-border shadow-sm hover:shadow-md hover:border-primary/50 transition-all flex flex-col items-start text-left active:scale-[0.97] overflow-hidden ${cardLayout === 'icon_grid' ? 'p-2 min-h-[90px] items-center justify-center text-center' : 'p-3 sm:p-4 min-h-[110px] sm:min-h-[130px]'}`}>
                        
                        {cardLayout === 'image_card' && (
                          <div className="w-full h-24 sm:h-28 bg-surface-hover mb-2 sm:mb-3 flex items-center justify-center -mx-3 -mt-3 sm:-mx-4 sm:-mt-4 w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)] border-b border-border text-primary/30">
                            {product.image ? (
                              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon size={32} />
                            )}
                          </div>
                        )}
                        
                        {(cardLayout === 'name_icon' || cardLayout === 'icon_grid') && (
                          <div className={`rounded-lg sm:rounded-xl bg-surface-hover border border-border text-primary flex items-center justify-center mb-2 sm:mb-3 ${cardLayout === 'icon_grid' ? 'w-12 h-12 mb-1 border-none bg-primary/10' : 'w-10 h-10 sm:w-12 sm:h-12'}`}><Icon size={20} /></div>
                        )}
                        
                        <h3 className={`font-semibold text-text-main leading-tight mb-1 line-clamp-2 ${cardLayout === 'icon_grid' ? 'text-xs text-center w-full' : 'text-sm sm:text-base'}`}>{product.name}</h3>
                        
                        {cardLayout !== 'icon_grid' && (
                          <div className="mt-auto w-full flex justify-between items-end">
                            <span className="font-semibold text-primary text-base sm:text-lg">{currency}{product.price.toFixed(2)}</span>
                            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-surface-hover border border-border flex items-center justify-center text-text-main"><Plus size={14} /></span>
                          </div>
                        )}
                        {cardLayout === 'icon_grid' && (
                           <span className="font-semibold text-primary text-[10px] mt-1">{currency}{product.price.toFixed(2)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          
          {products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
            <div className="h-48 flex flex-col items-center justify-center text-text-light opacity-50">
              <Coffee size={48} className="mb-3" />
              <p className="font-semibold">No products found</p>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Cart Sidebar (hidden on mobile, shown on tablet+) */}
      <div id="pos-cart-panel" className="hidden md:flex flex-col w-1/3 min-w-[320px] max-w-[420px] bg-surface shadow-2xl z-10 flex-shrink-0 border-l border-border relative h-full">
        <div className="min-h-[64px] p-5 border-b border-border bg-surface-hover flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <ShoppingBag className="text-primary w-5 h-5" />
            <h2 className="text-lg font-semibold text-text-main">Order Cart</h2>
            <span className="bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-lg">{itemCount} Items</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowRecallDrawer(!showRecallDrawer)} className="btn-compact text-xs font-medium bg-surface border border-border hover:bg-border px-3 py-1.5 rounded-lg transition-colors relative flex items-center gap-1">
              Recall {parkedOrdersList.length > 0 && <span className="bg-primary text-white w-4 h-4 rounded-full text-[9px] flex items-center justify-center absolute -top-1 -right-1">{parkedOrdersList.length}</span>}
            </button>
            {cart.length > 0 && (
              <>
                <button onClick={() => setShowParkModal(true)} className="btn-compact text-xs font-medium text-amber-600 hover:bg-amber-500/10 px-3 py-1.5 rounded-lg transition-colors">Park</button>
                <button onClick={handleClearCart} className="btn-compact text-xs font-medium text-red-500 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors">Clear</button>
              </>
            )}
          </div>
        </div>
        
        {/* Recall Drawer Overlay */}
        {showRecallDrawer && (
           <div className="absolute inset-x-0 top-[64px] bottom-0 bg-surface z-20 flex flex-col border-b border-border shadow-inner animate-in slide-in-from-top-2">
              <div className="p-3 bg-surface-hover border-b border-border flex justify-between items-center">
                 <h3 className="font-semibold text-sm text-text-main flex items-center gap-2">Parked Orders</h3>
                 <button onClick={() => setShowRecallDrawer(false)} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-border transition-colors"><X size={16} className="text-text-light"/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                 {parkedOrdersList.length === 0 ? (
                    <div className="text-center text-text-light text-sm mt-10">No parked orders.</div>
                 ) : (
                    parkedOrdersList.map(po => (
                       <div key={po.id} className="bg-background border border-border p-3 rounded-xl flex justify-between items-center hover:border-primary/50 transition-colors cursor-pointer" onClick={() => handleRecallOrder(po)}>
                          <div>
                             <p className="font-semibold text-text-main">{po.name}</p>
                             <p className="text-xs text-text-light">{new Date(po.timestamp).toLocaleTimeString()} • {po.cart.reduce((s,i)=>s+i.quantity,0)} items</p>
                          </div>
                          <button className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-xs font-bold">Restore</button>
                       </div>
                    ))
                 )}
              </div>
           </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-text-light opacity-50">
              <ShoppingBag size={56} className="mb-3" />
              <p className="font-semibold text-base">Cart is empty</p>
              <p className="text-sm mt-1">Tap a product to add</p>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div key={idx} className="flex flex-col p-3.5 bg-background rounded-xl border border-border">
                <div className="flex justify-between items-start mb-1.5">
                  <div className="pr-2 flex-1 min-w-0">
                    <h4 className="font-semibold text-text-main leading-tight text-sm truncate">{item.product.name}</h4>

                  </div>
                  <span className="font-semibold text-text-main text-sm whitespace-nowrap">{currency}{(item.product.price * item.quantity).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mt-1.5">
                  <button onClick={() => updateQuantity(item, -item.quantity)} className="w-10 h-10 flex items-center justify-center rounded-lg text-text-light hover:text-red-500 hover:bg-red-500/10 transition-colors"><Trash2 size={16} /></button>
                  <div className="flex items-center bg-surface border border-border rounded-xl overflow-hidden">
                    <button onClick={() => updateQuantity(item, -1)} className="w-11 h-11 flex items-center justify-center bg-surface-hover hover:bg-border text-text-main"><Minus size={14} /></button>
                    <span className="font-semibold w-10 text-center text-text-main text-sm">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item, 1)} className="w-11 h-11 flex items-center justify-center bg-primary hover:bg-primary-dark text-white"><Plus size={14} /></button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-4 bg-surface-hover border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.05)] flex flex-col gap-3 flex-shrink-0">
          
          {/* Order Meta Controls */}
          <div className="grid grid-cols-2 gap-2">
             <div className="flex bg-background rounded-lg border border-border p-0.5 overflow-hidden col-span-2 sm:col-span-1">
                {['Dine-In', 'Takeout'].map(type => (
                   <button key={type} onClick={() => setOrderType(type)} className={`btn-compact flex-1 text-xs font-medium py-2 rounded-lg transition-colors ${orderType === type ? 'bg-primary text-white' : 'text-text-main hover:bg-surface'}`}>{type}</button>
                ))}
             </div>
             {orderType === 'Dine-In' && (
                <input type="text" placeholder="Table #" value={tableNumber} onChange={e => setTableNumber(e.target.value)} className="col-span-2 sm:col-span-1 min-h-[36px] text-xs px-3 bg-background border border-border rounded-lg text-text-main font-medium" />
             )}
          </div>
          
          {/* Loyalty & Discounts */}
          <div className="space-y-2">
             <div className="flex gap-2 relative">
                <input type="text" placeholder="Loyalty Phone # (for stamps)" value={loyaltyNumber} onChange={e => setLoyaltyNumber(e.target.value)} className={`flex-1 min-h-[40px] text-xs px-3 bg-background border-2 rounded-xl text-text-main font-medium transition-colors ${activeCustomer ? 'border-primary' : 'border-border'}`} maxLength={15} />
             </div>
             
             {/* CRM Widget Intercept */}
             {activeCustomer && (
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex justify-between items-center animate-in slide-in-from-top-1">
                   <div>
                      <p className="text-xs font-bold text-primary flex items-center gap-1"><User size={12} /> {activeCustomer.name !== 'Guest' ? activeCustomer.name : 'Returning Customer'}</p>
                      <p className="text-[10px] text-primary/80 font-medium">{activeCustomer.visits} visits • {activeCustomer.points} Stamps</p>
                   </div>
                   {activeCustomer.points >= 10 && (
                      <button 
                        onClick={() => setShowRewardPrompt(!showRewardPrompt)}
                        className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors ${showRewardPrompt ? 'bg-amber-500 text-white shadow-md' : 'bg-primary text-white'}`}
                      >
                         {showRewardPrompt ? 'Cancel Reward' : 'Redeem Free Item'}
                      </button>
                   )}
                </div>
             )}

             <div className="flex gap-2 items-center">
                <select id="pos-discount-btn" value={discountType} onChange={e => {setDiscountType(e.target.value); setDiscountId('');}} className="min-h-[36px] text-xs px-3 bg-background border border-border rounded-lg text-text-main font-medium flex-1">
                   <option value="None">No Discount</option>
                   <option value="Senior/PWD">20% Senior / PWD</option>
                </select>
                {discountType === 'Senior/PWD' && (
                   <input type="text" placeholder="ID Number" value={discountId} onChange={e => setDiscountId(e.target.value)} className="flex-1 min-h-[32px] text-xs px-2 bg-background border border-border border-red-500/50 rounded-lg text-text-main" required />
                )}
             </div>
          </div>

          <div className="space-y-1.5 mt-1 border-t border-border pt-2">
            <div className="flex justify-between text-text-light font-medium text-xs"><span>Subtotal</span><span className="font-semibold">{currency}{subtotal.toFixed(2)}</span></div>
            {discountAmount > 0 && (
               <div className="flex justify-between text-accent font-medium text-xs"><span>Discount (20%)</span><span className="font-semibold">-{currency}{discountAmount.toFixed(2)}</span></div>
            )}
            {showRewardPrompt && (
               <div className="flex justify-between text-amber-500 font-medium text-xs"><span>Loyalty Reward (Free Item)</span><span className="text-[10px] font-semibold">Will cost 10 Stamps</span></div>
            )}
            <div className="flex justify-between text-text-light font-medium text-xs"><span>Tax ({taxRate}%)</span><span className="font-semibold">{currency}{tax.toFixed(2)}</span></div>
            <div className="pt-2 mt-1 border-t border-border flex justify-between items-end">
              <span className="text-text-main font-semibold text-sm">Total Due</span>
              <span className="text-3xl font-semibold text-primary">{currency}{(showRewardPrompt ? Math.max(0, total - (cart[0]?.product.price || 0)) : total).toFixed(2)}</span>
            </div>
          </div>
          <button id="pos-checkout-btn" onClick={handleCheckoutClick} disabled={cart.length === 0} className="w-full min-h-[56px] px-6 bg-primary hover:bg-primary-dark disabled:bg-border disabled:text-text-light text-white rounded-xl font-semibold text-base shadow-lg transition-all active:scale-95 disabled:active:scale-100 flex justify-center items-center gap-2">
            Charge {currency}{(showRewardPrompt ? Math.max(0, total - (cart[0]?.product.price || 0)) : total).toFixed(2)}
          </button>
        </div>
      </div>

      {/* Mobile Cart Floating Button */}
      {!mobileCartOpen && (
        <button onClick={() => setMobileCartOpen(true)} className="md:hidden fixed bottom-20 right-4 z-30 bg-primary text-white rounded-2xl shadow-2xl shadow-primary/30 p-4 flex items-center gap-3 active:scale-95 transition-transform">
          <ShoppingBag size={22} />
          <div className="text-left">
            <p className="text-xs font-semibold opacity-80">{itemCount} items</p>
            <p className="text-base font-semibold">{currency}{total.toFixed(2)}</p>
          </div>
          <ChevronUp size={18} className="ml-1" />
        </button>
      )}

      {/* Mobile Cart Slide-Up Panel */}
      {mobileCartOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex flex-col justify-end bg-black/50 backdrop-blur-sm" onClick={() => setMobileCartOpen(false)}>
          <div className="bg-surface rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col pb-safe" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border bg-surface-hover">
              <div className="flex items-center gap-2">
                <span className="bg-primary/10 text-primary text-xs font-semibold px-2 py-1 rounded-lg">{itemCount} items</span>
                <button onClick={() => setShowRecallDrawer(!showRecallDrawer)} className="btn-compact text-xs font-medium bg-surface border border-border hover:bg-border px-2 py-1 rounded-lg transition-colors relative flex items-center gap-1">
                  Recall {parkedOrdersList.length > 0 && <span className="bg-primary text-white w-4 h-4 rounded-full text-[9px] flex items-center justify-center absolute -top-1 -right-1">{parkedOrdersList.length}</span>}
                </button>
                {cart.length > 0 && (
                  <>
                    <button onClick={() => setShowParkModal(true)} className="btn-compact text-xs font-medium text-amber-600 hover:bg-amber-500/10 px-2 py-1 rounded-lg transition-colors">Park</button>
                    <button onClick={handleClearCart} className="btn-compact text-xs font-medium text-red-500 hover:bg-red-500/10 px-2 py-1 rounded-lg transition-colors">Clear</button>
                  </>
                )}
              </div>
              <button onClick={() => setMobileCartOpen(false)} className="w-9 h-9 flex items-center justify-center hover:bg-border rounded-full"><ChevronDown size={22} className="text-text-light" /></button>
            </div>

            {/* Mobile Recall Drawer */}
            {showRecallDrawer && (
               <div className="bg-surface border-b border-border animate-in slide-in-from-top-2">
                  <div className="p-3 bg-surface-hover border-b border-border flex justify-between items-center">
                     <h3 className="font-semibold text-sm text-text-main flex items-center gap-2">Parked Orders</h3>
                     <button onClick={() => setShowRecallDrawer(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-border transition-colors"><X size={16} className="text-text-light"/></button>
                  </div>
                  <div className="overflow-y-auto p-3 space-y-2 max-h-[40vh]">
                     {parkedOrdersList.length === 0 ? (
                        <div className="text-center text-text-light text-sm py-6">No parked orders.</div>
                     ) : (
                        parkedOrdersList.map(po => (
                           <div key={po.id} className="bg-background border border-border p-3 rounded-xl flex justify-between items-center hover:border-primary/50 transition-colors cursor-pointer" onClick={() => { handleRecallOrder(po); setShowRecallDrawer(false); }}>
                              <div>
                                 <p className="font-semibold text-text-main text-sm">{po.name}</p>
                                 <p className="text-xs text-text-light">{new Date(po.timestamp).toLocaleTimeString()} • {po.cart.reduce((s,i)=>s+i.quantity,0)} items</p>
                              </div>
                              <button className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-xs font-bold">Restore</button>
                           </div>
                        ))
                     )}
                  </div>
               </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cart.length === 0 ? (
                <div className="py-12 flex flex-col items-center text-text-light opacity-50">
                  <ShoppingBag size={48} className="mb-2" />
                  <p className="font-semibold">Cart is empty</p>
                </div>
              ) : (
                cart.map((item, idx) => (
                  <div key={idx} className="flex flex-col p-3 bg-background rounded-xl border border-border">
                    <div className="flex justify-between items-start mb-1">
                      <div className="pr-2 flex-1 min-w-0">
                        <h4 className="font-semibold text-text-main text-sm truncate">{item.product.name}</h4>

                      </div>
                      <span className="font-semibold text-text-main text-sm">{currency}{(item.product.price * item.quantity).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <button onClick={() => updateQuantity(item, -item.quantity)} className="text-text-light hover:text-red-500 p-1"><Trash2 size={15} /></button>
                      <div className="flex items-center bg-surface border border-border rounded-lg overflow-hidden">
                        <button onClick={() => updateQuantity(item, -1)} className="min-h-[34px] w-8 flex items-center justify-center bg-surface-hover text-text-main"><Minus size={13} /></button>
                        <span className="font-bold w-8 text-center text-text-main text-sm">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item, 1)} className="min-h-[34px] w-8 flex items-center justify-center bg-primary text-white"><Plus size={13} /></button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 bg-surface-hover border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.05)] flex flex-col gap-3 safe-bottom">
              
              {/* Order Meta Controls */}
              <div className="grid grid-cols-2 gap-2">
                 <div className="flex bg-background rounded-lg border border-border p-0.5 overflow-hidden col-span-2 sm:col-span-1">
                    {['Dine-In', 'Takeout'].map(type => (
                       <button key={type} onClick={() => setOrderType(type)} className={`btn-compact flex-1 text-xs font-medium py-2 rounded-lg transition-colors ${orderType === type ? 'bg-primary text-white' : 'text-text-main hover:bg-surface'}`}>{type}</button>
                    ))}
                 </div>
                 {orderType === 'Dine-In' && (
                    <input type="text" placeholder="Table #" value={tableNumber} onChange={e => setTableNumber(e.target.value)} className="col-span-2 sm:col-span-1 min-h-[36px] text-xs px-3 bg-background border border-border rounded-lg text-text-main font-medium" />
                 )}
              </div>
              
              {/* Loyalty & Discounts */}
              <div className="space-y-2">
                 <div className="flex gap-2 relative">
                    <input type="text" placeholder="Loyalty Phone # (for stamps)" value={loyaltyNumber} onChange={e => setLoyaltyNumber(e.target.value)} className={`flex-1 min-h-[40px] text-xs px-3 bg-background border-2 rounded-xl text-text-main font-medium transition-colors ${activeCustomer ? 'border-primary' : 'border-border'}`} maxLength={15} />
                 </div>
                 
                 {/* CRM Widget Intercept */}
                 {activeCustomer && (
                    <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex justify-between items-center animate-in slide-in-from-top-1">
                       <div>
                          <p className="text-xs font-bold text-primary flex items-center gap-1"><User size={12} /> {activeCustomer.name !== 'Guest' ? activeCustomer.name : 'Returning Customer'}</p>
                          <p className="text-[10px] text-primary/80 font-medium">{activeCustomer.visits} visits • {activeCustomer.points} Stamps</p>
                       </div>
                       {activeCustomer.points >= 10 && (
                          <button 
                            onClick={() => setShowRewardPrompt(!showRewardPrompt)}
                            className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors ${showRewardPrompt ? 'bg-amber-500 text-white shadow-md' : 'bg-primary text-white'}`}
                          >
                             {showRewardPrompt ? 'Cancel Reward' : 'Redeem Free Item'}
                          </button>
                       )}
                    </div>
                 )}

                 <div className="flex gap-2 items-center">
                    <select id="pos-discount-btn-mobile" value={discountType} onChange={e => {setDiscountType(e.target.value); setDiscountId('');}} className="min-h-[36px] text-xs px-3 bg-background border border-border rounded-lg text-text-main font-medium flex-1">
                       <option value="None">No Discount</option>
                       <option value="Senior/PWD">20% Senior / PWD</option>
                    </select>
                    {discountType === 'Senior/PWD' && (
                       <input type="text" placeholder="ID Number" value={discountId} onChange={e => setDiscountId(e.target.value)} className="flex-1 min-h-[32px] text-xs px-2 bg-background border border-border border-red-500/50 rounded-lg text-text-main" required />
                    )}
                 </div>
              </div>

              <div className="space-y-1.5 mt-1 border-t border-border pt-2">
                <div className="flex justify-between text-text-light font-medium text-xs"><span>Subtotal</span><span className="font-semibold">{currency}{subtotal.toFixed(2)}</span></div>
                {discountAmount > 0 && (
                   <div className="flex justify-between text-accent font-medium text-xs"><span>Discount (20%)</span><span className="font-semibold">-{currency}{discountAmount.toFixed(2)}</span></div>
                )}
                {showRewardPrompt && (
                   <div className="flex justify-between text-amber-500 font-medium text-xs"><span>Loyalty Reward (Free Item)</span><span className="text-[10px] font-semibold">Will cost 10 Stamps</span></div>
                )}
                <div className="flex justify-between text-text-light font-medium text-xs"><span>Tax ({taxRate}%)</span><span className="font-semibold">{currency}{tax.toFixed(2)}</span></div>
                <div className="pt-2 mt-1 border-t border-border flex justify-between items-end">
                  <span className="text-text-main font-semibold text-sm">Total Due</span>
                  <span className="text-2xl font-bold text-primary">{currency}{(showRewardPrompt ? Math.max(0, total - (cart[0]?.product.price || 0)) : total).toFixed(2)}</span>
                </div>
              </div>
              <button onClick={() => { setMobileCartOpen(false); handleCheckoutClick(); }} disabled={cart.length === 0} className="w-full min-h-[52px] bg-primary hover:bg-primary-dark disabled:bg-border disabled:text-text-light text-white rounded-xl font-bold text-base shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
                Charge {currency}{(showRewardPrompt ? Math.max(0, total - (cart[0]?.product.price || 0)) : total).toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Park Order Modal */}
      {showParkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-sm overflow-hidden animate-in">
            <div className="p-5 border-b border-border bg-surface-hover">
              <h2 className="text-lg font-semibold text-text-main">Park Order</h2>
              <p className="text-xs text-text-light">Save this cart to the queue and clear the screen.</p>
            </div>
            <div className="p-5">
              <label className="block text-sm font-medium text-text-light mb-2">Customer Name / Reference tag</label>
              <input type="text" value={parkName} onChange={e => setParkName(e.target.value)} className="w-full h-12 px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main font-medium" placeholder="e.g. Table 4 / Mark" autoFocus />
            </div>
            <div className="p-5 border-t border-border flex gap-3">
              <button onClick={() => setShowParkModal(false)} className="flex-1 min-h-[48px] px-6 border border-border rounded-xl font-semibold text-sm">Cancel</button>
              <button onClick={handleParkOrder} disabled={!parkName.trim()} className="flex-[2] min-h-[48px] px-6 bg-amber-500 hover:bg-amber-600 disabled:bg-border text-white rounded-xl font-semibold text-sm shadow-lg">Hold Order</button>
            </div>
          </div>
        </div>
      )}
      {/* Discount Error Modal */}
      {showDiscountErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-sm overflow-hidden animate-in">
            <div className="p-5 border-b border-border bg-red-500/10 flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-text-main">ID Required</h2>
                <p className="text-xs font-medium text-red-500">Senior / PWD Discount</p>
              </div>
            </div>
            <div className="p-6 text-center">
              <p className="text-sm text-text-main font-medium mb-1">
                You must enter a valid Senior Citizen or PWD ID number to apply this 20% discount.
              </p>
            </div>
            <div className="p-4 border-t border-border flex gap-3">
              <button onClick={() => setShowDiscountErrorModal(false)} className="w-full min-h-[48px] px-6 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-sm shadow-lg">Got it</button>
            </div>
          </div>
        </div>
      )}

      <PaymentModal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} total={total} onProcessPayment={handleProcessPayment} currency={currency} cart={cart} />
            <ManagerOverrideModal isOpen={overrideConfig.isOpen} onClose={() => setOverrideConfig({ ...overrideConfig, isOpen: false })} onSuccess={overrideConfig.onSuccess} actionName={overrideConfig.actionName} />
    </div>
  );
};

// --- Role Badge Component ---
const RoleBadge = ({ role }) => {
  const config = {
    super_admin: { bg: 'bg-amber-500/15 text-amber-500 border-amber-500/25', icon: <Crown size={11} />, label: 'SUPER ADMIN' },
    manager: { bg: 'bg-primary/10 text-primary border-primary/20', icon: <ShieldCheck size={11} />, label: 'MANAGER' },
    cashier: { bg: 'bg-surface-hover text-text-light border-border', icon: null, label: 'CASHIER' }
  };
  const c = config[role] || config.cashier;
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 ${c.bg}`}>
      {c.icon} {c.label}
    </span>
  );
};

// --- Clock Component ---
const LiveClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="text-[11px] font-medium text-text-light truncate">
      {time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} | {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </span>
  );
};

// --- Category Icon Helper ---
export const getCategoryIcon = (categoryName) => {
  const cat = (categoryName || '').toLowerCase();
  if (cat.includes('bread') || cat.includes('pastr') || cat.includes('bake') || cat.includes('cake')) return Croissant;
  if (cat.includes('coffee') || cat.includes('espresso') || cat.includes('drink') || cat.includes('beverage') || cat.includes('brew')) return Coffee;
  if (cat.includes('meal') || cat.includes('savory') || cat.includes('food') || cat.includes('rice') || cat.includes('pasta')) return Utensils;
  if (cat.includes('dessert') || cat.includes('sweet') || cat.includes('ice') || cat.includes('cookie')) return IceCream;
  if (cat.includes('other') || cat.includes('merch') || cat.includes('add')) return Tag;
  return ShoppingBag; // fallback
};

// --- Root Application Component ---
export default function App() {
  const { width } = useResponsive();
  const syncState = useWifiSync();
  const [isInitializing, setIsInitializing] = useState(true);
  const [isActivated, setIsActivated] = useState(() => localStorage.getItem('is_device_activated') === 'true');
  const [currentUser, setCurrentUser] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('aster-theme') || 'theme-light');
  // Platform & Portal Mode Detection
  // Native Android APK defaults to 'pos', Web Browser (Vercel) defaults to 'manager_web'
  const isNative = Capacitor.isNativePlatform();
  const [portalMode, setPortalMode] = useState(() => {
    const saved = localStorage.getItem('aster_portal_mode');
    if (saved) return saved;
    return isNative ? 'pos' : 'manager_web';
  });

  const [activeTab, setActiveTab] = useState(() => {
    const savedMode = localStorage.getItem('aster_portal_mode');
    const mode = savedMode || (Capacitor.isNativePlatform() ? 'pos' : 'manager_web');
    return mode === 'manager_web' ? 'dashboard' : 'pos';
  });

  const [showNavDrawer, setShowNavDrawer] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [openDrawerGroup, setOpenDrawerGroup] = useState('Register & Sales');
  const [showLockConfirm, setShowLockConfirm] = useState(false);

  const togglePortalMode = (mode) => {
    localStorage.setItem('aster_portal_mode', mode);
    setPortalMode(mode);
    if (mode === 'manager_web') {
      setActiveTab('dashboard');
    } else {
      setActiveTab('pos');
    }
  };

  // Cloud sync service state & auto-sync
  const [cloudSyncState, setCloudSyncState] = useState({
    isSyncing: false,
    lastSyncTime: null,
    lastSyncStatus: 'idle',
    syncError: null
  });

  useEffect(() => {
    cloudSyncService.init();
    const unsub = cloudSyncService.subscribe(setCloudSyncState);
    return () => {
      cloudSyncService.destroy();
      unsub();
    };
  }, []);

  // When logged into Manager Web Portal, periodically pull fresh data from POS
  useEffect(() => {
    if (portalMode === 'manager_web' && currentUser) {
      cloudSyncService.pullCloudData();
      const pullInterval = setInterval(() => {
        cloudSyncService.pullCloudData();
      }, 30000);
      return () => clearInterval(pullInterval);
    }
  }, [portalMode, currentUser]);

  // Onboarding: show automatically on first login per device
  // TODO(security): No sensitive data is stored in this flag.
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Shift Session State
  const [activeShift, setActiveShift] = useState(null);

  const settings = useLiveQuery(() => db.app_settings.get('default'));
  const [loadingText, setLoadingText] = useState('Initializing SQLite Database...');

  // Check for active shift when user logs in
  useEffect(() => {
    if (currentUser) {
      db.shift_sessions.where('cashierId').equals(currentUser.id).and(s => s.status === 'active').first()
        .then(shift => setActiveShift(shift || false)) // false means no active shift, needs float
        .catch(err => { console.error(err); setActiveShift(false); });
    } else {
      setActiveShift(null);
    }
  }, [currentUser]);

  const handleStartShift = async (floatAmount) => {
    const now = new Date().getTime();
    const shiftId = await db.shift_sessions.add({
      cashierId: currentUser.id,
      clockIn: now,
      clockOut: null,
      openingFloat: floatAmount,
      closingCash: null,
      status: 'active'
    });
    const newShift = await db.shift_sessions.get(shiftId);
    setActiveShift(newShift);
  };

  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const bootSequence = async () => {
      try {
        await initializeDefaultData();
      } catch (err) {
        console.error('Failed to initialize database:', err);
      } finally {
        if (isMounted) {
          setIsDbReady(true);
        }
      }
    };
    
    bootSequence();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    document.body.className = theme;
    localStorage.setItem('aster-theme', theme);
  }, [theme]);

  // On website (manager_web), completely remove and bypass the activation / installation key screen!
  if (!isActivated && portalMode !== 'manager_web') {
    return (
      <ActivationScreen 
        onActivate={() => {
          localStorage.setItem('is_device_activated', 'true');
          setIsActivated(true);
        }} 
      />
    );
  }

  if (!currentUser) {
    if (portalMode === 'manager_web') {
      return (
        <div className="h-screen bg-background relative">
          <ManagerWebLogin
            onLoginSuccess={async (user) => {
              setCurrentUser(user);
              setActiveTab('dashboard');
              try { cloudSyncService.pullCloudData(); } catch {}
            }}
          />

          {/* Quick toggle to Cashier POS mode */}
          <div className="fixed bottom-3 right-3 z-[60]">
            <button
              onClick={() => togglePortalMode('pos')}
              className="text-[11px] font-semibold bg-stone-900/80 hover:bg-stone-900 text-stone-300 hover:text-white px-3 py-1.5 rounded-lg backdrop-blur border border-white/10 shadow-lg transition-all"
            >
              Switch to Cashier POS (PIN Pad)
            </button>
          </div>

          {isInitializing && (
            <CuteLoadingScreen onFinished={() => setIsInitializing(false)} minDuration={10500} />
          )}
        </div>
      );
    }

    return (
      <div className="h-screen bg-background relative">
        <LockScreen onUnlock={async (user) => { 
           setCurrentUser(user);
           const isMgr = hasMinRole(user.role, 'manager');
           setActiveTab(isMgr ? 'dashboard' : 'pos');
           // Show onboarding on first-ever login per device (only for managers/superadmin)
           const onboardingKey = `pos-onboarding-dismissed-${user.id}`;
           if (localStorage.getItem(onboardingKey) !== 'true') {
             if (isMgr) {
               setShowOnboarding(true);
             } else {
               // Cashiers skip the welcome screen, they only get per-module tours
               try { localStorage.setItem(onboardingKey, 'true'); } catch {}
             }
           }
           // Track Timecard logic
           const activeTimecard = await db.timecards.where('userId').equals(user.id).filter(t => !t.clockOut).first();
           if (!activeTimecard) {
              await db.timecards.add({
                 userId: user.id,
                 clockIn: new Date().getTime(),
                 clockOut: null,
                 totalHours: 0
              });
           }
        }} />

        {/* Quick toggle to Manager Web Portal */}
        <div className="fixed bottom-3 right-3 z-[60]">
          <button
            onClick={() => togglePortalMode('manager_web')}
            className="text-[11px] font-semibold bg-stone-900/80 hover:bg-stone-900 text-stone-300 hover:text-white px-3 py-1.5 rounded-lg backdrop-blur border border-white/10 shadow-lg transition-all"
          >
            Manager Portal (Username/Password)
          </button>
        </div>

        {isInitializing && (
          <CuteLoadingScreen onFinished={() => setIsInitializing(false)} minDuration={10500} />
        )}
      </div>
    );
  }

  // Dedicated Executive Web Interface for Managers & Store Owners (Vercel Website)
  if (portalMode === 'manager_web') {
    return (
      <ManagerWebPortal
        currentUser={currentUser}
        onLogout={() => setCurrentUser(null)}
        theme={theme}
        setTheme={setTheme}
        onSwitchToPos={() => togglePortalMode('pos')}
      />
    );
  }

  const isSuperAdmin = currentUser.role === 'super_admin';
  const isManagerOrAbove = hasMinRole(currentUser.role, 'manager');
  const isCashier = currentUser.role === 'cashier';

  // Wait for activeShift to load (still resolving)
  if (activeShift === null) {
    return <div className="h-screen bg-background flex items-center justify-center">Loading shift...</div>;
  }

  // Role Guard: Opening float prompt is CASHIER-ONLY
  if (activeShift === false && isCashier) {
    return (
      <div className="h-screen bg-background">
        <OpeningFloatModal isOpen={true} onConfirm={handleStartShift} userName={currentUser.name} />
      </div>
    );
  }

  // Tab config for nav with RBAC
  const tabs = [
    { id: 'pos', label: 'Register', icon: LayoutDashboard, minRole: 'cashier' },
    { id: 'shift', label: 'Shift Report', icon: ClipboardList, minRole: 'cashier' },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, minRole: 'manager' },
    { id: 'inventory', label: 'Inventory', icon: Package, minRole: 'cashier' },
    { id: 'sales', label: 'History', icon: Receipt, minRole: 'cashier' },
    { id: 'menu', label: 'Menu', icon: UtensilsCrossed, minRole: 'manager' },
    { id: 'network', label: 'Wi-Fi Sync', icon: Network, minRole: 'manager' },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, minRole: 'manager' },
    { id: 'account', label: 'Account', icon: User, minRole: 'cashier' },
    { id: 'admin', label: 'Admin', icon: Crown, minRole: 'super_admin' },
  ];

  const visibleTabs = tabs.filter(t => {
    // When viewing on Manager Web Portal: omit cashier-only register & shift report
    if (portalMode === 'manager_web' && (t.id === 'pos' || t.id === 'shift')) {
      return false;
    }
    // Admin tab is always restricted to super_admin only
    if (t.id === 'admin') return hasMinRole(currentUser.role, t.minRole);
    // Check module map — if a module is explicitly enabled for the role, allow access
    const moduleMap = currentUser.role === 'cashier' ? settings?.cashierModules : settings?.managerModules;
    // If module is explicitly disabled, hide it
    if (moduleMap && moduleMap[t.id] === false) return false;
    // If module is explicitly enabled OR user naturally has the role, show it
    if (moduleMap && moduleMap[t.id] === true) return true;
    // Default: check role hierarchy
    return hasMinRole(currentUser.role, t.minRole);
  });

  // Dynamic nav overflow detection — calculates if screen is wide enough for all tabs
  // Left area ~200px, Right area ~200px. Each tab ~135px.
  // We use the 'width' from useResponsive hook which updates on window resize
  const navOverflows = width < (400 + (visibleTabs?.length * 135));

  // Theme display name
  const themeLabel = theme === 'theme-light' ? 'Light' : theme === 'theme-gray' ? 'Charcoal' : 'Dark';

  // Custom logo from settings
  const headerLogo = settings?.logoDataUrl;

  return (
    <div className="flex flex-col h-screen bg-background text-text-main">

      {/* Header - Desktop & Mobile Responsive */}
      <header className="min-h-[56px] md:min-h-[64px] bg-surface border-b border-border flex flex-wrap md:flex-nowrap items-center justify-between px-3 md:px-5 lg:px-6 shadow-sm z-20 relative safe-top flex-shrink-0 gap-y-2 py-2">
        <div className="flex items-center gap-2 md:gap-4 lg:gap-8 flex-1">
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className={`${navOverflows ? 'flex' : 'hidden'} w-10 h-10 items-center justify-center rounded-xl bg-surface-hover hover:bg-border text-text-main transition-colors flex-shrink-0`}
            title="Open Menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 md:gap-3">
            {headerLogo ? (
              <img src={headerLogo} alt="Logo" className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl object-cover shadow-lg" />
            ) : (
              <div className="w-8 h-8 md:w-10 md:h-10 bg-primary rounded-lg md:rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary/30 flex-shrink-0">
                <Coffee size={18} />
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <h1 className="text-base md:text-xl lg:text-2xl font-semibold tracking-tight leading-none truncate w-full max-w-[120px] sm:max-w-xs">{settings?.cafeName || 'Aster POS'}</h1>
              <div className="flex items-center mt-0.5 truncate">
                <LiveClock />
              </div>
            </div>
          </div>

          {/* Tablet & Desktop nav tabs — hidden when overflowing */}
          {!navOverflows && (
            <nav className="flex gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-hide flex-1 items-center px-2">
              {visibleTabs.map(tab => (
                <button key={tab.id} id={`nav-tab-${tab.id}`} onClick={() => setActiveTab(tab.id)} className={`min-h-[44px] px-4 rounded-xl font-medium flex flex-shrink-0 items-center gap-2 transition-all text-sm ${activeTab === tab.id ? 'bg-primary text-white shadow-md' : 'text-text-light hover:bg-surface-hover hover:text-text-main'}`}>
                  <tab.icon size={16} className="flex-shrink-0" /> {tab.label}
                </button>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Cloud Auto-Transmission Status Badge on POS terminal */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-hover border border-border rounded-xl text-xs font-medium" title="Automatic Cloud Transmission to Manager Website">
            <span className={`w-2 h-2 rounded-full ${
              cloudSyncState.isSyncing 
                ? 'bg-amber-500 animate-ping' 
                : (cloudSyncState.lastSyncStatus === 'offline' ? 'bg-zinc-400' : 'bg-emerald-500')
            }`} />
            <span className="text-[11px] text-text-light font-semibold hidden sm:inline">
              {cloudSyncState.isSyncing 
                ? 'Transmitting to Web...' 
                : (cloudSyncState.lastSyncStatus === 'offline' ? 'Offline (Queued)' : 'Web Sync Online')}
            </span>
          </div>

          {/* Wi-Fi Sync Status Badge */}
          <SyncStatusBadge
            status={syncState.status}
            role={syncState.role}
            connectionCount={syncState.connectionCount}
            roomCode={syncState.roomCode}
          />
          
          {/* Theme Switcher (Desktop — only when tabs are inline) */}
          <div className={`${navOverflows ? 'hidden' : 'flex'} bg-surface border border-border rounded-lg p-0.5 shadow-sm`}>
            <button onClick={() => setTheme('theme-light')} className={`btn-compact p-1.5 rounded-md transition-colors ${theme === 'theme-light' ? 'bg-primary text-white shadow' : 'text-text-light hover:bg-surface-hover hover:text-text-main'}`} title="Light Theme"><Sun size={16} /></button>
            <button onClick={() => setTheme('theme-gray')} className={`btn-compact p-1.5 rounded-md transition-colors ${theme === 'theme-gray' ? 'bg-primary text-white shadow' : 'text-text-light hover:bg-surface-hover hover:text-text-main'}`} title="Charcoal Theme"><Monitor size={16} /></button>
            <button onClick={() => setTheme('theme-dark')} className={`btn-compact p-1.5 rounded-md transition-colors ${theme === 'theme-dark' ? 'bg-primary text-white shadow' : 'text-text-light hover:bg-surface-hover hover:text-text-main'}`} title="Dark Theme"><Moon size={16} /></button>
          </div>
          
          {/* Module Guide Trigger */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-help-drawer'))}
            className="btn-compact p-2 sm:p-2.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors flex items-center justify-center shadow-sm"
            title="Module Guide & Help"
          >
            <HelpCircle size={18} />
          </button>
          
          {/* Lock Terminal Trigger (when tabs are inline) */}
          <button
            onClick={() => setShowLockConfirm(true)}
            className={`${navOverflows ? 'hidden' : 'flex'} btn-compact p-2 sm:p-2.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors items-center justify-center shadow-sm`}
            title="Lock Terminal / Logout"
          >
            <Lock size={18} />
          </button>
        </div>
      </header>

      {/* Lock Confirmation Modal */}
      {showLockConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-sm overflow-hidden animate-in">
            <div className="p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 bg-red-500/15 text-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Lock size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text-main">Lock Terminal?</h3>
                  <p className="text-xs text-text-light font-medium">Logged in as {currentUser?.name}</p>
                </div>
              </div>
              <p className="text-sm text-text-light leading-relaxed">Are you sure you want to lock the terminal and return to the login screen? Your shift will remain active until it is closed from the Shift Report.</p>
            </div>
            <div className="flex gap-2 p-4 pt-0">
              <button onClick={() => setShowLockConfirm(false)} className="flex-1 min-h-[44px] bg-surface-hover hover:bg-border border border-border text-text-main rounded-xl font-semibold text-sm transition-colors">Cancel</button>
              <button onClick={() => {
                setShowLockConfirm(false);
                setCurrentUser(null);
              }} className="flex-1 min-h-[44px] bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-2">
                <Lock size={16} /> Lock Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main View Area */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'pos' && <POSRegister currentUser={currentUser} settings={settings} syncBroadcast={syncState.isMainCounter && syncState.isConnected ? syncState.broadcast : null} />}
        {activeTab === 'shift' && <ShiftReport currentUser={currentUser} activeShift={activeShift} onShiftClosed={() => { setCurrentUser(null); setActiveShift(null); setActiveTab('pos'); }} />}
        {activeTab === 'dashboard' && visibleTabs.some(t => t.id === 'dashboard') && <Dashboard syncState={syncState} />}
        {activeTab === 'inventory' && <InventoryManager currentUser={currentUser} />}
        {activeTab === 'account' && <AccountSettings currentUser={currentUser} />}
        {activeTab === 'menu' && visibleTabs.some(t => t.id === 'menu') && <MenuManager />}
        {activeTab === 'sales' && <SalesHistory currentUser={currentUser} />}
        {activeTab === 'network' && visibleTabs.some(t => t.id === 'network') && <NetworkSyncModule syncState={syncState} />}
        {activeTab === 'settings' && visibleTabs.some(t => t.id === 'settings') && <Settings currentUser={currentUser} />}
        {activeTab === 'admin' && isSuperAdmin && <SuperAdminSettings currentUser={currentUser} />}
      </main>

      {/* Help FAB removed — use header or mobile drawer guide button */}

      {/* Mobile Navigation Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setMobileDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"></div>
          <div className="relative w-80 max-w-[85vw] bg-surface h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200" onClick={e => e.stopPropagation()}>
            {/* Header Profile Section */}
            <div className="p-5 border-b border-border bg-surface-hover flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center font-bold text-lg shadow-md flex-shrink-0">
                  {currentUser?.name?.charAt(0) || 'U'}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-text-main truncate text-base">{currentUser?.name}</h3>
                  <p className="text-xs text-text-light font-medium flex items-center gap-1 mt-0.5 truncate">
                    {ROLE_LABELS[currentUser?.role]} • {settings?.cafeName || 'Aster POS'}
                  </p>
                </div>
              </div>
              <button onClick={() => setMobileDrawerOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-border text-text-light flex-shrink-0">
                <X size={20} />
              </button>
            </div>

            {/* Module Links Section */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {[
                { title: "Register & Sales", icon: ShoppingBag, tabs: ['pos', 'shift', 'sales'] },
                { title: "Inventory & Recipes", icon: Package, tabs: ['inventory', 'menu'] },
                { title: "Wi-Fi Sync Settings", icon: Network, tabs: ['network'] },
                { title: "Manager Dashboard", icon: BarChart3, tabs: ['dashboard'] },
                { title: "Security & Audit Logs", icon: ShieldCheck, tabs: ['settings', 'account', 'admin'] }
              ].map(group => {
                const groupTabs = visibleTabs.filter(t => group.tabs.includes(t.id));
                if (groupTabs.length === 0) return null;
                const isOpen = openDrawerGroup === group.title;
                const hasActiveTab = groupTabs.some(t => t.id === activeTab);
                
                return (
                  <div key={group.title} className="flex flex-col">
                    <button
                      onClick={() => setOpenDrawerGroup(isOpen ? '' : group.title)}
                      className={`w-full min-h-[48px] px-4 rounded-xl font-medium flex items-center justify-between transition-colors text-sm ${hasActiveTab && !isOpen ? 'bg-primary/10 text-primary' : 'text-text-main hover:bg-surface-hover'}`}
                    >
                      <div className="flex items-center gap-3">
                        <group.icon size={20} className={hasActiveTab ? 'text-primary' : 'text-text-light'} />
                        <span className={hasActiveTab ? 'font-bold' : ''}>{group.title}</span>
                      </div>
                      <ChevronDown size={16} className={`text-text-light transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="flex flex-col gap-1 mt-1 pl-10 pr-2 pb-2">
                        {groupTabs.map(tab => (
                          <button
                            key={tab.id}
                            onClick={() => {
                              setActiveTab(tab.id);
                              setMobileDrawerOpen(false);
                            }}
                            className={`w-full min-h-[48px] px-4 rounded-xl font-medium flex items-center gap-3 transition-colors text-sm ${activeTab === tab.id ? 'bg-primary text-white shadow-md' : 'text-text-light hover:bg-surface-hover hover:text-text-main'}`}
                          >
                            <tab.icon size={18} className={activeTab === tab.id ? 'text-white' : 'text-text-light'} />
                            <span>{tab.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom System Controls */}
            <div className="p-4 border-t border-border bg-surface-hover space-y-3 safe-bottom">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-light uppercase tracking-wider">Theme</span>
                <div className="flex bg-surface border border-border rounded-lg p-0.5">
                  <button onClick={() => setTheme('theme-light')} className={`btn-compact p-1.5 rounded-md transition-colors ${theme === 'theme-light' ? 'bg-primary text-white shadow' : 'text-text-light hover:bg-surface-hover hover:text-text-main'}`} title="Light Theme"><Sun size={16} /></button>
                  <button onClick={() => setTheme('theme-gray')} className={`btn-compact p-1.5 rounded-md transition-colors ${theme === 'theme-gray' ? 'bg-primary text-white shadow' : 'text-text-light hover:bg-surface-hover hover:text-text-main'}`} title="Charcoal Theme"><Monitor size={16} /></button>
                  <button onClick={() => setTheme('theme-dark')} className={`btn-compact p-1.5 rounded-md transition-colors ${theme === 'theme-dark' ? 'bg-primary text-white shadow' : 'text-text-light hover:bg-surface-hover hover:text-text-main'}`} title="Dark Theme"><Moon size={16} /></button>
                </div>
              </div>

              <button
                onClick={() => {
                  setMobileDrawerOpen(false);
                  window.dispatchEvent(new CustomEvent('open-help-drawer'));
                }}
                className="w-full min-h-[48px] px-4 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <HelpCircle size={18} /> Module Tour & Guide
              </button>

              <button
                onClick={() => {
                  setMobileDrawerOpen(false);
                  setShowLockConfirm(true);
                }}
                className="w-full min-h-[48px] px-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors border border-red-500/20"
              >
                <Lock size={18} /> Lock Terminal / Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Flow — FAB always visible, Welcome Overlay conditionally shown */}
      <OnboardingFlow
        showWelcome={showOnboarding}
        currentUser={currentUser}
        activeTab={activeTab}
        onDismiss={() => {
          setShowOnboarding(false);
          // Mark as dismissed so it doesn't re-appear on subsequent logins
          if (currentUser) {
            try {
              localStorage.setItem(`pos-onboarding-dismissed-${currentUser.id}`, 'true');
            } catch {
              // Silently ignore storage errors
            }
          }
        }}
      />
    </div>
  );
}
