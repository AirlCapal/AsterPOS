import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, hasMinRole } from '../db';
import {
  Package, Plus, Minus, Edit2, Trash2, Search, X, Check, AlertTriangle,
  ChevronDown, ChevronUp, Beaker, ArrowUpDown, DollarSign, TrendingUp,
  BarChart3, ClipboardList, Filter, PackagePlus, RotateCcw, Archive, Download, Upload, FileText
} from 'lucide-react';
import { adjustStock, calculateCOGS } from '../services/inventoryService';
import BulkCatalogManager from './BulkCatalogManager';

// --- Shared Mini-Components ---
const Toast = ({ message, isVisible, type = 'success' }) => {
  if (!isVisible) return null;
  const bgClass = type === 'error' ? 'bg-red-500' : 'bg-green-500';
  return (
    <div className={`fixed top-4 right-4 z-[70] ${bgClass} text-white px-5 py-3 rounded-xl font-semibold text-sm shadow-xl flex items-center gap-2 animate-in`}>
      {type === 'error' ? <X size={16} /> : <Check size={16} />} {message}
    </div>
  );
};

const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, variant = 'primary' }) => {
  if (!isOpen) return null;
  const btnClass = variant === 'danger'
    ? 'bg-red-500 hover:bg-red-600 text-white'
    : 'bg-primary hover:bg-primary-dark text-white';
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-sm overflow-hidden animate-in">
        <div className="p-5 sm:p-6">
          <h3 className="text-lg font-semibold text-text-main mb-2">{title}</h3>
          <p className="text-sm text-text-light leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-2 p-4 pt-0">
          <button onClick={onCancel} className="flex-1 min-h-[44px] bg-surface-hover hover:bg-border border border-border text-text-main rounded-xl font-semibold text-sm transition-colors">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 min-h-[44px] rounded-xl font-semibold text-sm transition-all active:scale-95 ${btnClass}`}>Confirm</button>
        </div>
      </div>
    </div>
  );
};

// --- Stock Level Badge ---
const StockBadge = ({ currentStock, threshold }) => {
  if (currentStock <= 0) {
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-500/15 text-red-500 border border-red-500/25 uppercase">Out of Stock</span>;
  }
  if (currentStock <= threshold) {
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 border border-amber-500/25 uppercase">Low Stock</span>;
  }
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-green-500/15 text-green-600 border border-green-500/25 uppercase">In Stock</span>;
};

// --- Ingredient Form Modal ---
const IngredientFormModal = ({ isOpen, onClose, onSave, editData }) => {
  const [form, setForm] = useState({
    name: '', sku: '', unit: 'g', currentStock: '',
    safetyThreshold: '', costPerUnit: '', supplier: ''
  });

  useEffect(() => {
    if (editData) {
      setForm({
        name: editData.name || '',
        sku: editData.sku || '',
        unit: editData.unit || 'g',
        currentStock: editData.currentStock?.toString() || '',
        safetyThreshold: editData.safetyThreshold?.toString() || '',
        costPerUnit: editData.costPerUnit?.toString() || '',
        supplier: editData.supplier || ''
      });
    } else {
      setForm({ name: '', sku: '', unit: 'g', currentStock: '', safetyThreshold: '', costPerUnit: '', supplier: '' });
    }
  }, [editData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({
      ...editData,
      name: form.name.trim(),
      sku: form.sku.trim(),
      unit: form.unit,
      currentStock: parseFloat(form.currentStock) || 0,
      safetyThreshold: parseFloat(form.safetyThreshold) || 0,
      costPerUnit: parseFloat(form.costPerUnit) || 0,
      supplier: form.supplier.trim()
    });
  };

  const units = ['g', 'kg', 'ml', 'L', 'pcs', 'oz', 'shots'];

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div className="bg-surface rounded-t-3xl sm:rounded-2xl shadow-2xl border border-border w-full sm:max-w-lg overflow-hidden animate-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border bg-surface-hover flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <Package size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-main">{editData?.id ? 'Edit Ingredient' : 'Add Ingredient'}</h2>
              <p className="text-xs text-text-light">Raw material or packaging item</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-border rounded-full transition-colors">
            <X size={20} className="text-text-light" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-text-light mb-1">Ingredient Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="h-12 w-full px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main"
                placeholder="e.g. Espresso Beans" required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-light mb-1">SKU / Code</label>
              <input type="text" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })}
                className="h-12 w-full px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main"
                placeholder="ING-001" maxLength={50} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-light mb-1">Unit *</label>
              <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
                className="h-12 w-full px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main">
                {units.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-light mb-1">Current Stock</label>
              <input type="number" value={form.currentStock} onChange={e => setForm({ ...form, currentStock: e.target.value })}
                className="h-12 w-full px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main"
                placeholder="0" step="any" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-light mb-1">Min. Threshold</label>
              <input type="number" value={form.safetyThreshold} onChange={e => setForm({ ...form, safetyThreshold: e.target.value })}
                className="h-12 w-full px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main"
                placeholder="0" step="any" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-light mb-1">Cost Per Unit (₱)</label>
              <input type="number" value={form.costPerUnit} onChange={e => setForm({ ...form, costPerUnit: e.target.value })}
                className="h-12 w-full px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main"
                placeholder="0.00" step="0.01" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-light mb-1">Supplier</label>
              <input type="text" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })}
                className="h-12 w-full px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main"
                placeholder="Supplier name" maxLength={100} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 min-h-[48px] bg-surface-hover hover:bg-border border border-border text-text-main rounded-xl font-semibold text-sm transition-colors">Cancel</button>
            <button type="submit" className="flex-[2] min-h-[48px] bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold text-sm shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
              <Check size={18} /> {editData?.id ? 'Update' : 'Add Ingredient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Stock Adjustment Modal ---
const AdjustStockModal = ({ isOpen, onClose, ingredient, onAdjust }) => {
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [adjustType, setAdjustType] = useState('increase');

  useEffect(() => {
    if (isOpen) { setDelta(''); setReason(''); setAdjustType('increase'); }
  }, [isOpen]);

  if (!isOpen || !ingredient) return null;

  const reasons = ['Restock', 'Spill/Waste', 'Expired', 'Audit Correction'];
  const effectiveDelta = adjustType === 'increase' ? Math.abs(parseFloat(delta) || 0) : -Math.abs(parseFloat(delta) || 0);
  const previewStock = ingredient.currentStock + effectiveDelta;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div className="bg-surface rounded-t-3xl sm:rounded-2xl shadow-2xl border border-border w-full sm:max-w-md overflow-hidden animate-in" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border bg-surface-hover">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <ArrowUpDown size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-main">Adjust Stock</h2>
              <p className="text-sm text-text-light font-medium">{ingredient.name} — {ingredient.currentStock} {ingredient.unit}</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {/* Type Toggle */}
          <div className="flex bg-background rounded-xl border border-border p-1 gap-1">
            <button onClick={() => setAdjustType('increase')}
              className={`flex-1 min-h-[44px] rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all ${adjustType === 'increase' ? 'bg-green-500 text-white shadow-md' : 'text-text-light hover:bg-surface-hover'}`}>
              <Plus size={16} /> Add Stock
            </button>
            <button onClick={() => setAdjustType('decrease')}
              className={`flex-1 min-h-[44px] rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all ${adjustType === 'decrease' ? 'bg-red-500 text-white shadow-md' : 'text-text-light hover:bg-surface-hover'}`}>
              <Minus size={16} /> Remove Stock
            </button>
          </div>

          <div>
            <label className="block text-sm font-semibold text-text-light mb-1">Quantity ({ingredient.unit})</label>
            <input type="number" value={delta} onChange={e => setDelta(e.target.value)}
              className="h-12 w-full px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-xl font-semibold text-text-main text-center"
              placeholder="0" min="0" step="any" autoFocus />
          </div>

          <div>
            <label className="block text-sm font-semibold text-text-light mb-1">Reason *</label>
            <select value={reason} onChange={e => setReason(e.target.value)}
              className="h-12 w-full px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main">
              <option value="">Select a reason...</option>
              {reasons.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Preview */}
          {delta && (
            <div className="bg-background rounded-xl border border-border p-3 flex items-center justify-between">
              <span className="text-sm font-medium text-text-light">New Stock Level:</span>
              <span className={`text-lg font-semibold ${previewStock <= 0 ? 'text-red-500' : previewStock <= ingredient.safetyThreshold ? 'text-amber-500' : 'text-green-500'}`}>
                {previewStock.toFixed(1)} {ingredient.unit}
              </span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 min-h-[48px] bg-surface-hover hover:bg-border border border-border text-text-main rounded-xl font-semibold text-sm">Cancel</button>
            <button
              onClick={() => { if (delta && reason) onAdjust(ingredient.id, effectiveDelta, reason); }}
              disabled={!delta || !reason || parseFloat(delta) === 0}
              className="flex-[2] min-h-[48px] bg-primary hover:bg-primary-dark disabled:bg-border disabled:text-text-light text-white rounded-xl font-semibold text-sm shadow-lg transition-all active:scale-95">
              Apply Adjustment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Recipe Builder Modal ---
const RecipeBuilderModal = ({ isOpen, onClose, product, onSave }) => {
  const ingredients = useLiveQuery(() => db.ingredients.toArray()) || [];
  const existingRecipe = useLiveQuery(
    () => product?.id ? db.recipes.where('productId').equals(product.id).first() : undefined,
    [product?.id]
  );

  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [cogsData, setCOGSData] = useState(null);

  useEffect(() => {
    if (existingRecipe?.ingredients) {
      setRecipeIngredients(existingRecipe.ingredients.map(ri => ({ ...ri })));
    } else {
      setRecipeIngredients([]);
    }
  }, [existingRecipe]);

  // Calculate COGS live
  useEffect(() => {
    const calc = async () => {
      if (!product?.id) return;
      const data = await calculateCOGS(product.id);
      setCOGSData(data);
    };
    calc();
  }, [product?.id, existingRecipe]);

  if (!isOpen || !product) return null;

  const addIngredient = () => {
    if (ingredients.length === 0) return;
    setRecipeIngredients(prev => [...prev, { ingredientId: ingredients[0].id, quantity: 1 }]);
  };

  const updateIngredient = (idx, field, value) => {
    setRecipeIngredients(prev => prev.map((ri, i) =>
      i === idx ? { ...ri, [field]: field === 'quantity' ? parseFloat(value) || 0 : parseInt(value) } : ri
    ));
  };

  const removeIngredient = (idx) => {
    setRecipeIngredients(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (existingRecipe) {
      await db.recipes.update(existingRecipe.id, { ingredients: recipeIngredients });
    } else {
      await db.recipes.add({ productId: product.id, ingredients: recipeIngredients });
    }
    if (onSave) onSave();
    onClose();
  };

  // Live COGS from current form state
  const liveCOGS = recipeIngredients.reduce((sum, ri) => {
    const ing = ingredients.find(i => i.id === ri.ingredientId);
    return sum + (ing?.costPerUnit || 0) * (ri.quantity || 0);
  }, 0);

  const margin = product.price > 0 ? ((product.price - liveCOGS) / product.price * 100) : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div className="bg-surface rounded-t-3xl sm:rounded-2xl shadow-2xl border border-border w-full sm:max-w-xl overflow-hidden animate-in max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border bg-surface-hover flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <Beaker size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-main">Recipe Builder</h2>
              <p className="text-sm text-text-light font-medium">{product.name} — ₱{product.price?.toFixed(2)}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-border rounded-full transition-colors">
            <X size={20} className="text-text-light" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* COGS & Margin Card */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background border border-border rounded-xl p-3 text-center">
              <p className="text-[10px] font-bold text-text-light uppercase tracking-wider">COGS</p>
              <p className="text-xl font-semibold text-red-500">₱{liveCOGS.toFixed(2)}</p>
            </div>
            <div className="bg-background border border-border rounded-xl p-3 text-center">
              <p className="text-[10px] font-bold text-text-light uppercase tracking-wider">Gross Margin</p>
              <p className={`text-xl font-semibold ${margin >= 50 ? 'text-green-500' : margin >= 20 ? 'text-amber-500' : 'text-red-500'}`}>
                {margin.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Ingredient Rows */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-main">Ingredients</h3>
              <button onClick={addIngredient} className="btn-compact text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                <Plus size={14} /> Add
              </button>
            </div>

            {recipeIngredients.length === 0 ? (
              <div className="bg-background border border-border border-dashed rounded-xl p-6 text-center text-text-light">
                <Beaker size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">No ingredients added yet</p>
                <p className="text-xs mt-1">Click &quot;Add&quot; to attach raw materials to this product</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recipeIngredients.map((ri, idx) => {
                  const ing = ingredients.find(i => i.id === ri.ingredientId);
                  const lineCost = (ing?.costPerUnit || 0) * (ri.quantity || 0);
                  return (
                    <div key={idx} className="bg-background border border-border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-2.5">
                      <select value={ri.ingredientId} onChange={e => updateIngredient(idx, 'ingredientId', e.target.value)}
                        className="flex-1 h-10 px-3 bg-surface border border-border rounded-lg text-sm text-text-main font-medium">
                        {ingredients.map(i => (
                          <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-2">
                        <input type="number" value={ri.quantity} onChange={e => updateIngredient(idx, 'quantity', e.target.value)}
                          className="w-20 h-10 px-3 bg-surface border border-border rounded-lg text-sm text-text-main font-semibold text-center"
                          placeholder="Qty" min="0" step="any" />
                        <span className="text-xs font-medium text-text-light w-8">{ing?.unit || ''}</span>
                        <span className="text-xs font-semibold text-primary whitespace-nowrap">₱{lineCost.toFixed(2)}</span>
                        <button onClick={() => removeIngredient(idx)}
                          className="btn-compact w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-border flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 min-h-[48px] bg-surface-hover hover:bg-border border border-border text-text-main rounded-xl font-semibold text-sm">Cancel</button>
          <button onClick={handleSave} className="flex-[2] min-h-[48px] bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold text-sm shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
            <Check size={18} /> Save Recipe
          </button>
        </div>
      </div>
    </div>
  );
};

// ========================
// MAIN INVENTORY MANAGER
// ========================
export default function InventoryManager({ currentUser }) {
  const isManager = hasMinRole(currentUser?.role, 'manager');
  const ingredients = useLiveQuery(() => db.ingredients.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const recipes = useLiveQuery(() => db.recipes.toArray()) || [];
  const adjustments = useLiveQuery(() =>
    db.inventory_adjustments.orderBy('timestamp').reverse().limit(50).toArray()
  ) || [];

  const [activeTab, setActiveTab] = useState('stock');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('all'); // 'all' | 'low' | 'out'

  // Modal states
  const [showIngredientForm, setShowIngredientForm] = useState(false);
  const [editIngredient, setEditIngredient] = useState(null);
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [recipeTarget, setRecipeTarget] = useState(null);
  const [showBulkManager, setShowBulkManager] = useState(false);
  const [bulkManagerStep, setBulkManagerStep] = useState('upload');
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, variant: 'primary' });
  const [toastConfig, setToastConfig] = useState({ isVisible: false, message: '', type: 'success' });

  // Product COGS cache
  const [cogsCache, setCOGSCache] = useState({});

  useEffect(() => {
    const loadCOGS = async () => {
      const cache = {};
      for (const p of products) {
        const data = await calculateCOGS(p.id);
        cache[p.id] = data;
      }
      setCOGSCache(cache);
    };
    if (products.length > 0) loadCOGS();
  }, [products, recipes]);

  const flash = (message, type = 'success') => {
    setToastConfig({ isVisible: true, message, type });
    setTimeout(() => setToastConfig({ isVisible: false, message: '', type: 'success' }), 2500);
  };

  const showConfirm = (title, message, onConfirm, variant = 'primary') => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, variant });
  };
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));

  // --- Ingredient CRUD ---
  const handleSaveIngredient = async (data) => {
    if (data.id) {
      await db.ingredients.update(data.id, {
        name: data.name, sku: data.sku, unit: data.unit,
        currentStock: data.currentStock, safetyThreshold: data.safetyThreshold,
        costPerUnit: data.costPerUnit, supplier: data.supplier
      });
      flash('Ingredient updated');
    } else {
      await db.ingredients.add({
        name: data.name, sku: data.sku, unit: data.unit,
        currentStock: data.currentStock, safetyThreshold: data.safetyThreshold,
        costPerUnit: data.costPerUnit, supplier: data.supplier
      });
      flash('Ingredient added');
    }
    setShowIngredientForm(false);
    setEditIngredient(null);
  };

  const handleDeleteIngredient = (ing) => {
    showConfirm('Delete Ingredient', `Are you sure you want to delete "${ing.name}"? This will also remove it from any recipes.`, async () => {
      closeConfirm();
      // Remove from recipes
      const allRecipes = await db.recipes.toArray();
      for (const recipe of allRecipes) {
        if (recipe.ingredients?.some(ri => ri.ingredientId === ing.id)) {
          const filtered = recipe.ingredients.filter(ri => ri.ingredientId !== ing.id);
          await db.recipes.update(recipe.id, { ingredients: filtered });
        }
      }
      await db.ingredients.delete(ing.id);
      flash('Ingredient deleted');
    }, 'danger');
  };

  const handleStockAdjust = async (ingredientId, delta, reason) => {
    try {
      await adjustStock(ingredientId, delta, reason, currentUser.id, currentUser.name);
      flash(`Stock adjusted: ${delta > 0 ? '+' : ''}${delta}`);
      setAdjustTarget(null);
    } catch {
      flash('Failed to adjust stock', 'error');
    }
  };

  // --- Filtering ---
  const filteredIngredients = ingredients.filter(ing => {
    const matchSearch = ing.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ing.sku || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ing.supplier || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchSearch) return false;
    if (stockFilter === 'low') return ing.currentStock > 0 && ing.currentStock <= ing.safetyThreshold;
    if (stockFilter === 'out') return ing.currentStock <= 0;
    return true;
  });

  // Stats
  const totalIngredients = ingredients.length;
  const lowStockCount = ingredients.filter(i => i.currentStock > 0 && i.currentStock <= i.safetyThreshold).length;
  const outOfStockCount = ingredients.filter(i => i.currentStock <= 0).length;

  const tabs = [
    { id: 'stock', label: 'Raw Ingredients', icon: Package },
    ...(isManager ? [{ id: 'recipes', label: 'Recipes / BOM', icon: Beaker }] : []),
    ...(isManager ? [{ id: 'costing', label: 'COGS & Margins', icon: DollarSign }] : []),
    ...(isManager ? [{ id: 'adjustments', label: 'Audit Log', icon: ClipboardList }] : []),
  ];

  return (
    <div className="p-3 sm:p-5 lg:p-8 h-full flex flex-col bg-background overflow-hidden relative">
      <Toast {...toastConfig} />
      <ConfirmDialog {...confirmDialog} onCancel={closeConfirm} />
      <IngredientFormModal
        isOpen={showIngredientForm}
        onClose={() => { setShowIngredientForm(false); setEditIngredient(null); }}
        onSave={handleSaveIngredient}
        editData={editIngredient}
      />
      <AdjustStockModal
        isOpen={!!adjustTarget}
        onClose={() => setAdjustTarget(null)}
        ingredient={adjustTarget}
        onAdjust={handleStockAdjust}
      />
      <RecipeBuilderModal
        isOpen={!!recipeTarget}
        onClose={() => setRecipeTarget(null)}
        product={recipeTarget}
        onSave={() => flash('Recipe saved')}
      />
      {showBulkManager && (
        <BulkCatalogManager
          initialStep={bulkManagerStep}
          onClose={() => setShowBulkManager(false)}
          onComplete={() => {
            setShowBulkManager(false);
            flash('Inventory synced successfully!');
          }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-4 sm:mb-6 flex-shrink-0">
        <div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-text-main">Inventory</h2>
          <p className="text-text-light font-medium text-sm">
            {isManager ? 'Manage ingredients, recipes & stock levels' : 'View stock levels and ingredient status'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 w-full lg:w-auto min-w-0 overflow-hidden">
          {/* Tab Switcher */}
          <div className="flex bg-surface-hover border border-border rounded-xl p-1 gap-1 overflow-x-auto scrollbar-hide w-full max-w-[100vw] sm:max-w-full snap-x">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-1.5 px-4 h-10 sm:h-11 rounded-lg text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 snap-start ${activeTab === tab.id ? 'bg-surface shadow text-primary' : 'text-text-light hover:text-text-main'}`}>
                <tab.icon size={18} /> {tab.label}
              </button>
            ))}
          </div>
          {isManager && activeTab === 'stock' && (
            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              <div className="flex flex-wrap sm:flex-nowrap gap-1.5 sm:gap-2 mr-0 sm:mr-2">
                <button
                  id="inv-template-btn"
                  onClick={() => { setBulkManagerStep('upload'); setShowBulkManager(true); }}
                  className="btn-compact px-2.5 sm:px-3 h-10 bg-surface-hover hover:bg-border text-text-main rounded-lg font-semibold flex items-center gap-1.5 shadow-sm text-xs transition-colors"
                  title="Download Excel Template"
                >
                  <Download size={14} /> <span>Template</span>
                </button>
                <button
                  id="inv-import-btn"
                  onClick={() => { setBulkManagerStep('upload'); setShowBulkManager(true); }}
                  className="btn-compact px-2.5 sm:px-3 h-10 bg-surface-hover hover:bg-border text-text-main rounded-lg font-semibold flex items-center gap-1.5 shadow-sm text-xs transition-colors"
                  title="Import Excel Catalog"
                >
                  <Upload size={14} /> <span>Import</span>
                </button>
                <button
                  id="inv-stage-modal"
                  onClick={() => { setBulkManagerStep('staging'); setShowBulkManager(true); }}
                  className="btn-compact px-2.5 sm:px-3 h-10 bg-surface-hover hover:bg-border text-text-main rounded-lg font-semibold flex items-center gap-1.5 shadow-sm text-xs transition-colors"
                  title="Pre-Import Staging"
                >
                  <FileText size={14} /> <span>Staging</span>
                </button>
                <button
                  id="inv-export-btn"
                  onClick={() => { setBulkManagerStep('upload'); setShowBulkManager(true); }}
                  className="btn-compact px-2.5 sm:px-3 h-10 bg-surface-hover hover:bg-border text-text-main rounded-lg font-semibold flex items-center gap-1.5 shadow-sm text-xs transition-colors"
                  title="Export Current Catalog"
                >
                  <Download size={14} /> <span>Export</span>
                </button>
              </div>
              <button onClick={() => { setEditIngredient(null); setShowIngredientForm(true); }}
                className="min-h-[40px] sm:min-h-[44px] px-4 sm:px-6 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold flex items-center gap-2 shadow-lg transition-all active:scale-95 text-sm flex-1 sm:flex-initial justify-center">
                <PackagePlus size={18} /> <span className="hidden sm:inline">Add Ingredient</span><span className="sm:hidden">Add</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6 flex-shrink-0">
        <button onClick={() => setStockFilter('all')}
          className={`bg-surface p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-3 transition-colors text-left ${stockFilter === 'all' ? 'border-primary' : 'border-border hover:border-primary/30'}`}>
          <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <Package size={18} className="sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-semibold text-text-light uppercase tracking-wider">Total</p>
            <p className="text-base sm:text-2xl font-semibold">{totalIngredients}</p>
          </div>
        </button>
        <button onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
          className={`bg-surface p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-3 transition-colors text-left ${stockFilter === 'low' ? 'border-amber-500' : 'border-border hover:border-amber-500/30'}`}>
          <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-semibold text-text-light uppercase tracking-wider">Low</p>
            <p className="text-base sm:text-2xl font-semibold text-amber-500">{lowStockCount}</p>
          </div>
        </button>
        <button onClick={() => setStockFilter(stockFilter === 'out' ? 'all' : 'out')}
          className={`bg-surface p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-3 transition-colors text-left ${stockFilter === 'out' ? 'border-red-500' : 'border-border hover:border-red-500/30'}`}>
          <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center flex-shrink-0">
            <X size={18} className="sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-semibold text-text-light uppercase tracking-wider">Out</p>
            <p className="text-base sm:text-2xl font-semibold text-red-500">{outOfStockCount}</p>
          </div>
        </button>
      </div>

      {/* ===== RAW INGREDIENTS TAB ===== */}
      {activeTab === 'stock' && (
        <div className="flex-1 bg-surface border border-border rounded-xl sm:rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-0">
          {/* Search Bar */}
          <div className="p-3 sm:p-4 border-b border-border flex items-center gap-3 bg-surface-hover flex-shrink-0">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light" />
              <input type="text" placeholder="Search by name, SKU, or supplier..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="min-h-[40px] w-full pl-9 pr-3 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
          </div>

          {/* Desktop Table Header */}
          <div className="hidden lg:grid p-3 bg-surface border-b border-border grid-cols-[1fr_80px_100px_100px_80px_120px_100px] gap-3 font-semibold text-xs text-text-light uppercase tracking-wider flex-shrink-0">
            <div>Ingredient</div>
            <div>SKU</div>
            <div id="inv-stock-col" className="text-right">Stock</div>
            <div className="text-right">Threshold</div>
            <div>Status</div>
            {isManager && <><div className="text-right">Cost/Unit</div><div className="text-right">Actions</div></>}
          </div>

          {/* Ingredient List */}
          <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 lg:p-4 space-y-2">
            {filteredIngredients.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-text-light opacity-50 py-12">
                <Package size={44} className="mb-2" />
                <p className="font-semibold text-sm">No ingredients found</p>
                {isManager && <p className="text-xs mt-1">Click &quot;Add Ingredient&quot; to get started</p>}
              </div>
            ) : (
              filteredIngredients.map(ing => {
                const stockPercent = ing.safetyThreshold > 0 ? (ing.currentStock / ing.safetyThreshold) * 100 : 100;
                return (
                  <div key={ing.id} className="bg-background border border-border rounded-xl p-3 sm:p-4 hover:border-primary/30 transition-colors">
                    {/* Mobile layout */}
                    <div className="lg:hidden">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0 mr-3">
                          <h4 className="font-semibold text-text-main text-sm truncate">{ing.name}</h4>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {ing.sku && <span className="text-[10px] font-medium text-text-light bg-surface-hover px-1.5 py-0.5 rounded">{ing.sku}</span>}
                            <StockBadge currentStock={ing.currentStock} threshold={ing.safetyThreshold} />
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`font-semibold text-base ${ing.currentStock <= 0 ? 'text-red-500' : ing.currentStock <= ing.safetyThreshold ? 'text-amber-500' : 'text-text-main'}`}>
                            {ing.currentStock.toLocaleString()} {ing.unit}
                          </p>
                          <p className="text-[10px] text-text-light">min: {ing.safetyThreshold} {ing.unit}</p>
                        </div>
                      </div>
                      {/* Stock bar */}
                      <div className="w-full h-1.5 bg-border rounded-full overflow-hidden mb-2">
                        <div className={`h-full rounded-full transition-all ${stockPercent > 200 ? 'bg-green-500' : stockPercent > 100 ? 'bg-green-400' : stockPercent > 50 ? 'bg-amber-400' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(100, Math.max(0, stockPercent / 3))}%` }} />
                      </div>
                      {isManager && (
                        <div className="flex gap-1.5 mt-1">
                          <button onClick={() => setAdjustTarget(ing)} className="flex-1 min-h-[36px] text-xs font-semibold bg-surface-hover hover:bg-border border border-border rounded-lg flex items-center justify-center gap-1 transition-colors">
                            <ArrowUpDown size={14} /> Adjust
                          </button>
                          <button onClick={() => { setEditIngredient(ing); setShowIngredientForm(true); }}
                            className="btn-compact w-9 h-9 flex items-center justify-center rounded-lg bg-surface hover:bg-primary/10 hover:text-primary text-text-light border border-border">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDeleteIngredient(ing)}
                            className="btn-compact w-9 h-9 flex items-center justify-center rounded-lg bg-surface hover:bg-red-500/10 hover:text-red-500 text-text-light border border-border">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Desktop layout */}
                    <div className="hidden lg:grid grid-cols-[1fr_80px_100px_100px_80px_120px_100px] gap-3 items-center">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                          <Package size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-text-main text-sm truncate">{ing.name}</p>
                          {ing.supplier && <p className="text-[10px] text-text-light truncate">{ing.supplier}</p>}
                        </div>
                      </div>
                      <div className="text-xs text-text-light font-medium">{ing.sku || '-'}</div>
                      <div className={`text-right font-semibold text-sm ${ing.currentStock <= 0 ? 'text-red-500' : ing.currentStock <= ing.safetyThreshold ? 'text-amber-500' : 'text-text-main'}`}>
                        {ing.currentStock.toLocaleString()} {ing.unit}
                      </div>
                      <div className="text-right text-sm text-text-light">{ing.safetyThreshold} {ing.unit}</div>
                      <div><StockBadge currentStock={ing.currentStock} threshold={ing.safetyThreshold} /></div>
                      {isManager && (
                        <>
                          <div className="text-right text-sm font-semibold text-primary">₱{(ing.costPerUnit || 0).toFixed(2)}/{ing.unit}</div>
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => setAdjustTarget(ing)} className="btn-compact w-8 h-8 flex items-center justify-center rounded-lg bg-surface hover:bg-primary/10 hover:text-primary text-text-light border border-border" title="Adjust Stock">
                              <ArrowUpDown size={14} />
                            </button>
                            <button onClick={() => { setEditIngredient(ing); setShowIngredientForm(true); }}
                              className="btn-compact w-8 h-8 flex items-center justify-center rounded-lg bg-surface hover:bg-primary/10 hover:text-primary text-text-light border border-border" title="Edit">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => handleDeleteIngredient(ing)}
                              className="btn-compact w-8 h-8 flex items-center justify-center rounded-lg bg-surface hover:bg-red-500/10 hover:text-red-500 text-text-light border border-border" title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ===== RECIPES / BOM TAB ===== */}
      {activeTab === 'recipes' && isManager && (
        <div className="flex-1 bg-surface border border-border rounded-xl sm:rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-0">
          <div className="p-3 sm:p-4 bg-surface-hover border-b border-border flex-shrink-0">
            <p className="text-xs font-semibold text-text-light uppercase tracking-wider">Product Recipes / Bill of Materials</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 lg:p-4 space-y-2">
            {products.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-text-light opacity-50 py-12">
                <Beaker size={44} className="mb-2" />
                <p className="font-semibold text-sm">No products in menu</p>
              </div>
            ) : (
              products.map(prod => {
                const recipe = recipes.find(r => r.productId === prod.id);
                const hasRecipe = recipe?.ingredients?.length > 0;
                const cogs = cogsCache[prod.id];
                const cogsTotal = cogs?.totalCost || 0;
                const margin = prod.price > 0 ? ((prod.price - cogsTotal) / prod.price * 100) : 0;

                return (
                  <div key={prod.id} className="bg-background border border-border rounded-xl p-3 sm:p-4 hover:border-primary/30 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-text-main text-sm truncate">{prod.name}</h4>
                          <span className="text-[10px] font-medium text-text-light bg-surface-hover px-1.5 py-0.5 rounded">{prod.category}</span>
                          {hasRecipe ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-green-500/15 text-green-600 border border-green-500/25">Recipe Set</span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 border border-amber-500/25">No Recipe</span>
                          )}
                        </div>
                        {hasRecipe && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {recipe.ingredients.map((ri, idx) => {
                              const ing = ingredients.find(i => i.id === ri.ingredientId);
                              return (
                                <span key={idx} className="text-[10px] font-medium bg-surface-hover border border-border px-2 py-0.5 rounded-lg text-text-light">
                                  {ing?.name || `#${ri.ingredientId}`}: {ri.quantity} {ing?.unit || ''}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {hasRecipe && (
                          <div className="flex gap-4 mt-2 text-xs">
                            <span className="text-text-light">Price: <span className="font-semibold text-text-main">₱{prod.price.toFixed(2)}</span></span>
                            <span className="text-text-light">COGS: <span className="font-semibold text-red-500">₱{cogsTotal.toFixed(2)}</span></span>
                            <span className="text-text-light">Margin: <span className={`font-semibold ${margin >= 50 ? 'text-green-500' : margin >= 20 ? 'text-amber-500' : 'text-red-500'}`}>{margin.toFixed(1)}%</span></span>
                          </div>
                        )}
                      </div>
                      <button onClick={() => setRecipeTarget(prod)}
                        className="min-h-[36px] px-4 text-xs font-semibold bg-primary/10 hover:bg-primary hover:text-white text-primary rounded-lg flex items-center gap-1.5 transition-colors flex-shrink-0">
                        <Beaker size={14} /> {hasRecipe ? 'Edit Recipe' : 'Add Recipe'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ===== COGS & MARGINS TAB ===== */}
      {activeTab === 'costing' && isManager && (
        <div className="flex-1 bg-surface border border-border rounded-xl sm:rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-0">
          <div className="hidden sm:grid p-3 sm:p-4 bg-surface-hover border-b border-border grid-cols-[1fr_80px_100px_100px_80px] gap-3 font-semibold text-xs text-text-light uppercase tracking-wider flex-shrink-0">
            <div>Product</div>
            <div className="text-right">Price</div>
            <div className="text-right">COGS</div>
            <div className="text-right">Profit</div>
            <div className="text-right">Margin</div>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 lg:p-4 space-y-2">
            {products.map(prod => {
              const cogs = cogsCache[prod.id];
              const cogsTotal = cogs?.totalCost || 0;
              const profit = prod.price - cogsTotal;
              const margin = prod.price > 0 ? (profit / prod.price * 100) : 0;

              return (
                <div key={prod.id} className="bg-background border border-border rounded-xl p-3 sm:p-4 hover:border-primary/30 transition-colors">
                  {/* Mobile layout */}
                  <div className="sm:hidden">
                    <h4 className="font-semibold text-text-main text-sm mb-2">{prod.name}</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-surface rounded-lg p-2 text-center border border-border">
                        <p className="text-[9px] text-text-light font-bold uppercase">Price</p>
                        <p className="text-sm font-semibold text-text-main">₱{prod.price.toFixed(2)}</p>
                      </div>
                      <div className="bg-surface rounded-lg p-2 text-center border border-border">
                        <p className="text-[9px] text-text-light font-bold uppercase">COGS</p>
                        <p className="text-sm font-semibold text-red-500">₱{cogsTotal.toFixed(2)}</p>
                      </div>
                      <div className="bg-surface rounded-lg p-2 text-center border border-border">
                        <p className="text-[9px] text-text-light font-bold uppercase">Profit</p>
                        <p className={`text-sm font-semibold ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>₱{profit.toFixed(2)}</p>
                      </div>
                      <div className="bg-surface rounded-lg p-2 text-center border border-border">
                        <p className="text-[9px] text-text-light font-bold uppercase">Margin</p>
                        <p className={`text-sm font-semibold ${margin >= 50 ? 'text-green-500' : margin >= 20 ? 'text-amber-500' : 'text-red-500'}`}>{margin.toFixed(1)}%</p>
                      </div>
                    </div>
                    {cogs?.ingredients?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border space-y-1">
                        {cogs.ingredients.map((ci, idx) => (
                          <div key={idx} className="flex justify-between text-[11px]">
                            <span className="text-text-light">{ci.name} ({ci.quantity} {ci.unit})</span>
                            <span className="font-semibold text-text-main">₱{ci.lineCost.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Desktop layout */}
                  <div className="hidden sm:grid grid-cols-[1fr_80px_100px_100px_80px] gap-3 items-center">
                    <div className="min-w-0">
                      <p className="font-semibold text-text-main text-sm truncate">{prod.name}</p>
                      <p className="text-[10px] text-text-light">{prod.category} • {cogs?.ingredients?.length || 0} ingredients</p>
                    </div>
                    <div className="text-right font-semibold text-text-main">₱{prod.price.toFixed(2)}</div>
                    <div className="text-right font-semibold text-red-500">₱{cogsTotal.toFixed(2)}</div>
                    <div className={`text-right font-semibold ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>₱{profit.toFixed(2)}</div>
                    <div className={`text-right font-semibold ${margin >= 50 ? 'text-green-500' : margin >= 20 ? 'text-amber-500' : 'text-red-500'}`}>{margin.toFixed(1)}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== AUDIT LOG TAB ===== */}
      {activeTab === 'adjustments' && isManager && (
        <div className="flex-1 bg-surface border border-border rounded-xl sm:rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-0">
          <div className="hidden sm:grid p-3 sm:p-4 bg-surface-hover border-b border-border grid-cols-6 gap-3 font-semibold text-xs text-text-light uppercase tracking-wider flex-shrink-0">
            <div className="col-span-2">Date & Time</div>
            <div>Ingredient</div>
            <div>Change</div>
            <div>Reason</div>
            <div>Manager</div>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 lg:p-4 space-y-2">
            {adjustments.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-text-light opacity-50 py-12">
                <ClipboardList size={44} className="mb-2" />
                <p className="font-semibold text-sm">No stock adjustments recorded</p>
              </div>
            ) : (
              adjustments.map(adj => (
                <div key={adj.id} className="bg-background border border-border rounded-xl p-3 sm:p-4">
                  {/* Mobile layout */}
                  <div className="sm:hidden space-y-1">
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-text-main text-sm">{adj.ingredientName}</span>
                      <span className={`font-semibold text-sm ${adj.delta > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {adj.delta > 0 ? '+' : ''}{adj.delta}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-light">{new Date(adj.timestamp).toLocaleString()}</p>
                    <div className="flex gap-2 mt-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${adj.delta > 0 ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                        {adj.reason}
                      </span>
                      <span className="text-[10px] font-medium text-text-light">by {adj.managerName || `#${adj.managerId}`}</span>
                    </div>
                    <p className="text-[10px] text-text-light">{adj.previousStock} → {adj.newStock}</p>
                  </div>
                  {/* Desktop layout */}
                  <div className="hidden sm:grid grid-cols-6 gap-3 items-center">
                    <div className="col-span-2 text-sm font-medium text-text-light">{new Date(adj.timestamp).toLocaleString()}</div>
                    <div className="font-semibold text-text-main text-sm">{adj.ingredientName}</div>
                    <div className={`font-semibold ${adj.delta > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {adj.delta > 0 ? '+' : ''}{adj.delta} <span className="text-text-light text-xs">({adj.previousStock}→{adj.newStock})</span>
                    </div>
                    <div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${adj.delta > 0 ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                        {adj.reason}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-text-light truncate">{adj.managerName || `Manager #${adj.managerId}`}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
