import React, { useState, useEffect } from 'react';
import { Camera, Plus, ChevronRight, Calculator, Calendar, ShieldCheck, Info, Trash2, PlusCircle, ShoppingBag, X, Loader2, CloudUpload, UserCheck, Zap, Images, AlertCircle, CalendarClock, ShieldAlert, Sparkles, Send } from 'lucide-react';
import { 
  Order, JewelryDetail, PaymentPlan, Milestone, OrderStatus, GlobalSettings, PaymentPlanTemplate, ProductionStatus, Customer, ProtectionStatus
} from '../types';
import { PURITY_OPTIONS, JEWELRY_CATEGORIES } from '../constants';
import { compressImage } from '../services/imageOptimizer';
import { whatsappService } from '../services/whatsappService';

interface OrderFormProps {
  settings: GlobalSettings;
  planTemplates: PaymentPlanTemplate[];
  existingCustomers: Customer[];
  onSubmit: (order: Order) => void;
  onCancel: () => void;
}

const OrderForm: React.FC<OrderFormProps> = ({ settings, planTemplates, existingCustomers, onSubmit, onCancel }) => {
  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState({ name: '', contact: '', email: '' });
  const [isAutoFilled, setIsAutoFilled] = useState(false);
  
  const [orderRate24K, setOrderRate24K] = useState(settings.currentGoldRate24K);
  const [orderRate22K, setOrderRate22K] = useState(settings.currentGoldRate22K);
  
  const [cartItems, setCartItems] = useState<JewelryDetail[]>([]);
  const [cartTotal, setCartTotal] = useState(0);
  const [additionalCharges, setAdditionalCharges] = useState(0);

  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialJewelryState: Partial<JewelryDetail> = {
    category: JEWELRY_CATEGORIES[0], metalColor: 'Yellow Gold',
    grossWeight: 0, netWeight: 0, wastagePercentage: 12,
    makingChargesPerGram: 450, stoneCharges: 0, purity: '22K',
    customizationDetails: '', productionStatus: ProductionStatus.DESIGNING,
    photoUrls: []
  };
  const [currentItem, setCurrentItem] = useState<Partial<JewelryDetail>>(initialJewelryState);

  const [currentPricing, setCurrentPricing] = useState({ metalValue: 0, wastageValue: 0, laborValue: 0, tax: 0, total: 0 });
  const enabledTemplates = planTemplates.filter(t => t.enabled);

  const [plan, setPlan] = useState<Partial<PaymentPlan>>({
    type: 'PRE_CREATED',
    months: 6,
    interestPercentage: 0,
    advancePercentage: 10,
    goldRateProtection: true,
    protectionLimit: settings.goldRateProtectionMax,
    protectionRateBooked: settings.currentGoldRate22K,
    protectionDeadline: '',
    milestones: [],
    protectionStatus: ProtectionStatus.ACTIVE
  });

  const grandTotal = cartTotal + (cartTotal * ((plan.interestPercentage || 0) / 100)) + additionalCharges;

  // Manual Milestones Logic
  const [manualMilestones, setManualMilestones] = useState<Partial<Milestone>[]>([
      { id: 'm1', dueDate: new Date().toISOString().split('T')[0], cumulativeTarget: 0, targetAmount: 0, warningCount: 0 }
  ]);

  const allocatedTotal = manualMilestones.reduce((acc, m) => acc + (m.targetAmount || 0), 0);
  const remainingToAllocate = grandTotal - allocatedTotal;

  const addManualMilestone = () => {
      // Logic: Autofill with remaining balance
      const nextCum = (manualMilestones[manualMilestones.length - 1]?.cumulativeTarget || 0) + remainingToAllocate;
      
      const newMs: Partial<Milestone> = { 
          id: `m-${Date.now()}`, 
          dueDate: '', 
          cumulativeTarget: Math.round(nextCum), 
          targetAmount: Math.round(remainingToAllocate),
          warningCount: 0
      };
      setManualMilestones([...manualMilestones, newMs]);
  };

  const removeManualMilestone = (id: string) => {
      setManualMilestones(manualMilestones.filter(m => m.id !== id));
  };

  const updateManualMilestone = (id: string, field: keyof Milestone, value: any) => {
      const updated = manualMilestones.map(m => {
          if (m.id !== id) return m;
          return { ...m, [field]: value };
      });
      
      let prevCumulative = 0;
      const final = updated.map(m => {
          const discreteAmount = (m.cumulativeTarget || 0) - prevCumulative;
          prevCumulative = m.cumulativeTarget || 0;
          return { ...m, targetAmount: discreteAmount };
      });
      
      setManualMilestones(final);
  };

  // Logic: Protection Deadline is always the last milestone date
  useEffect(() => {
      const lastMs = manualMilestones[manualMilestones.length - 1];
      if (lastMs?.dueDate) {
          setPlan(p => ({ ...p, protectionDeadline: lastMs.dueDate }));
      }
  }, [manualMilestones]);

  useEffect(() => {
    if (customer.contact.length >= 4) {
      const found = existingCustomers.find(c => c.contact === customer.contact);
      if (found) {
        setCustomer(prev => ({ ...prev, name: found.name, email: found.email || prev.email }));
        setIsAutoFilled(true);
      } else { setIsAutoFilled(false); }
    }
  }, [customer.contact, existingCustomers]);

  useEffect(() => {
    const rate = currentItem.purity === '24K' ? orderRate24K : orderRate22K;
    const metalValue = (currentItem.netWeight || 0) * rate;
    const wastageValue = metalValue * ((currentItem.wastagePercentage || 0) / 100);
    const laborValue = (currentItem.makingChargesPerGram || 0) * (currentItem.netWeight || 0);
    const subTotal = metalValue + wastageValue + laborValue + (currentItem.stoneCharges || 0);
    const tax = subTotal * (settings.defaultTaxRate / 100);
    setCurrentPricing({ metalValue, wastageValue, laborValue: laborValue + (currentItem.stoneCharges || 0), tax, total: subTotal + tax });
  }, [currentItem, orderRate24K, orderRate22K, settings]);

  useEffect(() => {
    setCartTotal(cartItems.reduce((sum, item) => sum + item.finalAmount, 0));
  }, [cartItems]);

  const addItemToCart = () => {
    if (!currentItem.netWeight || currentItem.netWeight <= 0) return alert("Please enter valid weight");
    setCartItems([...cartItems, { ...currentItem, id: `ITEM-${Date.now()}`, baseMetalValue: currentPricing.metalValue, wastageValue: currentPricing.wastageValue, totalLaborValue: currentPricing.laborValue, taxAmount: currentPricing.tax, finalAmount: currentPricing.total } as JewelryDetail]);
    setCurrentItem(initialJewelryState);
  };

  const generateMilestones = () => {
    if (plan.type === 'MANUAL') return;
    const total = grandTotal;
    const advanceAmount = total * ((plan.advancePercentage || 0) / 100);
    const remaining = total - advanceAmount;
    const perMonth = remaining / (plan.months || 1);
    const ms: Milestone[] = [];
    ms.push({ id: 'adv', dueDate: new Date().toISOString().split('T')[0], targetAmount: Math.round(advanceAmount), cumulativeTarget: Math.round(advanceAmount), status: 'PENDING', warningCount: 0 });
    for (let i = 1; i <= (plan.months || 1); i++) {
      const date = new Date(); date.setMonth(date.getMonth() + i);
      const cum = advanceAmount + (perMonth * i);
      ms.push({ id: `m${i}`, dueDate: date.toISOString().split('T')[0], targetAmount: Math.round(perMonth), cumulativeTarget: Math.round(cum), status: 'PENDING', warningCount: 0 });
    }
    setPlan(prev => ({ ...prev, milestones: ms }));
    // Regular plan also sets deadline to last milestone
    if (ms.length > 0) setPlan(p => ({ ...p, protectionDeadline: ms[ms.length - 1].dueDate }));
  };
  
  useEffect(() => { if(step === 3 && plan.type !== 'MANUAL') generateMilestones(); }, [step, plan.months, plan.interestPercentage, plan.advancePercentage, cartTotal, additionalCharges]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setIsCompressing(true);
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
          try { newUrls.push(await compressImage(files[i])); } catch (err) {}
      }
      setCurrentItem(prev => ({ ...prev, photoUrls: [...(prev.photoUrls || []), ...newUrls] }));
      setIsCompressing(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (cartItems.length === 0) return alert("Cart is empty!");
    if (!customer.name || !customer.contact) return alert("Customer details missing!");
    
    let finalMilestones = plan.milestones || [];
    if (plan.type === 'MANUAL') {
        const allocated = manualMilestones.reduce((acc, m) => acc + (m.targetAmount || 0), 0);
        if (Math.abs(grandTotal - allocated) > 1) {
            return alert(`Incomplete Allocation: You have allocated ₹${allocated.toLocaleString()} but the total is ₹${grandTotal.toLocaleString()}. All money must be allocated to dates.`);
        }
        finalMilestones = manualMilestones as Milestone[];
    }

    const newOrder: Order = {
      id: `ORD-${Date.now()}`,
      shareToken: Math.random().toString(36).substring(2, 15),
      customerName: customer.name, customerContact: customer.contact, customerEmail: customer.email,
      items: cartItems, additionalCharges, totalAmount: grandTotal, originalTotalAmount: grandTotal,
      paymentPlan: { ...plan, milestones: finalMilestones } as PaymentPlan,
      payments: [], status: OrderStatus.ACTIVE, createdAt: new Date().toISOString()
    };

    setIsSubmitting(true);

    try {
        // --- WhatsApp Notification Trigger ---
        const itemSummary = newOrder.items.map(i => i.category).join(', ');
        const planName = newOrder.paymentPlan.type === 'MANUAL' ? 'Custom Negotiated Plan' : `${newOrder.paymentPlan.months} Months Installment`;
        
        // Prepare 6 milestone slots for the specific template structure
        const slots = [];
        for(let i=0; i<6; i++) {
            if (i < finalMilestones.length) {
                slots.push(new Date(finalMilestones[i].dueDate).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'}));
                slots.push(`₹${finalMilestones[i].targetAmount.toLocaleString()}`);
            } else {
                slots.push("-");
                slots.push("-");
            }
        }

        const shareLink = `${window.location.origin}?view=${newOrder.shareToken}`;

        // Variables: Name, Items, Total, Terms, M1Date, M1Amt ... M6Amt, Link
        const variables = [
            newOrder.customerName,
            itemSummary,
            `₹${newOrder.totalAmount.toLocaleString()}`,
            planName,
            ...slots,
            shareLink
        ];

        // Fire & Forget (or await if strict)
        await whatsappService.sendTemplateMessage(
            newOrder.customerContact,
            'order_milestones_payment_terms',
            'en_US',
            variables,
            newOrder.customerName
        );
        
    } catch (e) {
        console.error("WhatsApp notification failed", e);
    }

    onSubmit(newOrder);
    setIsSubmitting(false);
  };

  const isAllocated = Math.abs(grandTotal - allocatedTotal) < 1;

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-6xl mx-auto border border-slate-100">
      <div className="flex border-b bg-slate-50">
        {[1, 2, 3].map(s => (
          <div key={s} className={`flex-1 p-5 text-center text-sm font-bold transition-all ${step === s ? 'bg-white text-amber-700 border-b-4 border-amber-500 shadow-sm' : 'text-slate-400 opacity-60'}`}>
            Step {s}: {s === 1 ? 'Items & Cart' : s === 2 ? 'Customer Info' : 'Payment Plan'}
          </div>
        ))}
      </div>

      <div className="p-4 md:p-8">
        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fadeIn">
            <div className="lg:col-span-7 space-y-6">
               <div className="bg-slate-900 rounded-2xl p-5 text-white">
                  <div className="flex justify-between items-center mb-4">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/20 rounded-lg"><Zap size={18} className="text-amber-400" /></div>
                        <div><h4 className="text-sm font-black uppercase tracking-widest">Live Negotiation Rates</h4></div>
                     </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">24K Rate (₹/g)</label><input type="number" className="w-full bg-slate-800 border-slate-700 rounded-xl p-3 text-sm font-black text-amber-400 focus:ring-1 focus:ring-amber-500 outline-none" value={orderRate24K} onChange={e => setOrderRate24K(parseFloat(e.target.value) || 0)} /></div>
                     <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">22K Rate (₹/g)</label><input type="number" className="w-full bg-slate-800 border-slate-700 rounded-xl p-3 text-sm font-black text-amber-400 focus:ring-1 focus:ring-amber-500 outline-none" value={orderRate22K} onChange={e => setOrderRate22K(parseFloat(e.target.value) || 0)} /></div>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Category</label><select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-amber-500" value={currentItem.category} onChange={e => setCurrentItem({...currentItem, category: e.target.value})}>{JEWELRY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Metal Color</label><select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-amber-500" value={currentItem.metalColor} onChange={e => setCurrentItem({...currentItem, metalColor: e.target.value as any})}><option value="Yellow Gold">Yellow Gold</option><option value="Rose Gold">Rose Gold</option><option value="White Gold">White Gold</option></select></div>
               </div>

               <div className="grid grid-cols-3 gap-4">
                  <div><label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Net Wt (g)</label><input type="number" className="w-full border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-amber-500" value={currentItem.netWeight || ''} onChange={e => setCurrentItem({...currentItem, netWeight: parseFloat(e.target.value)})} /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Wastage %</label><input type="number" className="w-full border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-amber-500" value={currentItem.wastagePercentage || ''} onChange={e => setCurrentItem({...currentItem, wastagePercentage: parseFloat(e.target.value)})} /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Purity</label><select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-amber-500" value={currentItem.purity} onChange={e => setCurrentItem({...currentItem, purity: e.target.value})}>{PURITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
               </div>

               <div><label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Item Assets</label><div className="space-y-4"><div className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors relative cursor-pointer group"><input type="file" accept="image/*" multiple onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />{isCompressing ? <div className="flex flex-col items-center"><Loader2 className="animate-spin mb-2" /><span className="text-xs font-bold">Processing...</span></div> : <><CloudUpload size={28} className="mb-2 group-hover:text-amber-500 transition-colors" /><span className="text-xs font-black uppercase tracking-wider">Upload Multi-Photos</span></>}</div></div></div>
               
               <button onClick={addItemToCart} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg"><PlusCircle size={20} /> Add Item to Cart</button>
            </div>

            <div className="lg:col-span-5 space-y-6">
               <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 shadow-sm space-y-3">
                  <h3 className="font-black text-amber-800 flex items-center gap-2"><Calculator size={18}/> Pricing Summary</h3>
                  <div className="flex justify-between text-sm text-amber-900/70"><span>Rate ({currentItem.purity})</span><span className="font-bold">₹{(currentItem.purity === '24K' ? orderRate24K : orderRate22K).toLocaleString()}/g</span></div>
                  <div className="flex justify-between text-sm text-amber-900/70"><span>Metal + VA</span><span>₹{(currentPricing.metalValue + currentPricing.wastageValue).toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm text-amber-900/70"><span>Labor & Stone</span><span>₹{currentPricing.laborValue.toLocaleString()}</span></div>
                  <div className="border-t border-amber-200 pt-3 flex justify-between font-black text-xl text-amber-900"><span>Item Total</span><span>₹{currentPricing.total.toLocaleString()}</span></div>
               </div>

               <div className="bg-white border rounded-3xl p-6 shadow-sm min-h-[300px] flex flex-col">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><ShoppingBag size={18}/> Order Items ({cartItems.length})</h3>
                  <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px]">{cartItems.length === 0 && <p className="text-center text-slate-400 text-sm py-10">Empty.</p>}{cartItems.map(item => (<div key={item.id} className="flex gap-3 items-start border-b pb-3 last:border-0"><div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden shrink-0"><img src={item.photoUrls[0]} className="w-full h-full object-cover" /></div><div className="flex-1"><p className="font-bold text-sm text-slate-800">{item.category}</p><p className="text-xs text-slate-500">{item.netWeight}g • {item.metalColor}</p></div><div className="text-right"><p className="font-bold text-sm">₹{item.finalAmount.toLocaleString()}</p></div></div>))}</div>
                  <div className="border-t pt-4 mt-2"><div className="flex justify-between items-center mb-4"><span className="font-bold text-slate-500">Cart Total</span><span className="font-black text-2xl text-slate-900">₹{cartTotal.toLocaleString()}</span></div><button onClick={() => cartItems.length > 0 && setStep(2)} disabled={cartItems.length === 0} className="w-full bg-amber-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-amber-700 transition-all">Proceed <ChevronRight size={18} /></button></div>
               </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
             <div className="text-center mb-6"><h3 className="text-2xl font-black text-slate-800">Customer Details</h3></div>
             <div className="space-y-4 bg-white p-8 rounded-3xl border shadow-sm relative">{isAutoFilled && <div className="absolute top-4 right-4 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1 animate-fadeIn"><UserCheck size={12} /> Recognized</div>}<div><label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Phone Number</label><input type="tel" className="w-full border border-slate-200 rounded-xl p-4 outline-none focus:ring-2 focus:ring-amber-500 font-bold tracking-wider" value={customer.contact} onChange={e => setCustomer({...customer, contact: e.target.value})} placeholder="9876543210" /></div><div><label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Full Name</label><input type="text" className="w-full border border-slate-200 rounded-xl p-4 outline-none focus:ring-2 focus:ring-amber-500 font-bold" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} /></div></div>
             <div className="flex gap-4"><button onClick={() => setStep(1)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-xl">Back</button><button onClick={() => (customer.name && customer.contact) ? setStep(3) : alert("Fill details")} className="flex-1 py-4 bg-amber-600 text-white font-bold rounded-xl shadow-lg">Proceed to Plan</button></div>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fadeIn">
             <div className="lg:col-span-5 space-y-6">
                <div className="bg-slate-50 p-6 rounded-3xl border space-y-4">
                   <h3 className="font-bold text-slate-800 flex items-center gap-2"><CalendarClock size={18}/> Payment Architect</h3>
                   
                   <div className="flex bg-white rounded-lg p-1 border">
                      <button onClick={() => setPlan(p => ({...p, type: 'PRE_CREATED'}))} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${plan.type === 'PRE_CREATED' ? 'bg-amber-100 text-amber-800' : 'text-slate-500'}`}>Templates</button>
                      <button onClick={() => setPlan(p => ({...p, type: 'MANUAL'}))} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${plan.type === 'MANUAL' ? 'bg-amber-100 text-amber-800' : 'text-slate-500'}`}>Negotiated (Manual)</button>
                   </div>

                   <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Additional Charges (Extras)</label>
                      <div className="relative">
                         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                         <input type="number" className="w-full border rounded-lg p-2 pl-7 font-bold" value={additionalCharges || ''} onChange={e => setAdditionalCharges(parseFloat(e.target.value) || 0)} placeholder="e.g. Hallmarking, Freight" />
                      </div>
                   </div>

                   {plan.type === 'MANUAL' ? (
                      <div className="space-y-4">
                         <div className="flex justify-between items-center">
                            <p className="text-[10px] font-black uppercase text-amber-600">Payment Milestones</p>
                            <button onClick={addManualMilestone} disabled={remainingToAllocate <= 0} className="text-[10px] font-black uppercase bg-slate-900 text-white px-2 py-1 rounded flex items-center gap-1 hover:bg-slate-800 disabled:opacity-30"><Plus size={10}/> Add Row (Autofill)</button>
                         </div>
                         
                         <div className="space-y-3">
                            {manualMilestones.map((m, idx) => (
                               <div key={m.id} className="bg-white p-3 rounded-xl border flex flex-col gap-2 relative group shadow-sm">
                                  {idx > 0 && <button onClick={() => removeManualMilestone(m.id!)} className="absolute -top-2 -right-2 bg-rose-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={10}/></button>}
                                  <div className="grid grid-cols-2 gap-2">
                                     <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase">Target Date</label>
                                        <input type="date" className="w-full border rounded-lg p-1.5 text-xs font-bold" value={m.dueDate} onChange={e => updateManualMilestone(m.id!, 'dueDate', e.target.value)} />
                                     </div>
                                     <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase">Total to be Paid Until This Date</label>
                                        <input type="number" className="w-full border rounded-lg p-1.5 text-xs font-bold" value={m.cumulativeTarget || ''} onChange={e => updateManualMilestone(m.id!, 'cumulativeTarget', parseFloat(e.target.value))} />
                                     </div>
                                  </div>
                                  <div className="flex justify-between items-center bg-slate-50 px-2 py-1 rounded">
                                     <span className="text-[9px] font-bold text-slate-400">Installment Amount:</span>
                                     <span className="text-[10px] font-black text-slate-800">₹{m.targetAmount?.toLocaleString()}</span>
                                  </div>
                               </div>
                            ))}
                         </div>
                      </div>
                   ) : (
                      <div className="space-y-2">
                         {enabledTemplates.map(t => (
                           <div key={t.id} onClick={() => setPlan(prev => ({ ...prev, templateId: t.id, months: t.months, interestPercentage: t.interestPercentage, advancePercentage: t.advancePercentage }))} className={`p-3 border rounded-xl cursor-pointer transition-all ${plan.templateId === t.id ? 'border-amber-500 bg-amber-50' : 'bg-white hover:border-slate-300'}`}>
                             <p className="font-bold text-sm text-slate-800">{t.name}</p>
                             <p className="text-xs text-slate-500">{t.months} Months • {t.advancePercentage}% Advance</p>
                           </div>
                         ))}
                      </div>
                   )}
                   
                   {/* Gold Rate Protection Section */}
                   <div className="bg-white p-5 rounded-2xl border-2 border-amber-100 space-y-4">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative">
                          <input type="checkbox" checked={plan.goldRateProtection} onChange={e => setPlan({...plan, goldRateProtection: e.target.checked})} className="sr-only" />
                          <div className={`w-10 h-5 rounded-full transition-all ${plan.goldRateProtection ? 'bg-amber-50' : 'bg-slate-200'}`}></div>
                          <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-all ${plan.goldRateProtection ? 'translate-x-5' : 'translate-x-0'}`}></div>
                        </div>
                        <span className="text-xs font-black uppercase text-amber-700 flex items-center gap-2">
                           <ShieldCheck size={14}/> Enable Gold Rate Protection
                        </span>
                      </label>

                      {plan.goldRateProtection && (
                         <div className="space-y-3 animate-fadeIn">
                            <div>
                               <label className="text-[10px] font-black uppercase text-slate-400">Rate Booked (per gram)</label>
                               <input type="number" className="w-full border rounded-lg p-2 font-bold text-sm mt-1" value={plan.protectionRateBooked} onChange={e => setPlan({...plan, protectionRateBooked: parseFloat(e.target.value)})} />
                            </div>
                            <div>
                               <label className="text-[10px] font-black uppercase text-slate-400">Fluctuation Limit (INR/g)</label>
                               <input type="number" className="w-full border rounded-lg p-2 font-bold text-sm mt-1" value={plan.protectionLimit} onChange={e => setPlan({...plan, protectionLimit: parseFloat(e.target.value)})} />
                            </div>
                            <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                               <p className="text-[10px] font-black uppercase text-amber-800 flex items-center gap-1.5 mb-1"><Sparkles size={10}/> Intelligent Policy Applied</p>
                               <p className="text-[9px] text-amber-700 leading-relaxed italic">
                                  Policy: Valid if paid strictly on time. Missed milestones trigger warnings every 3 hours. 7-day grace period applies before full protection lapse.
                                </p>
                            </div>
                            <div>
                               <label className="text-[10px] font-black uppercase text-slate-400">Final Settlement Deadline</label>
                               <div className="w-full border rounded-lg p-2 font-bold text-sm mt-1 bg-slate-50 text-slate-500 flex items-center gap-2">
                                  <Calendar size={12} /> {plan.protectionDeadline || 'Set milestones first'}
                               </div>
                               <p className="text-[8px] text-slate-400 mt-1 uppercase font-bold tracking-widest">* Linked to final milestone date</p>
                            </div>
                         </div>
                      )}
                   </div>
                </div>

                <button 
                    onClick={handleFinalSubmit} 
                    disabled={(plan.type === 'MANUAL' && !isAllocated) || isSubmitting} 
                    className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black uppercase text-sm tracking-widest hover:bg-emerald-700 transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isSubmitting ? (
                        <> <Loader2 className="animate-spin" size={16} /> Confirming... </>
                    ) : (
                        <> <Send size={16} /> Confirm & Send WhatsApp </>
                    )}
                </button>
                <button onClick={() => setStep(2)} disabled={isSubmitting} className="w-full bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-xs uppercase hover:bg-slate-200 transition-all">Back</button>
             </div>

             <div className="lg:col-span-7">
                <div className="bg-white border rounded-3xl p-8 shadow-sm h-full flex flex-col">
                   <h3 className="font-black text-xl text-slate-800 mb-6 flex items-center gap-2"><Calendar className="text-amber-500"/> Negotiated Ledger Preview</h3>
                   
                   <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="p-4 bg-slate-50 rounded-2xl border">
                         <span className="text-[10px] font-black uppercase text-slate-400">Order Grand Total</span>
                         <p className="text-xl font-black text-slate-800">₹{grandTotal.toLocaleString()}</p>
                      </div>
                      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                         <span className="text-[10px] font-black uppercase text-amber-600">Remaining Balance</span>
                         <p className={`text-xl font-black ${remainingToAllocate < 1 ? 'text-emerald-600' : 'text-rose-600'}`}>₹{remainingToAllocate.toLocaleString()}</p>
                      </div>
                   </div>

                   {!isAllocated && plan.type === 'MANUAL' && (
                       <div className="mb-6 p-4 bg-rose-50 text-rose-700 rounded-2xl flex items-center gap-3 animate-pulse border border-rose-100">
                          <AlertCircle size={20}/>
                          <p className="text-xs font-bold">Unallocated Balance: ₹{remainingToAllocate.toLocaleString()}. Click 'Add Row' to assign to a date.</p>
                       </div>
                   )}

                   <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Schedule View</p>
                      {(plan.type === 'MANUAL' ? manualMilestones : plan.milestones)?.map((m, idx) => (
                        <div key={m.id} className="flex justify-between items-center p-4 border rounded-2xl bg-white hover:border-amber-300 transition-all shadow-sm">
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-black">{idx + 1}</div>
                              <div>
                                 <p className="font-bold text-slate-800 text-sm">₹{m.targetAmount?.toLocaleString()}</p>
                                 <p className="text-[10px] text-slate-400 font-bold uppercase">{m.dueDate ? new Date(m.dueDate).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'}) : 'TBD'}</p>
                              </div>
                           </div>
                           <div className="text-right">
                              <p className="text-[9px] font-black uppercase text-slate-300">Cumulative Reach</p>
                              <p className="text-xs font-black text-slate-400">₹{m.cumulativeTarget?.toLocaleString()}</p>
                           </div>
                        </div>
                      ))}
                   </div>

                   {plan.goldRateProtection && (
                       <div className="mt-8 p-6 bg-slate-900 text-white rounded-[2rem] relative overflow-hidden">
                           <div className="relative z-10">
                              <div className="flex items-center gap-2 mb-2 text-amber-400"><ShieldAlert size={18}/><h4 className="text-sm font-black uppercase tracking-widest">Rate-Lock Active</h4></div>
                              <p className="text-xs text-slate-400 leading-relaxed">Protecting up to <strong>₹{plan.protectionLimit}/g</strong> above booked rate <strong>₹{plan.protectionRateBooked}/g</strong>. Validity expires if any milestone is missed beyond the 7-day grace period.</p>
                           </div>
                           <ShieldCheck className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10" />
                       </div>
                   )}
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderForm;