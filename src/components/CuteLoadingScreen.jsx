import React, { useState, useEffect } from 'react';
import { Coffee, Check, Heart, ShoppingBag, Receipt, Sparkles } from 'lucide-react';

export default function CuteLoadingScreen({ onFinished, minDuration = 10000 }) {
  const [progress, setProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [screenItems, setScreenItems] = useState([
    { id: 1, name: 'Espresso', price: '₱120', clicked: false, emoji: '☕' },
    { id: 2, name: 'Matcha Latte', price: '₱160', clicked: false, emoji: '🍵' },
    { id: 3, name: 'Croissant', price: '₱95', clicked: false, emoji: '🥐' },
    { id: 4, name: 'Berry Tart', price: '₱140', clicked: false, emoji: '🍰' },
  ]);
  const [cartCount, setCartCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);

  // Transition phases:
  // 'tapping' -> 'checkout' -> 'printing' -> 'unfolding' -> 'dissolving' -> 'finished'
  const [transitionPhase, setTransitionPhase] = useState('tapping');
  const [cursorPos, setCursorPos] = useState({ x: 20, y: 30, visible: true, clicking: false });
  const [flyingHearts, setFlyingHearts] = useState([]);

  const loadingSteps = [
    { label: 'Waking up the register...', icon: '✨' },
    { label: 'Brewing espresso & checking stock...', icon: '☕' },
    { label: 'Testing touchscreen register...', icon: '👆' },
    { label: 'Punching sample guest orders...', icon: '🥐' },
    { label: 'Printing thermal receipt...', icon: '🧾' },
    { label: 'Opening Register Login...', icon: '🔐' }
  ];

  // 1. Progress Bar smooth interpolation over 10.5 seconds
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const currentPct = Math.min(100, Math.floor((elapsed / minDuration) * 100));
      setProgress(currentPct);

      if (currentPct < 20) setActiveStep(0);
      else if (currentPct < 38) setActiveStep(1);
      else if (currentPct < 58) setActiveStep(2);
      else if (currentPct < 75) setActiveStep(3);
      else if (currentPct < 90) setActiveStep(4);
      else setActiveStep(5);

      if (elapsed >= minDuration) {
        clearInterval(interval);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [minDuration]);

  // 2. Coordinated Choreography: Clicking items -> Checkout -> Receipt Dispense -> Unfold -> Dissolve to Login
  useEffect(() => {
    const timeouts = [];

    // Tap Item 1 (Espresso) @ 1.8s
    timeouts.push(setTimeout(() => {
      setCursorPos({ x: 28, y: 38, visible: true, clicking: true });
      triggerHeart(28, 38);
      setTimeout(() => {
        setScreenItems(prev => prev.map(it => it.id === 1 ? { ...it, clicked: true } : it));
        setCartCount(1);
        setTotalAmount(120);
        setCursorPos(pos => ({ ...pos, clicking: false }));
      }, 200);
    }, 1800));

    // Tap Item 2 (Matcha) @ 3.4s
    timeouts.push(setTimeout(() => {
      setCursorPos({ x: 72, y: 38, visible: true, clicking: true });
      triggerHeart(72, 38);
      setTimeout(() => {
        setScreenItems(prev => prev.map(it => it.id === 2 ? { ...it, clicked: true } : it));
        setCartCount(2);
        setTotalAmount(280);
        setCursorPos(pos => ({ ...pos, clicking: false }));
      }, 200);
    }, 3400));

    // Tap Item 3 (Croissant) @ 5.0s
    timeouts.push(setTimeout(() => {
      setCursorPos({ x: 28, y: 72, visible: true, clicking: true });
      triggerHeart(28, 72);
      setTimeout(() => {
        setScreenItems(prev => prev.map(it => it.id === 3 ? { ...it, clicked: true } : it));
        setCartCount(3);
        setTotalAmount(375);
        setCursorPos(pos => ({ ...pos, clicking: false }));
      }, 200);
    }, 5000));

    // Tap Checkout button @ 6.6s
    timeouts.push(setTimeout(() => {
      setCursorPos({ x: 80, y: 92, visible: true, clicking: true });
      triggerHeart(80, 92);
      setTimeout(() => {
        setCursorPos(pos => ({ ...pos, clicking: false, visible: false }));
        setTransitionPhase('printing');
      }, 250);
    }, 6600));

    // Phase: Receipt unrolls down out of printer slot @ 7.4s
    timeouts.push(setTimeout(() => {
      setTransitionPhase('printed');
    }, 7400));

    // Phase: Receipt unfolds and smoothly expands outwards towards camera @ 8.8s
    timeouts.push(setTimeout(() => {
      setTransitionPhase('unfolding');
    }, 8800));

    // Phase: Soft dissolve fade revealing the underlying Login screen @ 10.0s
    timeouts.push(setTimeout(() => {
      setTransitionPhase('dissolving');
    }, 10000));

    // Phase: Complete transition and hand over to LockScreen @ 10.8s
    timeouts.push(setTimeout(() => {
      if (onFinished) onFinished();
    }, 10800));

    return () => timeouts.forEach(t => clearTimeout(t));
  }, [onFinished]);

  const triggerHeart = (x, y) => {
    const id = Date.now() + Math.random();
    setFlyingHearts(prev => [...prev, { id, x, y }]);
    setTimeout(() => {
      setFlyingHearts(prev => prev.filter(h => h.id !== id));
    }, 1200);
  };

  const isPrintingOrBeyond = ['printing', 'printed', 'unfolding', 'dissolving'].includes(transitionPhase);
  const isDissolving = transitionPhase === 'dissolving';

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#faf5ef] dark:bg-[#151210] text-text-main select-none overflow-hidden transition-all duration-1000 ease-out ${
        isDissolving ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Ambient background glowing orbs */}
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-amber-400/20 dark:bg-amber-600/10 blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-orange-400/20 dark:bg-orange-600/10 blur-3xl pointer-events-none animate-pulse" />

      {/* Floating hearts container */}
      {flyingHearts.map(h => (
        <div
          key={h.id}
          className="absolute pointer-events-none z-50 text-red-400 text-lg"
          style={{
            left: `calc(50% - 140px + ${(h.x / 100) * 280}px)`,
            top: `calc(50% - 130px + ${(h.y / 100) * 200}px)`,
            animation: 'flyUp 1s ease-out forwards'
          }}
        >
          💖
        </div>
      ))}

      {/* ── SMOOTH THERMAL RECEIPT TRANSITION ── */}
      {isPrintingOrBeyond && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/55 backdrop-blur-md pointer-events-none transition-all duration-700 ease-out">
          <div
            className={`transition-all duration-1000 cubic-bezier(0.16, 1, 0.3, 1) flex flex-col items-center origin-center ${
              transitionPhase === 'unfolding'
                ? 'scale-125 sm:scale-135 opacity-95 -translate-y-2'
                : transitionPhase === 'dissolving'
                ? 'scale-150 opacity-0 -translate-y-8 blur-sm'
                : transitionPhase === 'printed'
                ? 'scale-100 opacity-100 translate-y-0 animate-receiptSlide'
                : 'scale-90 opacity-0 -translate-y-8'
            }`}
          >
            {/* Top Thermal Printer Slot */}
            <div className="w-68 sm:w-80 h-7 bg-stone-900 rounded-t-2xl shadow-2xl flex items-center justify-center border-b-2 border-black/80">
              <div className="w-56 h-1.5 bg-black rounded-full shadow-inner" />
            </div>

            {/* Thermal Paper Receipt */}
            <div className="w-64 sm:w-76 bg-[#fffefb] text-stone-900 rounded-b-2xl shadow-2xl p-5 border border-stone-200/80 font-mono text-xs relative overflow-hidden">
              {/* Paper Top Sawtooth Pattern */}
              <div
                className="absolute top-0 left-0 right-0 h-1 bg-repeat-x opacity-35"
                style={{
                  backgroundImage: 'radial-gradient(circle, #cbd5e1 1.5px, transparent 1.5px)',
                  backgroundSize: '8px 4px'
                }}
              />

              {/* Receipt Header */}
              <div className="text-center pb-3 border-b border-dashed border-stone-300">
                <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-700 flex items-center justify-center mx-auto mb-1.5 font-sans">
                  <Coffee size={18} />
                </div>
                <h3 className="font-bold font-sans text-sm tracking-wider uppercase">Aster POS</h3>
                <p className="text-[10px] text-stone-500 font-sans mt-0.5">AirLuna Creations</p>
                <p className="text-[9px] text-stone-400 mt-1">{new Date().toLocaleString()}</p>
              </div>

              {/* Items List */}
              <div className="py-2.5 space-y-1.5 border-b border-dashed border-stone-300 text-[11px]">
                <div className="flex justify-between">
                  <span>1x Espresso</span>
                  <span>₱120.00</span>
                </div>
                <div className="flex justify-between">
                  <span>1x Matcha Latte</span>
                  <span>₱160.00</span>
                </div>
                <div className="flex justify-between">
                  <span>1x Croissant</span>
                  <span>₱95.00</span>
                </div>
              </div>

              {/* Totals Section */}
              <div className="py-2.5 border-b border-dashed border-stone-300 space-y-1 text-xs">
                <div className="flex justify-between text-stone-500 text-[10px]">
                  <span>Subtotal</span>
                  <span>₱375.00</span>
                </div>
                <div className="flex justify-between text-stone-500 text-[10px]">
                  <span>VAT (12% incl.)</span>
                  <span>₱40.18</span>
                </div>
                <div className="flex justify-between font-black text-sm text-stone-900 pt-1">
                  <span>TOTAL DUE</span>
                  <span className="text-amber-700 font-bold">₱375.00</span>
                </div>
                <div className="flex justify-between text-[10px] text-emerald-600 font-bold">
                  <span>STATUS</span>
                  <span>PAID (CASH) ✓</span>
                </div>
              </div>

              {/* Footer Transition Message */}
              <div className="pt-3 text-center">
                <p className="text-[11px] font-sans font-bold text-amber-700 flex items-center justify-center gap-1.5">
                  <Sparkles size={13} className="text-amber-500" />
                  <span>Register Ready!</span>
                  <Sparkles size={13} className="text-amber-500" />
                </p>
                <p className="text-[9px] text-stone-400 font-sans mt-0.5 tracking-wide">
                  Transitioning to Staff Login...
                </p>
              </div>

              {/* Zigzag Cut Paper Bottom */}
              <div
                className="absolute -bottom-1 left-0 right-0 h-2 bg-[#faf5ef] dark:bg-[#151210]"
                style={{
                  clipPath: 'polygon(0% 100%, 5% 0%, 10% 100%, 15% 0%, 20% 100%, 25% 0%, 30% 100%, 35% 0%, 40% 100%, 45% 0%, 50% 100%, 55% 0%, 60% 100%, 65% 0%, 70% 100%, 75% 0%, 80% 100%, 85% 0%, 90% 100%, 95% 0%, 100% 100%)'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN POS SIMULATOR & PROGRESS ── */}
      <div className={`relative z-10 flex flex-col items-center max-w-sm w-full mx-auto transition-all duration-700 ${
        isPrintingOrBeyond ? 'opacity-40 blur-[2px] scale-95' : 'opacity-100 scale-100'
      }`}>
        {/* Mascot / Header Badge */}
        <div className="relative mb-3 flex items-center justify-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center shadow-xl shadow-amber-500/25 ring-4 ring-amber-400/20 transform transition-transform">
            <Coffee size={36} className="animate-bounce" />
          </div>
          <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-400 text-white text-xs flex items-center justify-center shadow-md animate-ping">
            ✨
          </span>
          <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-400 text-white text-xs flex items-center justify-center shadow-md">
            ✨
          </span>
        </div>

        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-center bg-gradient-to-r from-amber-800 via-amber-600 to-orange-600 dark:from-amber-200 dark:via-amber-400 dark:to-orange-300 bg-clip-text text-transparent">
          Aster POS
        </h1>
        <p className="text-[11px] font-semibold text-text-light/80 tracking-wide uppercase mt-0.5 mb-4 flex items-center gap-1.5">
          <span>Powered by AirLuna Creations</span>
          <Heart size={11} className="text-red-400 fill-red-400" />
        </p>

        {/* ── THE MINI POS SIMULATOR DISPLAY ── */}
        <div className="w-full bg-surface/90 dark:bg-[#201c18]/90 backdrop-blur-md border-2 border-amber-500/20 rounded-3xl p-4 shadow-2xl relative overflow-hidden mb-5">
          {/* Top Register Bar */}
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-border/60">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block"></span>
              <span className="text-[10px] font-bold text-text-light ml-1">Main Register</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-bold text-amber-600 dark:text-amber-400">
              <ShoppingBag size={12} />
              <span>Cart: {cartCount} items</span>
            </div>
          </div>

          {/* Grid of POS Buttons */}
          <div className="grid grid-cols-2 gap-2 relative">
            {screenItems.map(item => (
              <div
                key={item.id}
                className={`p-2.5 rounded-2xl border transition-all duration-200 flex items-center gap-2 ${
                  item.clicked
                    ? 'bg-amber-500/15 border-amber-500/50 scale-95 shadow-inner'
                    : 'bg-background/80 border-border hover:border-amber-400/40'
                }`}
              >
                <span className="text-xl sm:text-2xl filter drop-shadow">{item.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-text-main truncate leading-tight">{item.name}</p>
                  <p className="text-[10px] font-semibold text-text-light leading-tight mt-0.5">{item.price}</p>
                </div>
                {item.clicked && (
                  <Check size={14} className="text-green-500 shrink-0 animate-in" />
                )}
              </div>
            ))}

            {/* Simulated Animated Hand/Cursor Pointer */}
            {cursorPos.visible && (
              <div
                className="absolute pointer-events-none transition-all duration-500 ease-out z-30"
                style={{
                  left: `${cursorPos.x}%`,
                  top: `${cursorPos.y}%`,
                  transform: `translate(-50%, -50%) scale(${cursorPos.clicking ? 0.75 : 1})`
                }}
              >
                <div className="relative">
                  <span className="text-2xl filter drop-shadow-md select-none inline-block transform -rotate-12">
                    👆
                  </span>
                  {cursorPos.clicking && (
                    <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-400/40 border border-amber-400 animate-ping"></span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Checkout Bar */}
          <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-text-light font-semibold uppercase">Total Due:</span>
              <p className="text-sm font-black text-amber-600 dark:text-amber-400 leading-none mt-0.5">
                ₱{totalAmount}.00
              </p>
            </div>
            <div className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
              isPrintingOrBeyond
                ? 'bg-green-500 text-white shadow-md shadow-green-500/30 scale-105'
                : 'bg-primary text-white shadow-sm'
            }`}>
              {isPrintingOrBeyond ? (
                <>
                  <Receipt size={13} />
                  <span>Printing Receipt... 🧾</span>
                </>
              ) : (
                <span>Checkout</span>
              )}
            </div>
          </div>
        </div>

        {/* ── PROGRESS BAR & STEP STATUS ── */}
        <div className="w-full space-y-2.5">
          <div className="h-3 w-full bg-border/60 rounded-full overflow-hidden p-0.5 border border-border/40">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500 rounded-full transition-all duration-300 ease-out relative overflow-hidden"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-bold">
            <div className="flex items-center gap-1.5 text-text-main truncate">
              <span className="text-sm">{loadingSteps[activeStep].icon}</span>
              <span className="truncate">{loadingSteps[activeStep].label}</span>
            </div>
            <span className="font-mono text-amber-600 dark:text-amber-400 text-xs shrink-0 ml-2">
              {progress}%
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes flyUp {
          0% {
            opacity: 1;
            transform: translateY(0) scale(0.8);
          }
          100% {
            opacity: 0;
            transform: translateY(-60px) scale(1.4);
          }
        }
        @keyframes receiptSlide {
          0% {
            transform: translateY(-40px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-receiptSlide {
          animation: receiptSlide 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
