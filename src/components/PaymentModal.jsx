import React, { useState } from 'react';
import { X, CreditCard, Banknote, QrCode } from 'lucide-react';

const PaymentModal = ({ isOpen, onClose, total, onProcessPayment }) => {
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [amountTendered, setAmountTendered] = useState('');
  const [referenceRef, setReferenceRef] = useState('');

  if (!isOpen) return null;

  const change = amountTendered ? Math.max(0, parseFloat(amountTendered) - total) : 0;
  
  const handlePayment = () => {
    if (paymentMethod === 'Cash' && parseFloat(amountTendered) < total) {
      alert('Insufficient cash tendered.');
      return;
    }
    if (paymentMethod !== 'Cash' && !referenceRef) {
      alert('Reference number is required for cashless payments.');
      return;
    }
    
    onProcessPayment({
      method: paymentMethod,
      amount: paymentMethod === 'Cash' ? parseFloat(amountTendered) : total,
      reference: referenceRef,
      change
    });
    
    // Reset state
    setPaymentMethod('Cash');
    setAmountTendered('');
    setReferenceRef('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-2xl font-bold text-gray-800">Complete Payment</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        {/* Total Display */}
        <div className="p-8 text-center bg-[#8C5E3C] text-white">
          <p className="text-sm uppercase tracking-wider opacity-80 mb-1">Total Amount</p>
          <p className="text-5xl font-black tracking-tight">₱{total.toFixed(2)}</p>
        </div>

        {/* Payment Methods */}
        <div className="p-6">
          <div className="grid grid-cols-4 gap-3 mb-6">
            {['Cash', 'GCash', 'Maya', 'Card'].map(method => (
              <button
                key={method}
                onClick={() => setPaymentMethod(method)}
                className={`py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-2 border-2 transition-all duration-200 ${
                  paymentMethod === method
                    ? 'border-[#8C5E3C] bg-[#F3E9E0] text-[#8C5E3C]'
                    : 'border-gray-100 bg-white hover:border-gray-300 text-gray-600'
                }`}
              >
                {method === 'Cash' && <Banknote size={24} />}
                {method === 'GCash' && <QrCode size={24} />}
                {method === 'Maya' && <QrCode size={24} />}
                {method === 'Card' && <CreditCard size={24} />}
                <span className="text-xs font-semibold">{method}</span>
              </button>
            ))}
          </div>

          {/* Dynamic Input based on method */}
          <div className="space-y-4">
            {paymentMethod === 'Cash' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount Tendered</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₱</span>
                    <input
                      type="number"
                      value={amountTendered}
                      onChange={(e) => setAmountTendered(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#8C5E3C] focus:border-transparent transition-shadow text-lg font-semibold"
                      placeholder="0.00"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-gray-600 font-medium">Change Due:</span>
                  <span className={`text-2xl font-bold ${change > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    ₱{change.toFixed(2)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {(paymentMethod === 'GCash' || paymentMethod === 'Maya') && (
                  <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 flex flex-col items-center">
                    <QrCode size={64} className="text-gray-400 mb-2" />
                    <p className="text-sm font-medium text-gray-500">Scan QR to pay with {paymentMethod}</p>
                    <div className="mt-4 p-2 bg-white border border-gray-200 rounded shadow-sm">
                      <div className="w-32 h-32 bg-gray-200 flex items-center justify-center text-xs text-gray-400">
                        QR Placeholder
                      </div>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={referenceRef}
                    onChange={(e) => setReferenceRef(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#8C5E3C] focus:border-transparent transition-shadow"
                    placeholder="Enter transaction ref..."
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50">
          <button
            onClick={handlePayment}
            className="w-full py-4 bg-[#8C5E3C] hover:bg-[#66432A] text-white rounded-xl font-bold text-lg shadow-lg shadow-[#8C5E3C]/30 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            disabled={
              (paymentMethod === 'Cash' && (!amountTendered || parseFloat(amountTendered) < total)) ||
              (paymentMethod !== 'Cash' && !referenceRef)
            }
          >
            Confirm Payment
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
