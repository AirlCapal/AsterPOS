import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { PackagePlus, Trash2, Edit2, Coffee, X, Check, Plus, Image as ImageIcon, Upload, FlaskConical, Minus, Download, FileUp, AlertTriangle, Layers } from 'lucide-react';
import ExcelJS from 'exceljs';
import BulkCatalogManager from './BulkCatalogManager';

// --- Confirm Dialog ---
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

// --- Toast ---
const Toast = ({ message, isVisible, type = 'success' }) => {
  if (!isVisible) return null;
  const bgClass = type === 'error' ? 'bg-red-500' : 'bg-green-500';
  return (
    <div className={`fixed top-4 right-4 z-[70] ${bgClass} text-white px-5 py-3 rounded-xl font-semibold text-sm shadow-xl flex items-center gap-2 animate-in`}>
      {type === 'error' ? <X size={16} /> : <Check size={16} />} {message}
    </div>
  );
};

// --- Recipe Row ---
const RecipeRow = ({ entry, ingredients, onChange, onRemove }) => {
  const ingredient = ingredients.find(i => i.id === entry.ingredientId);
  return (
    <div className="flex items-center gap-2 bg-background border border-border rounded-lg p-2">
      <select
        value={entry.ingredientId || ''}
        onChange={e => onChange({ ...entry, ingredientId: parseInt(e.target.value) })}
        className="flex-1 h-9 px-2 bg-surface border border-border rounded-lg text-sm text-text-main min-w-0"
      >
        <option value="">Select ingredient...</option>
        {ingredients.map(ing => (
          <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
        ))}
      </select>
      <input
        type="number"
        value={entry.quantity}
        onChange={e => onChange({ ...entry, quantity: parseFloat(e.target.value) || 0 })}
        className="w-20 h-9 px-2 bg-surface border border-border rounded-lg text-sm text-text-main text-center"
        placeholder="Qty"
        min="0"
        step="any"
      />
      {ingredient && (
        <span className="text-[10px] text-text-light font-medium w-8 text-center flex-shrink-0">{ingredient.unit}</span>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 hover:text-red-500 text-text-light transition-colors flex-shrink-0"
      >
        <Minus size={14} />
      </button>
    </div>
  );
};

export default function MenuManager() {
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const dbCategories = useLiveQuery(() => db.categories.where('status').equals('Active').toArray()) || [];
  const ingredients = useLiveQuery(() => db.ingredients.toArray()) || [];
  const recipes = useLiveQuery(() => db.recipes.toArray()) || [];

  const [formData, setFormData] = useState({ id: null, name: '', category: '', price: '', options: [], image: '' });
  const [recipeEntries, setRecipeEntries] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showBulkManager, setShowBulkManager] = useState(false);
  
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, variant: 'primary' });
  const [toastConfig, setToastConfig] = useState({ isVisible: false, message: '', type: 'success' });

  // Default to first active category
  useEffect(() => {
    if (dbCategories.length > 0 && !formData.category && !formData.id) {
      setFormData(prev => ({ ...prev, category: dbCategories[0].name }));
    }
  }, [dbCategories, formData.category, formData.id]);

  const flash = (message, type = 'success') => {
    setToastConfig({ isVisible: true, message, type });
    setTimeout(() => setToastConfig({ isVisible: false, message: '', type: 'success' }), 2500);
  };

  const showConfirm = (title, message, onConfirm, variant = 'primary') => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, variant });
  };

  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.price) {
      return flash('Please fill name and price.', 'error');
    }

    // Validate recipe entries — no duplicate ingredients, no empty selections
    const validRecipe = recipeEntries.filter(r => r.ingredientId && r.quantity > 0);
    const ingredientIds = validRecipe.map(r => r.ingredientId);
    if (new Set(ingredientIds).size !== ingredientIds.length) {
      return flash('Duplicate ingredients in recipe. Remove duplicates.', 'error');
    }
    
    const actionText = formData.id ? 'update' : 'add';
    
    showConfirm('Confirm Action', `Are you sure you want to ${actionText} ${formData.name}?`, async () => {
      closeConfirm();
      let productId = formData.id;

      if (formData.id) {
        await db.products.update(formData.id, {
          name: formData.name,
          category: formData.category,
          price: parseFloat(formData.price),
          options: formData.options,
          image: formData.image
        });
        flash('Product updated successfully');
      } else {
        productId = await db.products.add({
          name: formData.name,
          category: formData.category,
          price: parseFloat(formData.price),
          options: formData.options,
          image: formData.image,
          isAvailable: true
        });
        flash('Product added successfully');
      }

      // Save recipe
      if (productId) {
        const existingRecipe = await db.recipes.where('productId').equals(productId).first();
        if (validRecipe.length > 0) {
          if (existingRecipe) {
            await db.recipes.update(existingRecipe.id, { ingredients: validRecipe });
          } else {
            await db.recipes.add({ productId, ingredients: validRecipe });
          }
        } else if (existingRecipe) {
          // Remove recipe if all entries were cleared
          await db.recipes.delete(existingRecipe.id);
        }
      }

      setFormData({ id: null, name: '', category: dbCategories[0]?.name || '', price: '', options: [], image: '' });
      setRecipeEntries([]);
      setShowForm(false);
    });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
         return flash('Image must be less than 2MB', 'error');
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEdit = async (prod) => {
    setFormData({ id: prod.id, name: prod.name, category: prod.category, price: prod.price, options: prod.options || [], image: prod.image || '' });
    // Load existing recipe
    const recipe = await db.recipes.where('productId').equals(prod.id).first();
    setRecipeEntries(recipe?.ingredients || []);
    setShowForm(true);
  };

  const handleDelete = (id, name) => {
    showConfirm('Delete Product', `Delete ${name} from the menu? Its recipe will also be removed.`, async () => {
      closeConfirm();
      await db.products.delete(id);
      // Also delete associated recipe
      const recipe = await db.recipes.where('productId').equals(id).first();
      if (recipe) await db.recipes.delete(recipe.id);
      flash('Product deleted');
    }, 'danger');
  };

  const handleCancel = () => {
    setFormData({ id: null, name: '', category: dbCategories[0]?.name || '', price: '', options: [], image: '' });
    setRecipeEntries([]);
    setShowForm(false);
  };

  const addRecipeRow = () => {
    setRecipeEntries([...recipeEntries, { ingredientId: '', quantity: 0 }]);
  };

  const updateRecipeRow = (idx, updated) => {
    const next = [...recipeEntries];
    next[idx] = updated;
    setRecipeEntries(next);
  };

  const removeRecipeRow = (idx) => {
    setRecipeEntries(recipeEntries.filter((_, i) => i !== idx));
  };

  // Helper: get recipe ingredient count for a product
  const getRecipeCount = (productId) => {
    const recipe = recipes.find(r => r.productId === productId);
    return recipe?.ingredients?.length || 0;
  };

  // === BULK EXPORT/IMPORT ===
  // Handled by BulkCatalogManager

  // Shared form content (used in both mobile and desktop)
  const FormFields = () => (
    <>
      <div>
        <label className="block text-sm font-semibold text-text-light mb-1">Product Name</label>
        <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required className="h-12 w-full px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main" placeholder="e.g. Spanish Latte" maxLength={80} />
      </div>
      <div>
        <label className="block text-sm font-semibold text-text-light mb-1">Category</label>
        <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="h-12 w-full px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main">
          {dbCategories.map(c => <option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-text-light mb-1">Base Price (₱)</label>
        <input type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} required className="h-12 w-full px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main" placeholder="0.00" min="0" step="0.01" />
      </div>
      <div>
        <label className="block text-sm font-semibold text-text-light mb-1">Product Image</label>
        <div className="flex items-center gap-3">
          {formData.image ? (
            <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-border flex-shrink-0">
              <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setFormData({...formData, image: ''})} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 shadow">
                <X size={12} />
              </button>
            </div>
          ) : (
            <div className="w-16 h-16 rounded-xl bg-surface-hover border border-border border-dashed flex items-center justify-center text-text-light flex-shrink-0">
              <ImageIcon size={20} />
            </div>
          )}
          <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 h-12 bg-surface-hover hover:bg-border border border-border text-text-main rounded-xl font-semibold transition-colors text-sm">
            <Upload size={16} /> <span className="truncate">{formData.image ? 'Change' : 'Upload'}</span>
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* === RECIPE SECTION === */}
      <div id="menu-recipe-section" className="border-t border-border pt-4 mt-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FlaskConical size={16} className="text-primary" />
            <label className="text-sm font-semibold text-text-main">Recipe / Ingredients</label>
          </div>
          <button
            type="button"
            onClick={addRecipeRow}
            disabled={ingredients.length === 0}
            className="min-h-[32px] px-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg font-semibold text-xs flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={13} /> Add
          </button>
        </div>

        {ingredients.length === 0 ? (
          <p className="text-xs text-text-light bg-background border border-border rounded-lg p-3 text-center">
            No ingredients in inventory yet. Add ingredients in the Inventory module first.
          </p>
        ) : recipeEntries.length === 0 ? (
          <p className="text-xs text-text-light bg-background border border-border rounded-lg p-3 text-center">
            No recipe configured. Tap "Add" to link raw ingredients for auto-deduction on checkout.
          </p>
        ) : (
          <div className="space-y-2">
            {recipeEntries.map((entry, idx) => (
              <RecipeRow
                key={idx}
                entry={entry}
                ingredients={ingredients}
                onChange={(updated) => updateRecipeRow(idx, updated)}
                onRemove={() => removeRecipeRow(idx)}
              />
            ))}
            {/* COGS preview */}
            {recipeEntries.some(r => r.ingredientId && r.quantity > 0) && (
              <div className="flex justify-between items-center px-2 pt-1">
                <span className="text-[11px] text-text-light font-medium">Est. Ingredient Cost:</span>
                <span className="text-xs font-semibold text-text-main">
                  ₱{recipeEntries.reduce((sum, r) => {
                    const ing = ingredients.find(i => i.id === r.ingredientId);
                    return sum + ((ing?.costPerUnit || 0) * (r.quantity || 0));
                  }, 0).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="p-3 sm:p-5 lg:p-8 h-full flex flex-col bg-background overflow-hidden relative">
      <Toast {...toastConfig} />
      <ConfirmDialog {...confirmDialog} onCancel={closeConfirm} />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 sm:mb-6 lg:mb-8 flex-shrink-0">
        <div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-text-main">Menu Manager</h2>
          <p className="text-text-light font-medium text-sm">Add, edit, or remove products</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button id="menu-bulk-btn" onClick={() => setShowBulkManager(true)} className="min-h-[40px] sm:min-h-[44px] px-3 sm:px-4 bg-surface hover:bg-surface-hover text-text-main border border-border rounded-xl font-semibold flex items-center gap-2 transition-all active:scale-95 text-sm">
            <Layers size={18} /> <span className="hidden sm:inline">Bulk Catalog</span>
          </button>
          <button id="menu-add-btn" onClick={() => { setRecipeEntries([]); setShowForm(true); }} className="min-h-[40px] sm:min-h-[44px] px-4 sm:px-6 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold flex items-center gap-2 shadow-lg transition-all active:scale-95 text-sm sm:text-base">
            <PackagePlus size={18} /> <span className="hidden sm:inline">Add Product</span><span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Bulk Catalog Manager Modal */}
      {showBulkManager && (
        <BulkCatalogManager 
           onClose={() => setShowBulkManager(false)}
           onComplete={() => {
             setShowBulkManager(false);
             flash('Bulk import successful!');
           }}
        />
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-8 overflow-hidden min-h-0">

        {/* Form - Mobile: Modal Overlay / Desktop: Side Panel */}
        {showForm && (
          <>
            {/* Mobile overlay */}
            <div className="lg:hidden fixed inset-0 z-40 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={handleCancel}>
              <div className="bg-surface rounded-t-3xl shadow-2xl w-full max-h-[85vh] overflow-y-auto animate-in" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <h3 className="text-lg font-semibold text-text-main flex items-center gap-2">
                    <PackagePlus size={20} /> {formData.id ? 'Edit Product' : 'Add New Product'}
                  </h3>
                  <button onClick={handleCancel} className="p-2 hover:bg-border rounded-full"><X size={20} className="text-text-light" /></button>
                </div>
                <form onSubmit={handleSave} className="p-4 space-y-4 safe-bottom">
                  <FormFields />
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={handleCancel} className="flex-1 h-12 bg-surface-hover hover:bg-border border border-border text-text-main rounded-xl font-semibold transition-all">Cancel</button>
                    <button type="submit" className="flex-1 h-12 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"><Check size={18} /> {formData.id ? 'Update' : 'Save'}</button>
                  </div>
                </form>
              </div>
            </div>

            {/* Desktop side panel */}
            <div className="hidden lg:block w-[400px] bg-surface p-6 rounded-2xl border border-border flex-shrink-0 overflow-y-auto shadow-sm">
              <h3 className="text-xl font-semibold text-text-main mb-6 flex items-center gap-2">
                <PackagePlus size={22} /> {formData.id ? 'Edit Product' : 'Add New Product'}
              </h3>
              <form onSubmit={handleSave} className="space-y-4">
                <FormFields />
                <div className="pt-4 flex gap-2">
                  <button type="button" onClick={handleCancel} className="flex-1 h-12 bg-surface-hover hover:bg-border border border-border text-text-main rounded-xl font-semibold transition-all">Cancel</button>
                  <button type="submit" className="flex-1 h-12 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold shadow-lg transition-all">{formData.id ? 'Update' : 'Save Product'}</button>
                </div>
              </form>
            </div>
          </>
        )}

        {/* Product List */}
        <div className="flex-1 bg-surface rounded-xl sm:rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden min-h-0">
          {/* Table header - desktop */}
          <div className="hidden sm:grid p-3 sm:p-4 bg-surface-hover border-b border-border grid-cols-12 gap-3 font-semibold text-xs text-text-light uppercase tracking-wider">
            <div className="col-span-4">Product</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-2">Price</div>
            <div className="col-span-2">Recipe</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 lg:p-4 space-y-1.5 sm:space-y-2">
            {products.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-text-light opacity-50 py-12">
                <Coffee size={44} className="mb-2" />
                <p className="font-semibold text-sm">No products in menu</p>
                <p className="text-xs mt-1">Tap "Add Product" to get started</p>
              </div>
            ) : (
              products.map(prod => {
                const recipeCount = getRecipeCount(prod.id);
                return (
                  <div key={prod.id} className="bg-background border border-border rounded-lg sm:rounded-xl p-3 sm:p-4 hover:border-primary/30 transition-colors">
                    {/* Mobile layout */}
                    <div className="sm:hidden flex justify-between items-center">
                      <div className="flex-1 min-w-0 mr-3">
                        <h4 className="font-semibold text-text-main text-sm truncate">{prod.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-medium text-text-light">{prod.category}</span>
                          <span className="font-semibold text-primary text-sm">₱{prod.price.toFixed(2)}</span>
                          {recipeCount > 0 && (
                            <span className="text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <FlaskConical size={9} /> {recipeCount}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => handleEdit(prod)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface hover:bg-primary/10 hover:text-primary text-text-light border border-border"><Edit2 size={15} /></button>
                        <button onClick={() => handleDelete(prod.id, prod.name)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface hover:bg-red-500/10 hover:text-red-500 text-text-light border border-border"><Trash2 size={15} /></button>
                      </div>
                    </div>
                    {/* Desktop layout */}
                    <div className="hidden sm:grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-4 font-semibold text-text-main text-sm flex items-center gap-3">
                        {prod.image ? (
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-border flex-shrink-0">
                            <img src={prod.image} alt={prod.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-surface-hover border border-border flex items-center justify-center text-text-light flex-shrink-0">
                            <Coffee size={16} />
                          </div>
                        )}
                        <span className="truncate">{prod.name}</span>
                      </div>
                      <div className="col-span-2 text-sm font-medium text-text-light">{prod.category}</div>
                      <div className="col-span-2 font-semibold text-primary">₱{prod.price.toFixed(2)}</div>
                      <div className="col-span-2">
                        {recipeCount > 0 ? (
                          <span className="text-[11px] font-semibold bg-primary/10 text-primary px-2 py-1 rounded-lg flex items-center gap-1 w-fit">
                            <FlaskConical size={12} /> {recipeCount} ingredient{recipeCount !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-[11px] text-text-light opacity-50">No recipe</span>
                        )}
                      </div>
                      <div className="col-span-2 flex justify-end gap-2">
                        <button onClick={() => handleEdit(prod)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface hover:bg-primary/10 hover:text-primary text-text-light border border-border"><Edit2 size={15} /></button>
                        <button onClick={() => handleDelete(prod.id, prod.name)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface hover:bg-red-500/10 hover:text-red-500 text-text-light border border-border"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
