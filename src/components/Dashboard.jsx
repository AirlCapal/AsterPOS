import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { TrendingUp, Banknote, Receipt, DollarSign, Calendar, FileSpreadsheet, Loader2 } from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell 
} from 'recharts';
import ExcelJS from 'exceljs';
import { downloadOrShareFile } from '../utils/fileDownloader';

export default function Dashboard({ syncState }) {
  const localOrders = useLiveQuery(() => db.orders.toArray()) || [];
  const [timeRange, setTimeRange] = useState('7days'); // '7days', '30days', 'all'
  const [excelLoading, setExcelLoading] = useState(false);

  // Filter orders based on time range (local data only)
  const filteredOrders = useMemo(() => {
    const now = new Date();
    if (timeRange === '7days') {
      const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).getTime();
      return localOrders.filter(o => o.timestamp >= cutoff);
    }
    if (timeRange === '30days') {
      const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30).getTime();
      return localOrders.filter(o => o.timestamp >= cutoff);
    }
    return localOrders;
  }, [localOrders, timeRange]);

  // Determine if we should use synced data
  const isSyncMode = syncState?.isManagerDevice && syncState?.isConnected;
  const syncSummary = syncState?.lastRegisterSummary;

  // KPIs
  const totalSales = isSyncMode && syncSummary ? syncSummary.totalRevenue : filteredOrders.reduce((sum, o) => sum + o.total, 0);
  const totalOrders = isSyncMode && syncSummary ? syncSummary.totalOrders : filteredOrders.length;
  const avgOrderValue = isSyncMode && syncSummary ? syncSummary.avgOrderValue : (totalOrders > 0 ? totalSales / totalOrders : 0);

  // Chart Data: Sales over time
  const salesOverTime = useMemo(() => {
    const map = new Map();
    filteredOrders.forEach(o => {
      const date = new Date(o.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!map.has(date)) map.set(date, 0);
      map.set(date, map.get(date) + o.total);
    });
    return Array.from(map, ([date, total]) => ({ date, total })).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [filteredOrders]);

  // Chart Data: Top Products (We need products to map IDs to names, let's fetch them)
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const topProducts = useMemo(() => {
    const map = new Map();
    filteredOrders.forEach(order => {
      order.items?.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        const name = product ? product.name : `Product #${item.productId}`;
        if (!map.has(name)) map.set(name, 0);
        map.set(name, map.get(name) + item.quantity);
      });
    });
    return Array.from(map, ([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5); // top 5
  }, [filteredOrders, products]);

  // Colors for PieChart
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  // ── Download Dashboard Excel ──────────────────────────────────────────────
  const handleDownloadExcel = async () => {
    setExcelLoading(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Dashboard Summary');

      sheet.columns = [
        { header: 'Metric', key: 'metric', width: 28 },
        { header: 'Value', key: 'value', width: 20 }
      ];
      const hdr = sheet.getRow(1);
      hdr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };

      sheet.addRow({ metric: 'Period', value: timeRange });
      sheet.addRow({ metric: 'Total Revenue (₱)', value: totalSales });
      sheet.addRow({ metric: 'Total Orders', value: totalOrders });
      sheet.addRow({ metric: 'Avg Order Value (₱)', value: avgOrderValue });

      sheet.getColumn('value').numFmt = '#,##0.00';

      // Sales over time
      sheet.addRow([]);
      sheet.addRow(['Date', 'Revenue (₱)']).font = { bold: true };
      salesOverTime.forEach(({ date, total }) => sheet.addRow([date, total]));

      // Top products
      sheet.addRow([]);
      sheet.addRow(['Product Name', 'Qty Sold']).font = { bold: true };
      topProducts.forEach(({ name, quantity }) => sheet.addRow([name, quantity]));

      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = `Dashboard_Report_${timeRange}_${new Date().toISOString().split('T')[0]}.xlsx`;
      await downloadOrShareFile({
        fileName,
        data: buffer,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        shareTitle: 'Dashboard Sales Report',
        shareText: `Aster POS Dashboard report for ${timeRange}`
      });
    } catch (err) {
      console.error('Dashboard export failed:', err);
    } finally {
      setExcelLoading(false);
    }
  };

  return (
    <div className="p-3 sm:p-5 lg:p-8 h-full flex flex-col bg-background overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6 lg:mb-8 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-semibold text-text-main">Sales Dashboard</h2>
            {isSyncMode && (
              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Sync
              </span>
            )}
          </div>
          <p className="text-text-light font-medium text-sm">
            {isSyncMode ? "Real-time metrics from Main Counter (Today's Sales)" : "Overview of your business performance"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-text-light" />
          <select 
            id="dash-trends"
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)} 
            disabled={isSyncMode}
            className="h-10 px-3 rounded-xl bg-surface border border-border font-semibold text-sm text-text-main disabled:opacity-50"
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
          <button
            onClick={handleDownloadExcel}
            disabled={excelLoading || isSyncMode}
            className="h-10 px-4 bg-surface hover:bg-surface-hover border border-border text-text-main rounded-xl font-semibold text-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Download Dashboard Report"
          >
            {excelLoading
              ? <Loader2 size={15} className="animate-spin" />
              : <FileSpreadsheet size={15} className="text-emerald-500" />}
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div id="dash-kpi" className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div id="dash-sales-card" className="bg-surface p-5 rounded-2xl border border-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Banknote size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-light uppercase tracking-wider">Revenue</p>
            <p className="text-2xl font-semibold text-text-main">₱{totalSales.toFixed(2)}</p>
          </div>
        </div>
        <div className="bg-surface p-5 rounded-2xl border border-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-500/10 text-green-500 flex items-center justify-center">
            <Receipt size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-light uppercase tracking-wider">Orders</p>
            <p className="text-2xl font-semibold text-text-main">{totalOrders}</p>
          </div>
        </div>
        <div className="bg-surface p-5 rounded-2xl border border-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-light uppercase tracking-wider">Avg Order Value</p>
            <p className="text-2xl font-semibold text-text-main">₱{avgOrderValue.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[400px]">
        {/* Revenue Trend */}
        <div id="dash-revenue-chart" className="lg:col-span-2 bg-surface p-5 rounded-2xl border border-border shadow-sm flex flex-col">
          <h3 className="font-semibold text-text-main mb-4">Revenue Trend</h3>
          <div className="flex-1 w-full min-h-[300px]">
            {salesOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesOverTime} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value) => [`₱${Number(value).toFixed(2)}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-text-light font-medium">No sales data for this period</div>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div id="dash-best-sellers" className="bg-surface p-5 rounded-2xl border border-border shadow-sm flex flex-col">
          <h3 className="font-semibold text-text-main mb-4">Top Selling Products</h3>
          <div className="flex-1 w-full min-h-[300px]">
            {topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topProducts}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="quantity"
                  >
                    {topProducts.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value, name) => [`${value} sold`, name]}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px', marginTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
               <div className="h-full flex items-center justify-center text-text-light font-medium">No product data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
