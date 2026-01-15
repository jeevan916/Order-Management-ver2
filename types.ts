
export enum OrderStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED'
}

export enum ProductionStatus {
  DESIGNING = 'DESIGNING',
  PRODUCTION = 'PRODUCTION',
  QUALITY_CHECK = 'QC',
  READY = 'READY',
  DELIVERED = 'DELIVERED'
}

export enum ProtectionStatus {
  ACTIVE = 'ACTIVE',
  WARNING = 'WARNING',
  LAPSED = 'LAPSED'
}

export interface JewelryDetail {
  id: string;
  category: string;
  metalColor: 'Yellow Gold' | 'Rose Gold' | 'White Gold';
  grossWeight: number;
  netWeight: number;
  wastagePercentage: number; // VA (Value Addition)
  makingChargesPerGram: number;
  stoneCharges: number;
  purity: string;
  customizationDetails: string;
  photoUrls: string[]; 
  baseMetalValue: number;
  wastageValue: number;
  totalLaborValue: number;
  taxAmount: number;
  finalAmount: number;
  productionStatus: ProductionStatus;
}

export interface Milestone {
  id: string;
  dueDate: string;
  targetAmount: number; 
  cumulativeTarget: number; 
  status: 'PENDING' | 'PAID' | 'PARTIAL';
  warningCount: number; // New: tracking the 3-hour cycle
  lastWarningSentAt?: string; // ISO timestamp
}

export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: string;
  note?: string;
}

export interface PaymentPlanTemplate {
  id: string;
  name: string;
  months: number;
  interestPercentage: number;
  advancePercentage: number;
  enabled: boolean;
}

export interface PaymentPlan {
  id: string;
  type: 'PRE_CREATED' | 'MANUAL';
  templateId?: string;
  months: number;
  interestPercentage: number;
  advancePercentage: number;
  milestones: Milestone[];
  goldRateProtection: boolean;
  protectionLimit: number; 
  protectionRateBooked: number; 
  protectionDeadline: string; 
  protectionStatus: ProtectionStatus; // New: replaces simple boolean
  gracePeriodEndAt?: string; // 7 days from first missed milestone
  finalDueDate?: string;
}

export interface Order {
  id: string;
  shareToken: string;
  customerName: string;
  customerContact: string;
  secondaryContact?: string;
  customerEmail: string;
  items: JewelryDetail[];
  additionalCharges: number; 
  totalAmount: number; 
  originalTotalAmount: number; // Store total at booking for comparison after lapse
  paymentPlan: PaymentPlan;
  payments: PaymentRecord[];
  status: OrderStatus;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  contact: string;
  secondaryContact?: string;
  email: string;
  orderIds: string[];
  totalSpent: number;
  joinDate: string;
  reliabilityScore?: number; 
  behavioralTag?: 'VIP_RELIABLE' | 'FORGETFUL' | 'STRATEGIC_DELAYER' | 'HIGH_RISK' | 'UNKNOWN';
  aiInsight?: string;
  lastAnalysisDate?: string;
}

export type CollectionTone = 'POLITE' | 'FIRM' | 'URGENT_PANIC' | 'ENCOURAGING_TRICK';

export interface NotificationTrigger {
  id: string;
  type: 'UPCOMING' | 'OVERDUE' | 'SUCCESS' | 'GENERAL' | 'PROTECTION_LAPSE' | 'PROTECTION_WARNING';
  orderId: string;
  customerName: string;
  message: string;
  date: string;
  sent: boolean;
  strategyReasoning?: string;
  tone?: CollectionTone;
}

export interface GlobalSettings {
  currentGoldRate24K: number;
  currentGoldRate22K: number;
  defaultTaxRate: number;
  goldRateProtectionMax: number;
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string; 
  whatsappBusinessToken?: string;
}

export type MessageStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface WhatsAppLogEntry {
  id: string;
  customerName: string;
  phoneNumber: string;
  message: string;
  status: MessageStatus;
  timestamp: string;
  type: 'TEMPLATE' | 'CUSTOM' | 'AI_RECOVERY' | 'INBOUND' | 'SYSTEM_ALERT';
  context?: string; 
  direction?: 'outbound' | 'inbound';
}

export type PsychologicalTactic = 'LOSS_AVERSION' | 'SOCIAL_PROOF' | 'AUTHORITY' | 'RECIPROCITY' | 'URGENCY' | 'EMPATHY' | 'MARKET_PANIC' | 'INVENTORY_RELEASE';
export type RiskProfile = 'VIP' | 'REGULAR' | 'FORGETFUL' | 'HIGH_RISK';
export type MetaCategory = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';

// New: Defines the functional group a template belongs to for the app's logic
export type AppTemplateGroup = 'PAYMENT_COLLECTION' | 'ORDER_STATUS' | 'MARKETING_PROMO' | 'GENERAL_SUPPORT' | 'SYSTEM_NOTIFICATIONS' | 'UNCATEGORIZED';

export interface WhatsAppTemplate {
  id: string;
  name: string;
  content: string; 
  tactic: PsychologicalTactic;
  targetProfile: RiskProfile;
  isAiGenerated: boolean;
  performanceRating?: number; 
  structure?: any[]; 
  source?: 'META' | 'LOCAL'; 
  variableExamples?: string[]; 
  status?: 'APPROVED' | 'REJECTED' | 'PENDING' | 'PAUSED' | 'DISABLED'; 
  category?: MetaCategory; 
  appGroup?: AppTemplateGroup; // Added for grouping
}

export interface AiChatInsight {
  intent: string; 
  suggestedReply: string;
  recommendedTemplateId?: string; 
  tone: 'Professional' | 'Empathetic' | 'Firm' | 'Sales-Oriented';
}

export interface CreditworthinessReport {
  score: number; // 0-100
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  persona: string; // e.g. "The Busy Executive", "The Strategic Delayer"
  communicationStrategy: string; // "Use short, direct messages."
  negotiationLeverage: string; // "Mention Gold Rate rising to urge payment."
  recommendedTone: CollectionTone;
  nextBestAction: string;
}

export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'CRITICAL';
export type ErrorStatus = 'NEW' | 'ANALYZING' | 'FIXING' | 'RESOLVED' | 'UNRESOLVABLE';

export type AppResolutionPath = 'settings' | 'templates' | 'whatsapp' | 'waLogs' | 'dashboard' | 'none';

export interface AppError {
  id: string;
  timestamp: string;
  source: string; 
  message: string;
  stack?: string;
  severity: ErrorSeverity;
  status: ErrorStatus;
  aiDiagnosis?: string;
  aiFixApplied?: string;
  resolutionPath?: AppResolutionPath; 
  resolutionCTA?: string; 
  suggestedFixData?: any; 
  retryAction?: () => Promise<void>; 
}

export interface ActivityLogEntry {
    id: string;
    timestamp: string;
    actionType: 'ORDER_CREATED' | 'PAYMENT_RECEIVED' | 'MANUAL_MESSAGE_SENT' | 'TEMPLATE_SENT' | 'PLAN_ADJUSTED' | 'STATUS_UPDATE';
    details: string; 
    metadata?: any; 
}
