/**
 * Inventory Service
 * Core logic for ingredient deduction, restoration, stock checks, and COGS calculation.
 * Used by both the Register checkout flow and the Inventory Manager UI.
 */
import { db } from '../db';

/**
 * Deduct raw ingredients from inventory based on order items.
 * Called automatically when a sale is completed on the Register.
 * @param {Array} orderItems - Array of { productId, quantity }
 * @returns {Object} { success, warnings[] } — warnings for low/out-of-stock ingredients
 */
export async function deductIngredientsForOrder(orderItems) {
  const warnings = [];

  for (const item of orderItems) {
    const recipes = await db.recipes.where('productId').equals(item.productId).toArray();

    for (const recipe of recipes) {
      if (!recipe.ingredients || recipe.ingredients.length === 0) continue;

      for (const ing of recipe.ingredients) {
        const ingredient = await db.ingredients.get(ing.ingredientId);
        if (!ingredient) continue;

        const totalDeduction = ing.quantity * item.quantity;
        const newStock = ingredient.currentStock - totalDeduction;

        await db.ingredients.update(ing.ingredientId, {
          currentStock: newStock
        });

        // Check if below safety threshold after deduction
        if (newStock <= 0) {
          warnings.push({
            type: 'out_of_stock',
            ingredientName: ingredient.name,
            currentStock: newStock,
            unit: ingredient.unit
          });
        } else if (newStock <= ingredient.safetyThreshold) {
          warnings.push({
            type: 'low_stock',
            ingredientName: ingredient.name,
            currentStock: newStock,
            threshold: ingredient.safetyThreshold,
            unit: ingredient.unit
          });
        }
      }
    }
  }

  return { success: true, warnings };
}

/**
 * Restore raw ingredients to inventory (for voided/refunded orders).
 * @param {Array} orderItems - Array of { productId, quantity }
 */
export async function restoreIngredientsForOrder(orderItems) {
  for (const item of orderItems) {
    const recipes = await db.recipes.where('productId').equals(item.productId).toArray();

    for (const recipe of recipes) {
      if (!recipe.ingredients) continue;

      for (const ing of recipe.ingredients) {
        const ingredient = await db.ingredients.get(ing.ingredientId);
        if (!ingredient) continue;

        await db.ingredients.update(ing.ingredientId, {
          currentStock: ingredient.currentStock + (ing.quantity * item.quantity)
        });
      }
    }
  }
}

/**
 * Pre-check stock availability before completing a sale.
 * Returns an array of warnings for items that are low or out of stock.
 * @param {Array} cartItems - Array of { product: { id }, quantity }
 * @returns {Array} warnings
 */
export async function checkStockAvailability(cartItems) {
  const warnings = [];

  for (const cartItem of cartItems) {
    const recipes = await db.recipes.where('productId').equals(cartItem.product.id).toArray();

    for (const recipe of recipes) {
      if (!recipe.ingredients) continue;

      for (const ing of recipe.ingredients) {
        const ingredient = await db.ingredients.get(ing.ingredientId);
        if (!ingredient) continue;

        const required = ing.quantity * cartItem.quantity;

        if (ingredient.currentStock <= 0) {
          warnings.push({
            productName: cartItem.product.name,
            ingredientName: ingredient.name,
            type: 'out_of_stock',
            required,
            available: ingredient.currentStock,
            unit: ingredient.unit
          });
        } else if (ingredient.currentStock < required) {
          warnings.push({
            productName: cartItem.product.name,
            ingredientName: ingredient.name,
            type: 'insufficient',
            required,
            available: ingredient.currentStock,
            unit: ingredient.unit
          });
        } else if (ingredient.currentStock - required <= ingredient.safetyThreshold) {
          warnings.push({
            productName: cartItem.product.name,
            ingredientName: ingredient.name,
            type: 'low_after_sale',
            required,
            available: ingredient.currentStock,
            remaining: ingredient.currentStock - required,
            threshold: ingredient.safetyThreshold,
            unit: ingredient.unit
          });
        }
      }
    }
  }

  return warnings;
}

/**
 * Manual stock adjustment with audit trail.
 * @param {number} ingredientId
 * @param {number} delta - positive for restock, negative for waste/loss
 * @param {string} reason - 'Restock' | 'Spill/Waste' | 'Expired' | 'Audit Correction'
 * @param {number} managerId
 * @param {string} managerName
 */
export async function adjustStock(ingredientId, delta, reason, managerId, managerName) {
  const ingredient = await db.ingredients.get(ingredientId);
  if (!ingredient) throw new Error('Ingredient not found');

  const newStock = ingredient.currentStock + delta;

  await db.ingredients.update(ingredientId, {
    currentStock: newStock
  });

  // Record adjustment in audit table
  await db.inventory_adjustments.add({
    ingredientId,
    ingredientName: ingredient.name,
    timestamp: new Date().getTime(),
    type: delta > 0 ? 'increase' : 'decrease',
    delta,
    previousStock: ingredient.currentStock,
    newStock,
    reason,
    managerId,
    managerName
  });

  return { previousStock: ingredient.currentStock, newStock };
}

/**
 * Calculate Cost of Goods Sold (COGS) for a product based on its recipe.
 * @param {number} productId
 * @returns {Object} { totalCost, ingredients: [{ name, quantity, unit, unitCost, lineCost }] }
 */
export async function calculateCOGS(productId) {
  const recipes = await db.recipes.where('productId').equals(productId).toArray();
  let totalCost = 0;
  const ingredientBreakdown = [];

  for (const recipe of recipes) {
    if (!recipe.ingredients) continue;

    for (const ing of recipe.ingredients) {
      const ingredient = await db.ingredients.get(ing.ingredientId);
      if (!ingredient) continue;

      const lineCost = (ingredient.costPerUnit || 0) * ing.quantity;
      totalCost += lineCost;

      ingredientBreakdown.push({
        ingredientId: ing.ingredientId,
        name: ingredient.name,
        quantity: ing.quantity,
        unit: ingredient.unit,
        unitCost: ingredient.costPerUnit || 0,
        lineCost
      });
    }
  }

  return { totalCost, ingredients: ingredientBreakdown };
}

/**
 * Get all ingredients that are at or below their safety threshold.
 * @returns {Array} low-stock ingredients
 */
export async function getLowStockIngredients() {
  const all = await db.ingredients.toArray();
  return all.filter(ing => ing.currentStock <= ing.safetyThreshold);
}
