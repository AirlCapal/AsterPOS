import Dexie from 'dexie';

export const db = new Dexie('AsterPOS');

// Keep v2 for migration path
db.version(2).stores({
  users: '++id, name, pin, role',
  products: '++id, name, category, price, isAvailable',
  ingredients: '++id, name, unit, currentStock, safetyThreshold',
  recipes: '++id, productId',
  orders: '++id, timestamp, cashierId, total, paymentMethod, status',
  transactions: '++id, orderId, timestamp, type, amount',
  app_settings: 'id, cafeName, taxRate, currency, receiptFooter'
});

// v4: adds audit_logs table for manager overrides
db.version(4).stores({
  users: '++id, name, pin, role',
  products: '++id, name, category, price, isAvailable',
  ingredients: '++id, name, unit, currentStock, safetyThreshold',
  recipes: '++id, productId',
  orders: '++id, timestamp, cashierId, total, paymentMethod, status',
  transactions: '++id, orderId, timestamp, type, amount',
  app_settings: 'id',
  payment_qr_codes: '++id, methodName',
  audit_logs: '++id, timestamp, actionType, itemName, cashierId, approvingManagerId'
});

// v5: adds categories, cancelled_orders_log, and is_active for users
db.version(5).stores({
  users: '++id, name, pin, role, is_active',
  products: '++id, name, category, price, isAvailable',
  ingredients: '++id, name, unit, currentStock, safetyThreshold',
  recipes: '++id, productId',
  orders: '++id, timestamp, cashierId, total, paymentMethod, status',
  transactions: '++id, orderId, timestamp, type, amount',
  app_settings: 'id',
  payment_qr_codes: '++id, methodName',
  audit_logs: '++id, timestamp, actionType, itemName, cashierId, approvingManagerId',
  categories: '++id, name, status, sort_order',
  cancelled_orders_log: '++id, order_id, timestamp'
}).upgrade(tx => {
  // Existing settings get new default fields if upgrading from older versions
  tx.table('app_settings').toCollection().modify(setting => {
    if (setting.logoDataUrl === undefined) setting.logoDataUrl = '';
    if (setting.iconDataUrl === undefined) setting.iconDataUrl = '';
  });
  // Ensure all existing users are active
  tx.table('users').toCollection().modify(user => {
    if (user.is_active === undefined) user.is_active = 1;
  });
  tx.table('app_settings').toCollection().modify(setting => {
    if (setting.cashierModules === undefined) setting.cashierModules = { pos: true, shift: true, sales: true, account: true, inventory: false, dashboard: false, menu: false, network: false, settings: false };
    if (setting.managerModules === undefined) setting.managerModules = { pos: true, shift: true, dashboard: true, sales: true, menu: true, settings: true, account: true, inventory: true, network: true };
  });
});

// v6: adds shift_closings table for declared cash / end-of-shift reconciliation
db.version(6).stores({
  users: '++id, name, pin, role, is_active',
  products: '++id, name, category, price, isAvailable',
  ingredients: '++id, name, unit, currentStock, safetyThreshold',
  recipes: '++id, productId',
  orders: '++id, timestamp, cashierId, total, paymentMethod, status',
  transactions: '++id, orderId, timestamp, type, amount',
  app_settings: 'id',
  payment_qr_codes: '++id, methodName',
  audit_logs: '++id, timestamp, actionType, itemName, cashierId, approvingManagerId',
  categories: '++id, name, status, sort_order',
  cancelled_orders_log: '++id, order_id, timestamp',
  shift_closings: '++id, cashierId, timestamp, date'
});

// v7: Advanced POS Features (Shift Accounting, CRM, Employee Payroll, Parked Orders)
db.version(7).stores({
  users: '++id, name, pin, role, is_active',
  products: '++id, name, category, price, isAvailable',
  ingredients: '++id, name, unit, currentStock, safetyThreshold',
  recipes: '++id, productId',
  orders: '++id, timestamp, cashierId, total, paymentMethod, status',
  transactions: '++id, orderId, timestamp, type, amount',
  app_settings: 'id',
  payment_qr_codes: '++id, methodName',
  audit_logs: '++id, timestamp, actionType, itemName, cashierId, approvingManagerId',
  categories: '++id, name, status, sort_order',
  cancelled_orders_log: '++id, order_id, timestamp',
  shift_closings: '++id, cashierId, timestamp, date',
  shift_sessions: '++id, cashierId, clockIn, clockOut, openingFloat, closingCash, status',
  cash_payouts: '++id, shiftId, managerId, type, amount, description, timestamp',
  customers: '++id, phone, name, visits, totalSpend, points',
  parked_orders: '++id, name, timestamp',
  timecards: '++id, userId, clockIn, clockOut, totalHours',
  employee_payroll: '++id, userId, payPeriod, totalHours, grossPay'
});

// v8: PIN migration from 4 digits to 6 digits
db.version(8).stores({
  users: '++id, name, pin, role, is_active',
  products: '++id, name, category, price, isAvailable',
  ingredients: '++id, name, unit, currentStock, safetyThreshold',
  recipes: '++id, productId',
  orders: '++id, timestamp, cashierId, total, paymentMethod, status',
  transactions: '++id, orderId, timestamp, type, amount',
  app_settings: 'id',
  payment_qr_codes: '++id, methodName',
  audit_logs: '++id, timestamp, actionType, itemName, cashierId, approvingManagerId',
  categories: '++id, name, status, sort_order',
  cancelled_orders_log: '++id, order_id, timestamp',
  shift_closings: '++id, cashierId, timestamp, date',
  shift_sessions: '++id, cashierId, clockIn, clockOut, openingFloat, closingCash, status',
  cash_payouts: '++id, shiftId, managerId, type, amount, description, timestamp',
  customers: '++id, phone, name, visits, totalSpend, points',
  parked_orders: '++id, name, timestamp',
  timecards: '++id, userId, clockIn, clockOut, totalHours',
  employee_payroll: '++id, userId, payPeriod, totalHours, grossPay'
}).upgrade(tx => {
  tx.table('users').toCollection().modify(user => {
    if (user.pin && user.pin.length === 4) {
      user.pin = user.pin + '00';
    }
  });
});

// v9: Inventory Management – expanded ingredients schema + inventory_adjustments audit table
db.version(9).stores({
  users: '++id, name, pin, role, is_active',
  products: '++id, name, category, price, isAvailable',
  ingredients: '++id, sku, name, unit, currentStock, safetyThreshold, costPerUnit, supplier',
  recipes: '++id, productId',
  orders: '++id, timestamp, cashierId, total, paymentMethod, status',
  transactions: '++id, orderId, timestamp, type, amount',
  app_settings: 'id',
  payment_qr_codes: '++id, methodName',
  audit_logs: '++id, timestamp, actionType, itemName, cashierId, approvingManagerId',
  categories: '++id, name, status, sort_order',
  cancelled_orders_log: '++id, order_id, timestamp',
  shift_closings: '++id, cashierId, timestamp, date',
  shift_sessions: '++id, cashierId, clockIn, clockOut, openingFloat, closingCash, status',
  cash_payouts: '++id, shiftId, managerId, type, amount, description, timestamp',
  customers: '++id, phone, name, visits, totalSpend, points',
  parked_orders: '++id, name, timestamp',
  timecards: '++id, userId, clockIn, clockOut, totalHours',
  employee_payroll: '++id, userId, payPeriod, totalHours, grossPay',
  inventory_adjustments: '++id, ingredientId, timestamp, type, delta, reason, managerId'
}).upgrade(tx => {
  // Backfill new fields on existing ingredients
  tx.table('ingredients').toCollection().modify(ing => {
    if (ing.sku === undefined) ing.sku = '';
    if (ing.costPerUnit === undefined) ing.costPerUnit = 0;
    if (ing.supplier === undefined) ing.supplier = '';
  });
  // Add inventory and network module to existing settings
  tx.table('app_settings').toCollection().modify(setting => {
    if (setting.cashierModules && setting.cashierModules.inventory === undefined) {
      setting.cashierModules.inventory = true;
    }
    if (setting.managerModules) {
      if (setting.managerModules.inventory === undefined) setting.managerModules.inventory = true;
      if (setting.managerModules.network === undefined) setting.managerModules.network = true;
    }
  });
});

// v10: Manager Profile Contact Details & Multi-Channel OTP preferences
db.version(10).stores({
  users: '++id, name, pin, role, is_active, email, phone_number, otp_delivery_preference',
  products: '++id, name, category, price, isAvailable',
  ingredients: '++id, sku, name, unit, currentStock, safetyThreshold, costPerUnit, supplier',
  recipes: '++id, productId',
  orders: '++id, timestamp, cashierId, total, paymentMethod, status',
  transactions: '++id, orderId, timestamp, type, amount',
  app_settings: 'id',
  payment_qr_codes: '++id, methodName',
  audit_logs: '++id, timestamp, actionType, itemName, cashierId, approvingManagerId, auth_type',
  categories: '++id, name, status, sort_order',
  cancelled_orders_log: '++id, order_id, timestamp',
  shift_closings: '++id, cashierId, timestamp, date',
  shift_sessions: '++id, cashierId, clockIn, clockOut, openingFloat, closingCash, status',
  cash_payouts: '++id, shiftId, managerId, type, amount, description, timestamp',
  customers: '++id, phone, name, visits, totalSpend, points',
  parked_orders: '++id, name, timestamp',
  timecards: '++id, userId, clockIn, clockOut, totalHours',
  employee_payroll: '++id, userId, payPeriod, totalHours, grossPay',
  inventory_adjustments: '++id, ingredientId, timestamp, type, delta, reason, managerId'
}).upgrade(tx => {
  tx.table('users').toCollection().modify(user => {
    if (user.email === undefined) user.email = '';
    if (user.phone_number === undefined) user.phone_number = '';
    if (user.otp_delivery_preference === undefined) user.otp_delivery_preference = 'BOTH';
  });
  tx.table('audit_logs').toCollection().modify(log => {
    if (log.auth_type === undefined) log.auth_type = 'PIN';
  });
});

// v11: Module Access Control — ensure all module keys exist for both roles
db.version(11).stores({
  users: '++id, name, pin, role, is_active, email, phone_number, otp_delivery_preference',
  products: '++id, name, category, price, isAvailable',
  ingredients: '++id, sku, name, unit, currentStock, safetyThreshold, costPerUnit, supplier',
  recipes: '++id, productId',
  orders: '++id, timestamp, cashierId, total, paymentMethod, status',
  transactions: '++id, orderId, timestamp, type, amount',
  app_settings: 'id',
  payment_qr_codes: '++id, methodName',
  audit_logs: '++id, timestamp, actionType, itemName, cashierId, approvingManagerId, auth_type',
  categories: '++id, name, status, sort_order',
  cancelled_orders_log: '++id, order_id, timestamp',
  shift_closings: '++id, cashierId, timestamp, date',
  shift_sessions: '++id, cashierId, clockIn, clockOut, openingFloat, closingCash, status',
  cash_payouts: '++id, shiftId, managerId, type, amount, description, timestamp',
  customers: '++id, phone, name, visits, totalSpend, points',
  parked_orders: '++id, name, timestamp',
  timecards: '++id, userId, clockIn, clockOut, totalHours',
  employee_payroll: '++id, userId, payPeriod, totalHours, grossPay',
  inventory_adjustments: '++id, ingredientId, timestamp, type, delta, reason, managerId'
}).upgrade(tx => {
  // Backfill all module keys for both cashier and manager
  tx.table('app_settings').toCollection().modify(setting => {
    const allCashierDefaults = { pos: true, shift: true, sales: true, account: true, inventory: true, dashboard: false, menu: false, network: false, settings: false };
    const allManagerDefaults = { pos: true, shift: true, dashboard: true, sales: true, menu: true, network: true, settings: true, account: true, inventory: true };
    if (setting.cashierModules) {
      for (const key of Object.keys(allCashierDefaults)) {
        if (setting.cashierModules[key] === undefined) setting.cashierModules[key] = allCashierDefaults[key];
      }
    } else {
      setting.cashierModules = allCashierDefaults;
    }
    if (setting.managerModules) {
      for (const key of Object.keys(allManagerDefaults)) {
        if (setting.managerModules[key] === undefined) setting.managerModules[key] = allManagerDefaults[key];
      }
    } else {
      setting.managerModules = allManagerDefaults;
    }
  });
});

// Role hierarchy helper: higher number = more privilege
export const ROLE_LEVELS = {
  cashier: 1,
  manager: 2,
  super_admin: 3
};

export const ROLE_LABELS = {
  cashier: 'Cashier',
  manager: 'Manager',
  super_admin: 'Super Admin'
};

export const hasMinRole = (userRole, requiredRole) => {
  return (ROLE_LEVELS[userRole] || 0) >= (ROLE_LEVELS[requiredRole] || 0);
};

export const initializeDefaultData = async () => {
  // Users – seed all three tiers if no users exist
  const userCount = await db.users.count();
  if (userCount === 0) {
    await db.users.bulkAdd([
      {
        name: 'Super Admin',
        pin: '999900',
        role: 'super_admin',
        is_active: 1,
        email: 'admin@airlunacreations.com',
        phone_number: '+639123456789',
        otp_delivery_preference: 'BOTH'
      },
      {
        name: 'Admin Manager',
        pin: '123400',
        role: 'manager',
        is_active: 1,
        email: 'manager@airlunacreations.com',
        phone_number: '+639987654321',
        otp_delivery_preference: 'BOTH'
      },
      {
        name: 'Front Desk',
        pin: '000000',
        role: 'cashier',
        is_active: 1,
        email: '',
        phone_number: '',
        otp_delivery_preference: 'SMS'
      }
    ]);
  } else {
    // Ensure at least one super_admin exists on upgrade
    const superAdmins = await db.users.where('role').equals('super_admin').count();
    if (superAdmins === 0) {
      // Check if PIN 999900 is taken
      const existing = await db.users.where('pin').equals('999900').first();
      if (!existing) {
        await db.users.add({
          name: 'Super Admin',
          pin: '999900',
          role: 'super_admin',
          is_active: 1,
          email: 'admin@airlunacreations.com',
          phone_number: '+639123456789',
          otp_delivery_preference: 'BOTH'
        });
      }
    }
  }

  // Settings
  const settingsCount = await db.app_settings.count();
  if (settingsCount === 0) {
    await db.app_settings.add({
      id: 'default',
      cafeName: 'Aster POS',
      taxRate: 12,
      currency: '₱',
      receiptFooter: 'Thank you for choosing Aster POS!',
      logoDataUrl: '',
      iconDataUrl: '',
      cashierModules: { pos: true, shift: true, sales: true, account: true, inventory: true, dashboard: false, menu: false, network: false, settings: false },
      managerModules: { pos: true, shift: true, dashboard: true, sales: true, menu: true, network: true, settings: true, account: true, inventory: true },
      emailSenderAddress: 'airlunacreations@gmail.com',
      googleAppsScriptUrl: 'https://script.google.com/macros/s/AKfycbxLClbcVO3RN8tKsiyxs_RsKYNbYxQ1FonuyIMxLuu-CBpgwyEOzZDWT21tO9aXUm578w/exec',
      emailWebhookUrl: '',
      smsDeliveryMode: 'DEVICE_SIM',
      smsWebhookUrl: ''
    });
  } else {
    // Ensure googleAppsScriptUrl is updated with default if empty or pointing to previous default
    const current = await db.app_settings.get('default');
    const oldDefault = 'https://script.google.com/macros/s/AKfycbx2OMGzAx62w_QkIg-EW0qPqN7QARLftdP06hp9a8hLX-OX049uSkyb8q0_vTEWdNXIFw/exec';
    const newDefault = 'https://script.google.com/macros/s/AKfycbxLClbcVO3RN8tKsiyxs_RsKYNbYxQ1FonuyIMxLuu-CBpgwyEOzZDWT21tO9aXUm578w/exec';
    if (current && (!current.googleAppsScriptUrl || current.googleAppsScriptUrl === oldDefault)) {
      await db.app_settings.update('default', {
        googleAppsScriptUrl: newDefault
      });
    }
  }

  // Seed default QR code placeholders if table is empty
  const qrCount = await db.payment_qr_codes.count();
  if (qrCount === 0) {
    await db.payment_qr_codes.bulkAdd([
      { methodName: 'GCash', label: 'GCash', qrDataUrl: '', accountName: '', accountNumber: '' },
      { methodName: 'Maya', label: 'Maya', qrDataUrl: '', accountName: '', accountNumber: '' },
      { methodName: 'Bank Transfer', label: 'Bank Transfer', qrDataUrl: '', accountName: '', accountNumber: '' }
    ]);
  }

  // Products & Ingredients seeding
  const productsCount = await db.products.count();
  if (productsCount === 0) {
    const beanId = await db.ingredients.add({
      name: 'Espresso Beans', sku: 'ING-001', unit: 'g',
      currentStock: 5000, safetyThreshold: 1000,
      costPerUnit: 0.80, supplier: 'Local Roastery'
    });
    const milkId = await db.ingredients.add({
      name: 'Whole Milk', sku: 'ING-002', unit: 'ml',
      currentStock: 10000, safetyThreshold: 2000,
      costPerUnit: 0.05, supplier: 'Fresh Dairy Co.'
    });
    const cupId = await db.ingredients.add({
      name: '16oz Cup', sku: 'ING-003', unit: 'pcs',
      currentStock: 500, safetyThreshold: 100,
      costPerUnit: 3.50, supplier: 'PackPro Supplies'
    });

    const latteId = await db.products.add({ name: 'Iced Latte', category: 'Espresso', price: 150, isAvailable: true });

    await db.recipes.add({
      productId: latteId,
      ingredients: [
        { ingredientId: beanId, quantity: 18 },
        { ingredientId: milkId, quantity: 200 },
        { ingredientId: cupId, quantity: 1 }
      ]
    });
  }

  // Seed default categories
  const categoriesCount = await db.categories.count();
  if (categoriesCount === 0) {
    await db.categories.bulkAdd([
      { name: 'Espresso', status: 'Active', sort_order: 1, icon: '☕' },
      { name: 'Non-Coffee', status: 'Active', sort_order: 2, icon: '🥤' },
      { name: 'Pastries', status: 'Active', sort_order: 3, icon: '🥐' },
      { name: 'Cold Brew', status: 'Active', sort_order: 4, icon: '🧊' },
      { name: 'Add-ons', status: 'Active', sort_order: 5, icon: '✨' },
    ]);
  }
};
