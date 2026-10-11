import React, { useState } from 'react';
import { X, Check } from 'lucide-react';

const CustomizationModal = ({ isOpen, onClose, product, onAddToCart }) => {
  const [size, setSize] = useState('16oz');
  const [sweetness, setSweetness] = useState('100%');
  const [ice, setIce] = useState('Normal Ice');
  const [milk, setMilk] = useState('Whole Milk');

  if (!isOpen || !product) return null;

  const sweetnessLevels = ['0%', '25%', '50%', '75%', '100%'];
  const iceLevels = ['No Ice', 'Less Ice', 'Normal Ice', 'Extra Ice'];
  const milkOptions = ['Whole Milk', 'Oat Milk (+₱20)', 'Almond Milk (+₱30)', 'Soy Milk'];
  const sizes = ['16oz', '22oz (+₱20)'];

  const calculateAddedPrice = () => {
    let added = 0;
    if (size.includes('+₱20')) added += 20;
    if (milk.includes('+₱20')) added += 20;
    if (milk.includes('+₱30')) added += 30;
    return added;
  };

  const handleAdd = () => {
    onAddToCart({
      product: {
        ...product,
        price: product.price + calculateAddedPrice(),
        name: `${product.name} (${size.split(' ')[0]})`
      },
      modifications: {
        size,
        sweetness,
        ice,
        milk
      }
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Customize</h2>
            <p className="text-sm text-gray-500 font-medium mt-1">{product.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Size Options */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Size</h3>
            <div className="flex gap-3">
              {sizes.map(s => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 font-medium transition-all ${
                    size === s ? 'border-[#8C5E3C] bg-[#F3E9E0] text-[#8C5E3C]' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Sweetness Options */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Sweetness Level</h3>
            <div className="flex gap-2">
              {sweetnessLevels.map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setSweetness(lvl)}
                  className={`flex-1 py-2 px-1 text-sm rounded-lg border-2 font-medium transition-all ${
                    sweetness === lvl ? 'border-[#8C5E3C] bg-[#F3E9E0] text-[#8C5E3C]' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Ice Options */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Ice Level</h3>
            <div className="grid grid-cols-2 gap-3">
              {iceLevels.map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setIce(lvl)}
                  className={`py-3 px-4 rounded-xl border-2 font-medium transition-all ${
                    ice === lvl ? 'border-[#8C5E3C] bg-[#F3E9E0] text-[#8C5E3C]' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Milk Options */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Milk Options</h3>
            <div className="grid grid-cols-2 gap-3">
              {milkOptions.map(m => (
                <button
                  key={m}
                  onClick={() => setMilk(m)}
                  className={`py-3 px-4 rounded-xl border-2 font-medium transition-all flex justify-between items-center ${
                    milk === m ? 'border-[#8C5E3C] bg-[#F3E9E0] text-[#8C5E3C]' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span>{m}</span>
                  {milk === m && <Check size={18} />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="font-medium text-gray-600">
            Added: <span className="text-lg font-black text-[#8C5E3C]">₱{calculateAddedPrice().toFixed(2)}</span>
          </div>
          <button
            onClick={handleAdd}
            className="px-8 py-3 bg-[#8C5E3C] hover:bg-[#66432A] text-white rounded-xl font-bold shadow-lg shadow-[#8C5E3C]/30 transition-all active:scale-95"
          >
            Add to Order - ₱{(product.price + calculateAddedPrice()).toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomizationModal;
