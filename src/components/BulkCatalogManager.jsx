import React, { useState, useEffect, useRef } from 'react';
import ExcelJS from 'exceljs';
import { db } from '../db';
import { X, Upload, Download, Check, AlertTriangle, FileUp, Edit2 } from 'lucide-react';
import { downloadOrShareFile } from '../utils/fileDownloader';

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
const HEADER_FONT = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11, name: 'Segoe UI' };
const BORDER_STYLE = {
  top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
};

export default function BulkCatalogManager({ onClose, onComplete, initialStep = 'upload' }) {
  const [step, setStep] = useState(initialStep); // 'upload' | 'staging' | 'importing'
  const [stagedIngredients, setStagedIngredients] = useState([]);
  const [stagedProducts, setStagedProducts] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    db.ingredients.toArray().then(setInventoryList);
  }, []);

  const autoFitColumns = (sheet, columns) => {
    columns.forEach((col, idx) => {
      let maxLen = col.header.length;
      sheet.getColumn(idx + 1).eachCell({ includeEmpty: true }, (cell) => {
        if (cell.value) {
          const text = cell.value.toString();
          if (text.length > maxLen) maxLen = text.length;
        }
      });
      sheet.getColumn(idx + 1).width = Math.max(15, maxLen + 4);
    });
  };

  const styleSheet = (sheet, columns) => {
    sheet.getRow(1).height = 28;
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    sheet.columns = columns;

    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        cell.border = BORDER_STYLE;
        if (rowNumber === 1) {
          cell.fill = HEADER_FILL;
          cell.font = HEADER_FONT;
        } else {
          // Zebra striping
          if (rowNumber % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          }
          const colDef = columns[colNumber - 1];
          if (colDef.alignment) cell.alignment = colDef.alignment;
          if (colDef.numFmt) cell.numFmt = colDef.numFmt;
          
          if (colDef.key === 'recipe_mapping') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            cell.font = { name: 'Courier New', size: 10 };
          }
        }
      });
    });
    autoFitColumns(sheet, columns);
  };

  const handleExport = async (isTemplate = false) => {
    const workbook = new ExcelJS.Workbook();
    
    // Validation Lists
    const CATEGORIES = '"Coffee,Non-Coffee,Tea,Dairy,Syrup & Flavors,Pastries,Meals,Packaging,Supplies,Other"';
    const UNITS = '"g,ml,pcs,kg,L,oz,shots,can,box"';

    // 1. Raw Inventory Sheet
    const invSheet = workbook.addWorksheet('Raw_Inventory');
    const invCols = [
      { header: 'Item Barcode / SKU *', key: 'sku', alignment: { horizontal: 'center' } },
      { header: 'Ingredient Name *', key: 'name', alignment: { horizontal: 'left' } },
      { header: 'Category *', key: 'category', alignment: { horizontal: 'left' } },
      { header: 'Current Stock Count *', key: 'currentStock', alignment: { horizontal: 'right' }, numFmt: '#,##0.00' },
      { header: 'Unit of Measurement *', key: 'unit', alignment: { horizontal: 'center' } },
      { header: 'Low Stock Alert Limit *', key: 'safetyThreshold', alignment: { horizontal: 'right' }, numFmt: '#,##0.00' },
      { header: 'Unit Cost Price *', key: 'costPerUnit', alignment: { horizontal: 'right' }, numFmt: '₱#,##0.00' }
    ];
    
    if (isTemplate) {
      invSheet.columns = invCols;
      invSheet.addRow({ sku: 'ING-BEANS', name: 'Espresso Beans', category: 'Coffee', currentStock: 5000, unit: 'g', safetyThreshold: 1000, costPerUnit: 1.5 });
      invSheet.addRow({ sku: 'ING-MILK', name: 'Whole Milk', category: 'Dairy', currentStock: 10000, unit: 'ml', safetyThreshold: 2000, costPerUnit: 0.1 });
      invSheet.addRow({ sku: 'ING-CUP16', name: '16oz Cup', category: 'Packaging', currentStock: 500, unit: 'pcs', safetyThreshold: 100, costPerUnit: 3.5 });
    } else {
      const inventory = await db.ingredients.toArray();
      invSheet.columns = invCols;
      inventory.forEach(ing => {
        invSheet.addRow({
          sku: ing.sku || `ING-${ing.id}`,
          name: ing.name,
          category: ing.category || 'Uncategorized',
          currentStock: ing.currentStock || 0,
          unit: ing.unit,
          safetyThreshold: ing.safetyThreshold || 0,
          costPerUnit: ing.costPerUnit || 0
        });
      });
    }
    styleSheet(invSheet, invCols);
    
    // Add Data Validation
    invSheet.dataValidations.add('C2:C500', { type: 'list', allowBlank: true, formulae: [CATEGORIES] });
    invSheet.dataValidations.add('E2:E500', { type: 'list', allowBlank: true, formulae: [UNITS] });

    // 2. Menu Products Sheet
    const prodSheet = workbook.addWorksheet('Menu_Products');
    const prodCols = [
      { header: 'Product Barcode / SKU *', key: 'sku', alignment: { horizontal: 'center' } },
      { header: 'Product Name *', key: 'name', alignment: { horizontal: 'left' } },
      { header: 'Category *', key: 'category', alignment: { horizontal: 'left' } },
      { header: 'Selling Price *', key: 'price', alignment: { horizontal: 'right' }, numFmt: '₱#,##0.00' }
    ];

    let inventoryRef = [];
    if (isTemplate) {
      inventoryRef = [
        { sku: 'ING-BEANS', name: 'Espresso Beans', unit: 'g' },
        { sku: 'ING-MILK', name: 'Whole Milk', unit: 'ml' },
        { sku: 'ING-CUP16', name: '16oz Cup', unit: 'pcs' }
      ];
    } else {
      inventoryRef = await db.ingredients.toArray();
    }

    // Append dynamic ingredient columns
    inventoryRef.forEach(ing => {
       prodCols.push({
          header: `${ing.name} (${ing.unit})`,
          key: `ing_${ing.sku || ing.id}`,
          alignment: { horizontal: 'center' },
          numFmt: '#,##0.00'
       });
    });
    
    prodSheet.columns = prodCols;
    
    if (isTemplate) {
      prodSheet.addRow({ sku: 'PRD-LATTE-ICED', name: 'Iced Latte', category: 'Coffee', price: 150, 'ing_ING-BEANS': 18, 'ing_ING-MILK': 200, 'ing_ING-CUP16': 1 });
      prodSheet.addRow({ sku: 'PRD-VAN-16', name: 'Vanilla Latte 16oz', category: 'Coffee', price: 155, 'ing_ING-BEANS': 18, 'ing_ING-MILK': 200, 'ing_ING-CUP16': 1 });
    } else {
      const products = await db.products.toArray();
      const recipes = await db.recipes.toArray();
      
      products.forEach(prod => {
        const recipe = recipes.find(r => r.productId === prod.id);
        const rowData = {
          sku: `PRD-${prod.id}`,
          name: prod.name,
          category: prod.category,
          price: prod.price
        };

        if (recipe && recipe.ingredients) {
          recipe.ingredients.forEach(ri => {
            const ing = inventoryRef.find(i => i.id === ri.ingredientId);
            if (ing) {
               rowData[`ing_${ing.sku || ing.id}`] = ri.quantity;
            }
          });
        }
        prodSheet.addRow(rowData);
      });
    }

    styleSheet(prodSheet, prodCols);
    
    // Freeze Row 1 and Cols A-D
    prodSheet.views = [{ state: 'frozen', xSplit: 4, ySplit: 1 }];

    // Style dynamic headers
    prodSheet.getRow(1).eachCell((cell, colNumber) => {
      if (colNumber > 4) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      }
    });
    
    // Add Category Data Validation
    prodSheet.dataValidations.add('C2:C500', { type: 'list', allowBlank: true, formulae: [CATEGORIES] });
    
    // Add Data Validation for dynamic columns (numeric > 0)
    if (prodCols.length > 4) {
       const startCol = prodSheet.getColumn(5).letter;
       const endCol = prodSheet.getColumn(prodCols.length).letter;
       prodSheet.dataValidations.add(`${startCol}2:${endCol}500`, {
         type: 'decimal',
         operator: 'greaterThanOrEqual',
         formulae: [0],
         allowBlank: true,
         showErrorMessage: true,
         errorStyle: 'stop',
         errorTitle: 'Invalid Quantity',
         error: 'Quantity must be a positive number.'
       });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = isTemplate ? 'aster_pos_bulk_template.xlsx' : `aster_catalog_${new Date().toISOString().split('T')[0]}.xlsx`;
    await downloadOrShareFile({
      fileName,
      data: buffer,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      shareTitle: isTemplate ? 'Aster Catalog Template' : 'Aster Catalog Export',
      shareText: isTemplate ? 'Aster POS Excel template' : 'Aster POS Catalog Export'
    });
  };

  const parseNumber = (val) => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    return parseFloat(val.toString().replace(/[^0-9.-]+/g, '')) || 0;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      
      const invSheet = workbook.getWorksheet('Raw_Inventory');
      const prodSheet = workbook.getWorksheet('Menu_Products');
      
      if (!invSheet && !prodSheet) {
        alert('Invalid file format. Ensure worksheets are named Raw_Inventory and Menu_Products.');
        return;
      }

      const parsedIngredients = [];
      const parsedProducts = [];

      // Parse Raw_Inventory
      if (invSheet) {
        const headers = {};
        invSheet.getRow(1).eachCell((cell, c) => {
          const h = cell.value?.toString().toLowerCase().replace(/\*/g, '').trim();
          if (h) headers[h] = c;
        });
        
        // Map human-friendly keys or fallback to old keys
        const kSku = headers['item barcode / sku'] || headers['ingredient_sku'] || headers['sku'];
        const kName = headers['ingredient name'] || headers['ingredient_name'] || headers['name'];
        const kCat = headers['category'];
        const kStock = headers['current stock count'] || headers['current_stock'] || headers['stock'];
        const kUnit = headers['unit of measurement'] || headers['unit'];
        const kMin = headers['low stock alert limit'] || headers['min_stock_threshold'] || headers['min'];
        const kCost = headers['unit cost price'] || headers['cost_per_unit'] || headers['cost'];

        invSheet.eachRow((row, r) => {
          if (r === 1) return;
          const name = row.getCell(kName)?.value?.toString().trim();
          if (!name) return;
          
          parsedIngredients.push({
            _rowId: r,
            sku: row.getCell(kSku)?.value?.toString().trim() || '',
            name,
            category: row.getCell(kCat)?.value?.toString().trim() || 'Uncategorized',
            currentStock: parseNumber(row.getCell(kStock)?.value),
            unit: row.getCell(kUnit)?.value?.toString().trim() || 'pcs',
            safetyThreshold: parseNumber(row.getCell(kMin)?.value),
            costPerUnit: parseNumber(row.getCell(kCost)?.value),
            error: null
          });
        });
      }

      // Parse Menu_Products
      const futureInventory = [...inventoryList, ...parsedIngredients];
      let hasErrors = false;

      if (prodSheet) {
        const headers = {};
        const dynamicCols = {}; // colNumber -> ingredientName
        
        prodSheet.getRow(1).eachCell((cell, c) => {
          const rawH = cell.value?.toString().trim() || '';
          const h = rawH.toLowerCase().replace(/\*/g, '').trim();
          if (h) headers[h] = c;
          
          if (c > 4 && rawH) {
             // Parse out "Ingredient Name (unit)"
             const match = rawH.match(/^(.*?)\s*(?:\((.*?)\))?$/);
             if (match && match[1]) {
                 dynamicCols[c] = match[1].trim();
             }
          }
        });

        const kSku = headers['product barcode / sku'] || headers['product_sku'] || headers['sku'];
        const kName = headers['product name'] || headers['product_name'] || headers['name'];
        const kCat = headers['category'];
        const kPrice = headers['selling price'] || headers['selling_price'] || headers['price'];

        prodSheet.eachRow((row, r) => {
          if (r === 1) return;
          const name = row.getCell(kName)?.value?.toString().trim();
          const price = parseNumber(row.getCell(kPrice)?.value);
          if (!name) return;

          const parsedRecipe = [];
          let rowError = null;
          
          // Iterate dynamic columns for recipes
          Object.keys(dynamicCols).forEach(colIdx => {
             const val = row.getCell(parseInt(colIdx)).value;
             if (val !== null && val !== undefined && val !== '') {
                 const qty = parseNumber(val);
                 if (qty > 0) {
                     const targetName = dynamicCols[colIdx];
                     // Match against future inventory
                     const match = futureInventory.find(i => i.name.toLowerCase() === targetName.toLowerCase());
                     if (match) {
                        parsedRecipe.push({ targetId: match.id || 'NEW_ROW_' + match._rowId, quantity: qty, refName: match.name, rawText: `${qty}` });
                     } else {
                        parsedRecipe.push({ targetId: null, quantity: qty, refName: targetName, rawText: `${qty}` });
                        rowError = true;
                        hasErrors = true;
                     }
                 }
             }
          });
          
          parsedProducts.push({
            _rowId: r,
            sku: row.getCell(kSku)?.value?.toString().trim() || '',
            name,
            category: row.getCell(kCat)?.value?.toString().trim() || 'Uncategorized',
            price,
            parsedRecipe,
            error: rowError
          });
        });
      }

      setStagedIngredients(parsedIngredients);
      setStagedProducts(parsedProducts);
      setStep('staging');

    } catch (err) {
      alert('Error reading Excel: ' + err.message);
    }
  };

  const handleFixMapping = (prodIndex, recipeIndex, newIngredientId) => {
    const nextProd = [...stagedProducts];
    const prod = nextProd[prodIndex];
    if (newIngredientId === 'REMOVE') {
       prod.parsedRecipe.splice(recipeIndex, 1);
    } else {
       const ing = inventoryList.find(i => i.id === parseInt(newIngredientId));
       if (ing) {
          prod.parsedRecipe[recipeIndex].targetId = ing.id;
          prod.parsedRecipe[recipeIndex].refName = ing.name;
       }
    }
    
    // Re-evaluate errors
    prod.error = prod.parsedRecipe.some(r => r.targetId === null);
    setStagedProducts(nextProd);
  };

  const handleCommit = async () => {
    setStep('importing');
    
    // 1. Process Raw_Inventory (Upsert)
    const idMap = {}; // Maps 'NEW_ROW_X' to inserted DB id
    for (const ing of stagedIngredients) {
      let existing = null;
      if (ing.sku) existing = await db.ingredients.where('sku').equalsIgnoreCase(ing.sku).first();
      if (!existing) existing = await db.ingredients.where('name').equalsIgnoreCase(ing.name).first();
      
      let finalId;
      if (existing) {
         await db.ingredients.update(existing.id, {
           currentStock: existing.currentStock + ing.currentStock,
           costPerUnit: ing.costPerUnit,
           safetyThreshold: ing.safetyThreshold
         });
         finalId = existing.id;
      } else {
         finalId = await db.ingredients.add({
           sku: ing.sku, name: ing.name, category: ing.category,
           currentStock: ing.currentStock, unit: ing.unit,
           safetyThreshold: ing.safetyThreshold, costPerUnit: ing.costPerUnit
         });
      }
      idMap[`NEW_ROW_${ing._rowId}`] = finalId;
    }

    // 2. Process Menu_Products
    for (const prod of stagedProducts) {
       let existing = await db.products.where('name').equalsIgnoreCase(prod.name).first();
       let productId;
       if (existing) {
          await db.products.update(existing.id, { price: prod.price, category: prod.category });
          productId = existing.id;
       } else {
          productId = await db.products.add({ name: prod.name, price: prod.price, category: prod.category, isAvailable: true, options: [], image: '' });
       }

       if (prod.parsedRecipe.length > 0) {
          const finalIngredients = prod.parsedRecipe.map(pr => ({
             ingredientId: typeof pr.targetId === 'string' && pr.targetId.startsWith('NEW') ? idMap[pr.targetId] : pr.targetId,
             quantity: pr.quantity
          }));
          const existingRecipe = await db.recipes.where('productId').equals(productId).first();
          if (existingRecipe) {
             await db.recipes.update(existingRecipe.id, { ingredients: finalIngredients });
          } else {
             await db.recipes.add({ productId, ingredients: finalIngredients });
          }
       }
    }

    onComplete();
  };

  const hasErrors = stagedProducts.some(p => p.error) || stagedIngredients.some(i => i.error);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6">
      <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-surface-hover flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/15 text-primary rounded-xl flex items-center justify-center">
              <Upload size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-main">Bulk Catalog Import</h2>
              <p className="text-xs text-text-light">Excel (.xlsx) Inventory & Menu Sync</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-border rounded-full transition-colors">
            <X size={20} className="text-text-light" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col bg-background">
          {step === 'upload' && (
            <div className="p-8 flex flex-col items-center justify-center h-full text-center space-y-6">
              <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                <FileUp size={48} />
              </div>
              <div className="max-w-md">
                <h3 className="text-xl font-semibold text-text-main mb-2">Upload Excel Catalog</h3>
                <p className="text-sm text-text-light leading-relaxed mb-6">
                  Upload a formatted Excel workbook with <code>Raw_Inventory</code> and <code>Menu_Products</code> worksheets.
                </p>
                <div className="flex flex-col gap-3">
                  <label className="cursor-pointer min-h-[52px] w-full bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95">
                    <Upload size={18} /> Select .xlsx File
                    <input type="file" accept=".xlsx" onChange={handleFileUpload} ref={fileInputRef} className="hidden" />
                  </label>
                  <button onClick={() => handleExport(true)} className="min-h-[52px] w-full bg-surface-hover border border-border hover:bg-border text-text-main rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors">
                    <Download size={18} /> Download Blank Template
                  </button>
                  <button onClick={() => handleExport(false)} className="min-h-[52px] w-full bg-surface-hover border border-border hover:bg-border text-text-main rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors mt-2">
                    <Download size={18} /> Export Current Catalog
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'staging' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-text-main">Pre-Import Staging</h3>
                  <p className="text-sm text-text-light">Review data and resolve mapping errors before committing.</p>
                </div>
                {hasErrors && (
                  <div className="flex items-center gap-2 bg-red-500/10 text-red-500 px-3 py-1.5 rounded-lg text-sm font-semibold">
                    <AlertTriangle size={16} /> Resolve Errors to Continue
                  </div>
                )}
              </div>

              {/* Raw Inventory Preview */}
              {stagedIngredients.length > 0 && (
                <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-surface-hover px-4 py-3 border-b border-border">
                    <h4 className="font-semibold text-sm text-text-main">Raw Inventory ({stagedIngredients.length} Items to Upsert)</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-surface text-text-light text-xs font-semibold">
                        <tr>
                          <th className="px-4 py-2 border-b border-border">SKU</th>
                          <th className="px-4 py-2 border-b border-border">Name</th>
                          <th className="px-4 py-2 border-b border-border">Category</th>
                          <th className="px-4 py-2 border-b border-border text-right">Stock</th>
                          <th className="px-4 py-2 border-b border-border text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-text-main font-medium">
                        {stagedIngredients.slice(0, 5).map((ing, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2">{ing.sku || '-'}</td>
                            <td className="px-4 py-2">{ing.name}</td>
                            <td className="px-4 py-2 text-text-light">{ing.category}</td>
                            <td className="px-4 py-2 text-right">{ing.currentStock} {ing.unit}</td>
                            <td className="px-4 py-2 text-right">₱{ing.costPerUnit.toFixed(2)}</td>
                          </tr>
                        ))}
                        {stagedIngredients.length > 5 && (
                          <tr><td colSpan={5} className="px-4 py-2 text-center text-xs text-text-light italic bg-surface-hover">...and {stagedIngredients.length - 5} more</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Menu Products Staging */}
              {stagedProducts.length > 0 && (
                <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-surface-hover px-4 py-3 border-b border-border">
                    <h4 className="font-semibold text-sm text-text-main">Menu Products & Recipes ({stagedProducts.length} Items)</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-surface text-text-light text-xs font-semibold">
                        <tr>
                          <th className="px-4 py-2 border-b border-border">Status</th>
                          <th className="px-4 py-2 border-b border-border">Product Name</th>
                          <th className="px-4 py-2 border-b border-border text-right">Price</th>
                          <th className="px-4 py-2 border-b border-border">Recipe Mapping</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-text-main font-medium">
                        {stagedProducts.map((prod, i) => (
                          <tr key={i} className={prod.error ? 'bg-red-500/5' : ''}>
                            <td className="px-4 py-2">
                              {prod.error ? (
                                <span className="inline-flex items-center gap-1 text-red-500 text-[11px] font-bold bg-red-500/10 px-2 py-1 rounded-md">
                                  <AlertTriangle size={12} /> ERROR
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-green-500 text-[11px] font-bold bg-green-500/10 px-2 py-1 rounded-md">
                                  <Check size={12} /> VALID
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2">
                               {prod.name}
                            </td>
                            <td className="px-4 py-2 text-right">₱{prod.price.toFixed(2)}</td>
                            <td className="px-4 py-2">
                               <div className="flex flex-col gap-2">
                                 {prod.parsedRecipe.map((r, ri) => (
                                    <div key={ri} className="flex items-center gap-2">
                                      {r.targetId ? (
                                        <span className="text-[10px] bg-surface-hover px-2 py-1 rounded font-mono text-text-light">{r.refName} : {r.quantity}</span>
                                      ) : (
                                        <div className="flex items-center gap-2 bg-red-500/10 p-1.5 rounded-lg border border-red-500/20">
                                          <span className="text-[10px] font-bold text-red-500">Unmapped: {r.refName}</span>
                                          <select 
                                            onChange={(e) => handleFixMapping(i, ri, e.target.value)}
                                            className="text-xs bg-surface border border-border rounded px-1 py-0.5 text-text-main w-32"
                                            defaultValue=""
                                          >
                                            <option value="" disabled>Map to Inventory...</option>
                                            {inventoryList.map(inv => (
                                              <option key={inv.id} value={inv.id}>{inv.name}</option>
                                            ))}
                                            <option value="REMOVE">-- Remove --</option>
                                          </select>
                                        </div>
                                      )}
                                    </div>
                                 ))}
                               </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}
          
          {step === 'importing' && (
             <div className="p-8 flex flex-col items-center justify-center h-full text-center space-y-4">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-text-main font-semibold">Committing to Database...</p>
             </div>
          )}
        </div>

        {/* Footer Actions */}
        {step === 'staging' && (
          <div className="p-4 sm:p-5 border-t border-border bg-surface-hover flex gap-3 flex-shrink-0">
            <button onClick={() => setStep('upload')} className="flex-1 min-h-[48px] bg-surface border border-border hover:bg-border text-text-main rounded-xl font-semibold text-sm transition-colors">
              Cancel
            </button>
            <button 
              onClick={handleCommit} 
              disabled={hasErrors}
              className="flex-1 min-h-[48px] bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:hover:bg-primary text-white rounded-xl font-semibold text-sm transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <Check size={18} /> {hasErrors ? 'Resolve Errors to Apply' : 'Confirm & Apply Bulk Import'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
