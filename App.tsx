
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  LayoutDashboard, PlusCircle, History, Settings as SettingsIcon, 
  MessageSquare, UserCircle, Search, Filter, AlertTriangle, Send,
  Users, BarChart2, Bell, BookOpen, Layers, Menu, X, ChevronRight,
  Zap, Lock, Smartphone, BrainCircuit, ShieldAlert, TrendingUp,
  ReceiptIndianRupee, ListFilter, FileText, Globe
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import OrderForm from './components/OrderForm';
import Settings from './components/Settings';
import CustomerList from './components/CustomerList';
import Reports from './components/Reports';
import NotificationCenter from './components/NotificationCenter';
import PlanManager from './components/PlanManager';
import OrderDetails from './components/OrderDetails';
import CustomerOrderView from './components/CustomerOrderView';
import WhatsAppPanel from './components/WhatsAppPanel';
import WhatsAppTemplates from './components/WhatsAppTemplates';
import ErrorLogPanel from './components/ErrorLogPanel'; 
import PaymentCollections from './components/PaymentCollections';
import WhatsAppLogs from './components/WhatsAppLogs';
import MarketIntelligence from './components/MarketIntelligence';

import { 
  Order, OrderStatus, GlobalSettings, PaymentRecord, 
  Milestone, Customer, NotificationTrigger, PaymentPlanTemplate, ProductionStatus,
  WhatsAppLogEntry, WhatsAppTemplate, AppError, ActivityLogEntry, ProtectionStatus
} from './types';
import { INITIAL_SETTINGS, INITIAL_PLAN_TEMPLATES, INITIAL_TEMPLATES, REQUIRED_SYSTEM_TEMPLATES } from './constants';
import { geminiService } from './services/geminiService';
import { goldRateService } from './services/goldRateService';
import { whatsappService } from './services/whatsappService';
import { errorService } from './services/errorService';

const App: React.FC = () => {
  type Tab = 'dashboard' | 'orders' | 'settings' | 'collections' | 'customers' | 'reports' | 'notifications' | 'plans' | 'whatsapp' | 'waLogs' | 'templates' | 'errors' | 'market';
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [manualCustomers, setManualCustomers] = useState<Customer[]>([]); // New State for standalone customers
  const [notifications, setNotifications] = useState<NotificationTrigger[]>([]);
  const [whatsAppLogs, setWhatsAppLogs] = useState<WhatsAppLogEntry[]>([]);
  const [waTemplates, setWaTemplates] = useState<WhatsAppTemplate[]>(INITIAL_TEMPLATES);
  const [settings, setSettings] = useState<GlobalSettings>(INITIAL_SETTINGS);
  const [planTemplates, setPlanTemplates] = useState<PaymentPlanTemplate[]>(INITIAL_PLAN_TEMPLATES);
  
  const [systemErrors, setSystemErrors] = useState<AppError[]>([]); 
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]); 

  // Merged Customer List (Manual + Derived from Orders)
  const customers = useMemo(() => {
    const customerMap = new Map<string, Customer>();
    
    // 1. Add manual customers first
    manualCustomers.forEach(c => {
        // Clone to ensure we don't mutate state during aggregation
        customerMap.set(c.contact, { ...c, orderIds: [...c.orderIds] });
    });

    // 2. Merge/Update with Order data
    orders.forEach(order => {
      const contact = order.customerContact;
      if (!customerMap.has(contact)) {
        customerMap.set(contact, {
          id: `CUST-${contact}`,
          name: order.customerName,
          contact: order.customerContact,
          secondaryContact: order.secondaryContact,
          email: order.customerEmail,
          orderIds: [order.id],
          totalSpent: order.totalAmount,
          joinDate: order.createdAt,
        });
      } else {
        const existing = customerMap.get(contact)!;
        if (!existing.orderIds.includes(order.id)) {
             existing.orderIds.push(order.id);
             existing.totalSpent += order.totalAmount;
        }
      }
    });
    return Array.from(customerMap.values());
  }, [orders, manualCustomers]);

  const [isCreating, setIsCreating] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const [publicOrder, setPublicOrder] = useState<Order | null>(null);
  const [publicError, setPublicError] = useState<string | null>(null);

  useEffect(() => {
    const safeParse = (key: string, fallback: any) => {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
      } catch (e) { return fallback; }
    };
    const loadedOrders = safeParse('aura_orders', []);
    setOrders(loadedOrders);
    const savedSettings = safeParse('aura_settings', null);
    if (savedSettings) setSettings({ ...INITIAL_SETTINGS, ...savedSettings });
    setNotifications(safeParse('aura_notifications', []));
    setPlanTemplates(safeParse('aura_plans', INITIAL_PLAN_TEMPLATES));
    setWhatsAppLogs(safeParse('aura_whatsapp_logs', []));
    setWaTemplates(safeParse('aura_whatsapp_templates', INITIAL_TEMPLATES));
    setManualCustomers(safeParse('aura_manual_customers', []));

    const unsubscribeErrors = errorService.subscribe((errs, acts) => {
       setSystemErrors([...errs]);
       setActivityLogs([...acts]);
    });
    const params = new URLSearchParams(window.location.search);
    const viewToken = params.get('view');
    if (viewToken) {
      const targetOrder = loadedOrders.find((o: Order) => o.shareToken === viewToken);
      if (targetOrder) setPublicOrder(targetOrder);
      else setPublicError("Invalid Link.");
    } else {
      goldRateService.fetchLiveRate(false).then(res => {
          if(res.success) setSettings(p => ({...p, currentGoldRate24K: res.rate24K, currentGoldRate22K: res.rate22K}));
      });
    }
    return () => { unsubscribeErrors(); };
  }, []);

  useEffect(() => {
    if (!publicOrder) {
      try {
        localStorage.setItem('aura_orders', JSON.stringify(orders));
        localStorage.setItem('aura_settings', JSON.stringify(settings));
        localStorage.setItem('aura_notifications', JSON.stringify(notifications));
        localStorage.setItem('aura_plans', JSON.stringify(planTemplates));
        localStorage.setItem('aura_whatsapp_logs', JSON.stringify(whatsAppLogs));
        localStorage.setItem('aura_whatsapp_templates', JSON.stringify(waTemplates));
        localStorage.setItem('aura_manual_customers', JSON.stringify(manualCustomers));
      } catch (e) {}
    }
  }, [orders, settings, notifications, planTemplates, publicOrder, whatsAppLogs, waTemplates, manualCustomers]);

  // --- INTELLIGENT PROTECTION MONITOR ---
  useEffect(() => {
      const monitorInterval = setInterval(() => {
          const now = new Date();
          const currentMarketRate = settings.currentGoldRate22K; // Using 22K for protection logic

          setOrders(prevOrders => {
              let ordersChanged = false;
              const newOrders = prevOrders.map(order => {
                  if (!order.paymentPlan.goldRateProtection) return order;
                  if (order.paymentPlan.protectionStatus === ProtectionStatus.LAPSED) return order;

                  const bookedRate = order.paymentPlan.protectionRateBooked;
                  const limit = order.paymentPlan.protectionLimit;
                  const threshold = bookedRate + limit;
                  
                  // Check for ANY overdue milestone
                  const overdueMilestone = order.paymentPlan.milestones.find(m => m.status !== 'PAID' && new Date(m.dueDate) < now);

                  if (overdueMilestone) {
                      // Deep clone to avoid mutation
                      let updatedOrder = { 
                          ...order, 
                          paymentPlan: { 
                              ...order.paymentPlan,
                              milestones: order.paymentPlan.milestones.map(m => ({...m}))
                          } 
                      };
                      let modified = false;
                      
                      // 1. Initial Transition to Warning (Start 7-Day Grace Period)
                      if (updatedOrder.paymentPlan.protectionStatus === ProtectionStatus.ACTIVE) {
                          modified = true;
                          updatedOrder.paymentPlan.protectionStatus = ProtectionStatus.WARNING;
                          const graceEnd = new Date();
                          graceEnd.setDate(graceEnd.getDate() + 7);
                          updatedOrder.paymentPlan.gracePeriodEndAt = graceEnd.toISOString();
                          errorService.logActivity('STATUS_UPDATE', `Protection Risk: Grace period started for ${order.customerName}`);
                      }

                      // 2. Lapse Check (Has 7-day Grace Period Passed?)
                      if (updatedOrder.paymentPlan.protectionStatus === ProtectionStatus.WARNING) {
                          const graceDate = new Date(updatedOrder.paymentPlan.gracePeriodEndAt!);
                          if (now > graceDate) {
                              modified = true;
                              updatedOrder.paymentPlan.protectionStatus = ProtectionStatus.LAPSED;
                              updatedOrder.status = OrderStatus.OVERDUE;
                              
                              // Logic: Recalculate price if market is above threshold
                              if (currentMarketRate > threshold) {
                                 const baseAmount = updatedOrder.originalTotalAmount || updatedOrder.totalAmount;
                                 const deltaRate = currentMarketRate - bookedRate;
                                 const totalGrams = updatedOrder.items.reduce((acc, i) => acc + i.netWeight, 0);
                                 const deltaCost = totalGrams * deltaRate;
                                 
                                 // Apply penalty/increase
                                 updatedOrder.totalAmount = baseAmount + deltaCost;
                                 updatedOrder.additionalCharges += deltaCost; // Log as additional charge for transparency
                              }
                              
                              triggerLapseNotification(updatedOrder);
                              return updatedOrder;
                          }
                      }

                      // 3. 3-Hour Warning Cycle (Only if Rate > Threshold)
                      if (currentMarketRate > threshold) {
                          const lastWarn = overdueMilestone.lastWarningSentAt ? new Date(overdueMilestone.lastWarningSentAt) : null;
                          const threeHoursInMs = 3 * 60 * 60 * 1000;
                          
                          // If never warned OR 3 hours passed since last warning
                          if (!lastWarn || (now.getTime() - lastWarn.getTime() > threeHoursInMs)) {
                              modified = true;
                              triggerWarningNotification(updatedOrder, overdueMilestone);
                              
                              // Update the specific milestone's warning timestamp
                              updatedOrder.paymentPlan.milestones = updatedOrder.paymentPlan.milestones.map(m => 
                                  m.id === overdueMilestone.id 
                                  ? { ...m, warningCount: (m.warningCount || 0) + 1, lastWarningSentAt: now.toISOString() } 
                                  : m
                              );
                          }
                      }
                      
                      if (modified) {
                        ordersChanged = true;
                        return updatedOrder;
                      }
                      return order;
                  } else {
                      // If customer paid and no milestones are overdue, REINSTATE Active Status
                      if (order.paymentPlan.protectionStatus === ProtectionStatus.WARNING) {
                          ordersChanged = true;
                          errorService.logActivity('STATUS_UPDATE', `Protection Restored for ${order.customerName} (Payment Received)`);
                          return { 
                              ...order, 
                              paymentPlan: { 
                                  ...order.paymentPlan, 
                                  protectionStatus: ProtectionStatus.ACTIVE, 
                                  gracePeriodEndAt: undefined 
                              } 
                          };
                      }
                  }
                  return order;
              });
              return ordersChanged ? newOrders : prevOrders;
          });
      }, 60000); // Check every minute

      return () => clearInterval(monitorInterval);
  }, [settings.currentGoldRate22K]);

  const triggerWarningNotification = async (order: Order, milestone: Milestone) => {
      // Use Template for reliability outside 24h window
      const daysLeft = order.paymentPlan.gracePeriodEndAt 
          ? Math.max(0, Math.ceil((new Date(order.paymentPlan.gracePeriodEndAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : 0;

      const vars = [
          order.customerName,
          String(settings.currentGoldRate22K),
          String(milestone.targetAmount),
          String(daysLeft)
      ];

      const result = await whatsappService.sendTemplateMessage(
          order.customerContact,
          'auragold_rate_warning',
          'en_US',
          vars,
          order.customerName
      );
      
      if (result.success && result.logEntry) setWhatsAppLogs(p => [result.logEntry!, ...p]);
  };

  const triggerLapseNotification = async (order: Order) => {
      // Use Template for reliability
      const vars = [
          order.customerName,
          order.totalAmount.toLocaleString()
      ];

      const result = await whatsappService.sendTemplateMessage(
          order.customerContact,
          'auragold_protection_lapsed',
          'en_US',
          vars,
          order.customerName
      );

      if (result.success && result.logEntry) setWhatsAppLogs(p => [result.logEntry!, ...p]);
  };

  const recordPayment = (orderId: string, amount: number, method: string, date: string, note: string = 'Payment Received') => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      const newPayment: PaymentRecord = { id: `PAY-${Date.now()}`, date: date ? new Date(date).toISOString() : new Date().toISOString(), amount, method, note };
      const totalPaid = o.payments.reduce((acc, p) => acc + p.amount, 0) + amount;
      let runningSum = 0;
      const updatedMilestones = o.paymentPlan.milestones.map(m => {
        runningSum += m.targetAmount;
        return { ...m, status: totalPaid >= runningSum ? 'PAID' as const : (totalPaid > (runningSum - m.targetAmount + 0.01) ? 'PARTIAL' as const : 'PENDING' as const) };
      });
      const allPaid = totalPaid >= o.totalAmount - 0.01;
      errorService.logActivity('PAYMENT_RECEIVED', `Recorded ₹${amount} for ${o.customerName}`);
      return { ...o, payments: [...o.payments, newPayment], paymentPlan: { ...o.paymentPlan, milestones: updatedMilestones }, status: allPaid ? OrderStatus.COMPLETED : (updatedMilestones.some(m => m.status !== 'PAID' && new Date(m.dueDate) < new Date()) ? OrderStatus.OVERDUE : OrderStatus.ACTIVE) };
    }));
  };

  const updateItemStatus = (itemId: string, status: ProductionStatus) => {
    setOrders(prev => prev.map(o => {
      const updatedItems = o.items.map(item => item.id === itemId ? { ...item, productionStatus: status } : item);
      if (updatedItems !== o.items) return { ...o, items: updatedItems };
      return o;
    }));
  };

  const handleOrderSubmit = (newOrder: Order) => {
      setOrders([newOrder, ...orders]);
      setIsCreating(false);
      setActiveTab('orders');
      errorService.logActivity('ORDER_CREATED', `Order ${newOrder.id} for ${newOrder.customerName}`);
  };
  
  const handleOrderUpdate = (updatedOrder: Order) => {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
  };

  // Add a new customer manually
  const handleAddCustomer = (customer: Customer) => {
      setManualCustomers(prev => [...prev, customer]);
      errorService.logActivity('STATUS_UPDATE', `New Customer Added: ${customer.name}`);
  };

  // Helper to add logs from child components
  const handleAddLog = (log: WhatsAppLogEntry) => {
      setWhatsAppLogs(prev => [log, ...prev]);
  };

  if (publicOrder) return <CustomerOrderView order={publicOrder} />;
  if (publicError) return <div className="min-h-screen flex items-center justify-center p-6 text-center"><div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full"><h2>Access Denied</h2><p>{publicError}</p></div></div>;

  const NavContent = () => (
    <>
      <div className="p-8 hidden lg:block"><h1 className="text-2xl font-black text-amber-600 tracking-tighter flex items-center gap-2">AuraGold</h1></div>
      <nav className="flex-1 px-4 space-y-1">
        <button onClick={() => { setActiveTab('dashboard'); setIsCreating(false); setSelectedOrderId(null); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'dashboard' ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-50'}`}><LayoutDashboard size={20} /> Dashboard</button>
        <button onClick={() => { setActiveTab('market'); setIsCreating(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'market' ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-50'}`}><Globe size={20} /> Market Watch</button>
        <button onClick={() => { setActiveTab('orders'); setIsCreating(false); setSelectedOrderId(null); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'orders' ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-50'}`}><History size={20} /> History</button>
        <button onClick={() => { setActiveTab('collections'); setIsCreating(false); setSelectedOrderId(null); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'collections' ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-50'}`}><ReceiptIndianRupee size={20} /> Collections</button>
        
        <div className="pt-4 pb-2 px-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">Automation & Tools</div>
        <button onClick={() => { setActiveTab('plans'); setIsCreating(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'plans' ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-50'}`}><Layers size={20} /> Plan Architect</button>
        <button onClick={() => { setActiveTab('templates'); setIsCreating(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'templates' ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-50'}`}><BrainCircuit size={20} /> AI Templates</button>
        
        <div className="pt-4 pb-2 px-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">Communications</div>
        <button onClick={() => { setActiveTab('whatsapp'); setSelectedContact(null); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'whatsapp' ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-50'}`}><MessageSquare size={20} /> Chat Console</button>
        <button onClick={() => { setActiveTab('waLogs'); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'waLogs' ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-50'}`}><ListFilter size={20} /> Comm. Logs</button>
        
        <div className="pt-4 pb-2 px-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">System</div>
        <button onClick={() => { setActiveTab('customers'); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'customers' ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-50'}`}><Users size={20} /> Customers</button>
        <button onClick={() => { setActiveTab('errors'); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'errors' ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-50'}`}><ShieldAlert size={20} /> System Logs</button>
        <button onClick={() => { setActiveTab('settings'); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'settings' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}><SettingsIcon size={20} /> Settings</button>
      </nav>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50">
      <header className="lg:hidden bg-white border-b px-6 py-4 flex justify-between items-center"><h1 className="text-xl font-black text-amber-600">AuraGold</h1><button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2">{isMenuOpen ? <X /> : <Menu />}</button></header>
      {isMenuOpen && <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setIsMenuOpen(false)}><div className="w-64 h-full bg-white"><NavContent /></div></div>}
      <aside className="w-64 bg-white border-r hidden lg:flex flex-col h-screen sticky top-0 overflow-y-auto custom-scrollbar"><NavContent /></aside>
      <main className="flex-1 overflow-auto p-4 md:p-8">
        {!selectedOrderId && !isCreating && <header className="flex flex-col sm:flex-row justify-between gap-4 mb-8"><div><h2 className="text-2xl font-bold text-slate-800 capitalize">{activeTab.replace(/([A-Z])/g, ' $1').trim()}</h2><p className="text-sm text-slate-500">AuraGold Recovery Backend</p></div><button onClick={() => setIsCreating(true)} className="bg-amber-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-amber-700 shadow-lg shadow-amber-200 transition-all"><PlusCircle size={20} /> New Order</button></header>}
        {isCreating ? <OrderForm settings={settings} planTemplates={planTemplates} existingCustomers={customers} onSubmit={handleOrderSubmit} onCancel={() => setIsCreating(false)} /> : 
         selectedOrderId ? (
            <OrderDetails 
                order={orders.find(o => o.id === selectedOrderId)!} 
                settings={settings} 
                onBack={() => setSelectedOrderId(null)} 
                onUpdateStatus={updateItemStatus} 
                onRecordPayment={recordPayment} 
                onSendPaymentRequest={() => {}} 
                onOrderUpdate={handleOrderUpdate} 
                onTriggerLapse={() => {}} 
                logs={whatsAppLogs} // Pass logs to details view
                onAddLog={handleAddLog} // Allow adding logs from details view
            />
         ) :
         <>
            {activeTab === 'dashboard' && <Dashboard orders={orders} currentRates={{ k24: settings.currentGoldRate24K, k22: settings.currentGoldRate22K }} />}
            {activeTab === 'collections' && <PaymentCollections orders={orders} onViewOrder={setSelectedOrderId} onSendWhatsApp={() => {}} settings={settings} />}
            {activeTab === 'customers' && <CustomerList customers={customers} orders={orders} onViewOrder={setSelectedOrderId} onMessageSent={handleAddLog} onAddCustomer={handleAddCustomer} />}
            {activeTab === 'whatsapp' && <WhatsAppPanel logs={whatsAppLogs} customers={customers} onRefreshStatus={() => {}} templates={waTemplates} initialContact={selectedContact} onAddLog={handleAddLog} />}
            
            {/* RESTORED MODULES */}
            {activeTab === 'market' && <MarketIntelligence />}
            {activeTab === 'plans' && <PlanManager templates={planTemplates} onUpdate={setPlanTemplates} />}
            {activeTab === 'templates' && <WhatsAppTemplates templates={waTemplates} onUpdate={setWaTemplates} />}
            {activeTab === 'waLogs' && <WhatsAppLogs logs={whatsAppLogs} onViewChat={(phone) => { setActiveTab('whatsapp'); setSelectedContact(phone); }} />}
            
            {activeTab === 'errors' && <ErrorLogPanel errors={systemErrors} activities={activityLogs} onClear={() => { errorService.clearErrors(); errorService.clearActivity(); }} />}
            {activeTab === 'settings' && <Settings settings={settings} onUpdate={setSettings} />}
            {activeTab === 'orders' && <div className="grid gap-4">{orders.map(order => (<div key={order.id} onClick={() => setSelectedOrderId(order.id)} className="bg-white p-6 rounded-2xl border flex justify-between gap-6 hover:shadow-lg cursor-pointer transition-all"><div className="flex gap-6"><div className="w-20 h-20 bg-slate-100 rounded-xl overflow-hidden shrink-0 border relative"><img src={order.items[0]?.photoUrls[0]} className="w-full h-full object-cover" /><div className="absolute bottom-1 right-1 bg-amber-500 text-white p-1 rounded-md"><BookOpen size={10} /></div></div><div><div className="flex items-center gap-3 mb-1"><h3 className="text-lg font-bold">{order.customerName}</h3><span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${order.status === OrderStatus.OVERDUE ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>{order.status}</span></div><p className="text-sm text-slate-500">{order.items.length} Item(s) • INR {order.totalAmount.toLocaleString()}</p></div></div></div>))}</div>}
         </>
        }
      </main>
    </div>
  );
};

export default App;
