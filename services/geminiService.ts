
import { GoogleGenAI } from "@google/genai";
import { Order, Milestone, Customer, PsychologicalTactic, RiskProfile, WhatsAppLogEntry, WhatsAppTemplate, AiChatInsight, ActivityLogEntry, CollectionTone, AppResolutionPath, AppTemplateGroup, MetaCategory, CreditworthinessReport } from "../types";
import { errorService } from "./errorService";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  /**
   * Generates a reminder message using psychological triggers.
   */
  async generateStrategicNotification(
    order: Order, 
    type: 'UPCOMING' | 'OVERDUE' | 'SUCCESS',
    currentGoldRate: number
  ): Promise<{ message: string, tone: CollectionTone, reasoning: string }> {
    const paidSoFar = order.payments.reduce((acc, p) => acc + p.amount, 0);
    const balance = order.totalAmount - paidSoFar;
    
    const prompt = `
      Act as the 'Chief Collection Strategist' for AuraGold Luxury Jewelry.
      **Context:**
      - Customer: ${order.customerName}
      - Balance Due: INR ${balance.toLocaleString()}
      - Milestone Type: ${type}

      **Strategic Objective:**
      Decide the psychological tone and write a WhatsApp message.
      Return JSON: { "tone": "POLITE" | "FIRM" | "URGENT_PANIC" | "ENCOURAGING_TRICK", "reasoning": "...", "message": "..." }
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const data = JSON.parse(response.text || "{}");
      errorService.logActivity('STATUS_UPDATE', `AI Strategy generated for ${order.customerName}`, { tone: data.tone });
      return data;
    } catch (error: any) {
      errorService.logError("GeminiService", `Strategy Generation Failed: ${error.message}`, 'MEDIUM');
      return {
        tone: 'POLITE',
        reasoning: 'Fallback due to AI error.',
        message: `Hello ${order.customerName}, just a reminder regarding your balance for your jewelry order.`
      };
    }
  },

  /**
   * NEW: Generates a full template based on user description + Categorizes it.
   */
  async generateTemplateFromPrompt(userPrompt: string): Promise<{ 
      content: string, 
      suggestedName: string, 
      metaCategory: MetaCategory, 
      appGroup: AppTemplateGroup,
      tactic: PsychologicalTactic,
      examples: string[]
  }> {
      const prompt = `
        You are the Lead WhatsApp Architect for 'AuraGold', a high-end gold jewelry brand.
        
        USER REQUIREMENT: "${userPrompt}"
        
        CONTEXT:
        We need a WhatsApp Template that helps with our specific business functions:
        - Payment Collection (Installments, Overdue)
        - Order Status (Production stages like Casting, Polishing, QC, Ready)
        - Marketing (Offers, New Collections)
        - General Support (Welcome, Address, Timing)
        
        INSTRUCTIONS:
        1. 'content': Create a professional, concise WhatsApp body. Use {{1}}, {{2}} for dynamic data. 
           - Tone: Trustworthy, Luxury, Polite.
           - DO NOT include headers or footers in the content string.
        2. 'suggestedName': technical_snake_case (e.g. order_ready_pickup_v1).
        3. 'metaCategory': Strictly one of ['UTILITY', 'MARKETING', 'AUTHENTICATION'].
        4. 'appGroup': Strictly one of ['PAYMENT_COLLECTION', 'ORDER_STATUS', 'MARKETING_PROMO', 'GENERAL_SUPPORT', 'SYSTEM_NOTIFICATIONS'].
        5. 'tactic': Identify the psychological tactic used (e.g. URGENCY, AUTHORITY, EMPATHY).
        6. 'examples': Provide an array of realistic example strings for the {{1}}, {{2}} variables (e.g. ["John", "Ring"]).

        Return strictly valid JSON.
      `;

      try {
          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: prompt,
              config: { responseMimeType: "application/json" }
          });
          
          let text = response.text || "{}";
          // Robust cleanup for markdown code blocks if they appear
          if (text.includes("```")) {
              text = text.replace(/```json/g, "").replace(/```/g, "");
          }
          
          const result = JSON.parse(text);
          if (!result.content || !result.suggestedName) {
              throw new Error("AI returned incomplete data structure.");
          }
          return result;
      } catch (error: any) {
          errorService.logError("GeminiService", `Template Gen Failed: ${error.message}`, 'MEDIUM');
          throw new Error("AI Template Generation Failed: " + error.message);
      }
  },

  /**
   * DEEP CUSTOMER ANALYSIS
   * Inputs: Financial Data + Communication Logs
   * Output: Creditworthiness & Negotiation Strategy
   */
  async generateDeepCustomerAnalysis(
      customer: Customer,
      orders: Order[],
      logs: WhatsAppLogEntry[]
  ): Promise<CreditworthinessReport> {
      
      // 1. Prepare Financial Digest
      let totalMilestones = 0;
      let lateMilestones = 0;
      let totalDelayDays = 0;
      
      orders.forEach(o => {
          o.paymentPlan.milestones.forEach(m => {
              totalMilestones++;
              const due = new Date(m.dueDate);
              const now = new Date();
              
              if (m.status === 'PAID') {
                  // Find the matching payment (approximation logic)
                  // In a real DB we would link payment ID to milestone ID
              } else if (due < now) {
                  lateMilestones++;
                  const diffTime = Math.abs(now.getTime() - due.getTime());
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                  totalDelayDays += diffDays;
              }
          });
      });

      const avgDelay = lateMilestones > 0 ? Math.round(totalDelayDays / lateMilestones) : 0;
      const paymentReliability = totalMilestones > 0 ? ((totalMilestones - lateMilestones) / totalMilestones) * 100 : 100;

      // 2. Prepare Communication Digest
      const recentLogs = logs.slice(0, 15).map(l => `[${l.direction.toUpperCase()}][${l.status}]: ${l.message}`).join("\n");

      const prompt = `
        Act as a Senior Credit Risk & Behavioral Analyst for a Luxury Gold Jeweler.
        
        Analyze this customer profile:
        - Name: ${customer.name}
        - Total Spent: ₹${customer.totalSpent}
        - Payment Reliability: ${paymentReliability.toFixed(1)}% (Percentage of on-time milestones)
        - Avg Delay on Late Payments: ${avgDelay} days
        
        Recent Communication History:
        ${recentLogs}

        TASK:
        1. Calculate a 'Credit Score' (0-100) based on payment history and communication responsiveness.
        2. Assign a 'Persona' (e.g. 'The Forgetful VIP', 'The Strategic Delayer', 'The Bargain Hunter').
        3. Define a specific 'Negotiation Strategy' to extract payments or close sales.
        4. Suggest the 'Next Best Action'.

        Return JSON matching this interface:
        {
          "score": number,
          "riskLevel": "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
          "persona": string,
          "communicationStrategy": string,
          "negotiationLeverage": string,
          "recommendedTone": "POLITE" | "FIRM" | "URGENT_PANIC" | "ENCOURAGING_TRICK",
          "nextBestAction": string
        }
      `;

      try {
          const response = await ai.models.generateContent({
              model: 'gemini-3-pro-preview',
              contents: prompt,
              config: { responseMimeType: "application/json" }
          });
          const text = response.text || "{}";
          return JSON.parse(text);
      } catch (e: any) {
          errorService.logError('GeminiService', `Deep Analysis Failed: ${e.message}`, 'MEDIUM');
          return {
              score: 50,
              riskLevel: 'MODERATE',
              persona: 'Unknown Entity',
              communicationStrategy: 'Maintain standard professional follow-ups.',
              negotiationLeverage: 'Standard terms.',
              recommendedTone: 'POLITE',
              nextBestAction: 'Manual Review'
          };
      }
  },

  async analyzeCollectionRisk(overdueOrders: Order[]): Promise<string> {
    if (overdueOrders.length === 0) return "No collection risks currently.";
    const summary = overdueOrders.map(o => `${o.customerName}: Due INR ${(o.totalAmount - o.payments.reduce((a,c)=>a+c.amount,0)).toFixed(2)}`).join("\n");
    const prompt = `Analyze overdue orders and suggest recovery strategy:\n${summary}`;

    try {
      const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: prompt });
      return response.text || "Prioritize high-value overdue accounts.";
    } catch (error: any) {
      return "Focus on the oldest overdue accounts first.";
    }
  },

  async generateBehavioralAnalysis(customer: Customer, orders: Order[]) {
    // Legacy function, kept for compatibility, now largely superseded by generateDeepCustomerAnalysis
    const prompt = `Analyze customer ${customer.name}. Format JSON: { "score": number, "tag": "VIP_RELIABLE" | "FORGETFUL" | "STRATEGIC_DELAYER" | "HIGH_RISK", "insight": "string", "suggestedTone": "POLITE" | "FIRM" | "URGENT_PANIC" }`;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      return JSON.parse(response.text || "{}");
    } catch (error) {
      return { score: 50, tag: 'UNKNOWN', insight: "Data insufficient.", suggestedTone: 'POLITE' };
    }
  },

  async diagnoseError(errorMessage: string, source: string): Promise<{ explanation: string, action: string, path: AppResolutionPath, cta: string, suggestedFixData?: any }> {
    const prompt = `
      Analyze this AuraGold system error:
      ERROR: "${errorMessage}" 
      SOURCE: "${source}"

      Context:
      - 'settings': For API key (403), token, or gold rate issues.
      - 'templates': For WhatsApp template naming (132001), formatting, or rejection.
      - 'whatsapp': For general messaging failures.

      Return JSON: 
      { 
        "explanation": "Human readable cause", 
        "action": "REPAIR_TEMPLATE" | "RETRY_API" | "CHECK_CREDENTIALS" | "NONE",
        "path": "settings" | "templates" | "whatsapp" | "waLogs" | "dashboard" | "none",
        "cta": "Fix Now",
        "suggestedFixData": { ... } // If template missing, provide { name, content, category, examples }
      }
    `;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-flash-lite-latest',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        const result = JSON.parse(response.text || '{}');
        return {
            explanation: result.explanation || "Diagnostic incomplete.",
            action: result.action || "NONE",
            path: result.path || "none",
            cta: result.cta || "View Fix",
            suggestedFixData: result.suggestedFixData
        };
    } catch (e: any) { 
        // Log the actual connectivity error to activity for developer inspection
        errorService.logActivity('STATUS_UPDATE', `Gemini Diagnosis Failed: ${e.message}`, { errorCode: e.status });
        return { 
            explanation: "Resolution Engine connectivity lost. Check API credentials in Settings.", 
            action: "NONE", 
            path: 'settings', 
            cta: 'Verify API Key' 
        }; 
    }
  },

  async analyzeChatContext(history: WhatsAppLogEntry[], templates: WhatsAppTemplate[], customerName: string) {
    const prompt = `Analyze chat for ${customerName}. Suggested reply? Tone? JSON { intent, suggestedReply, recommendedTemplateId, tone }`;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      return JSON.parse(response.text || "{}");
    } catch (error) { return { intent: "Unknown", suggestedReply: "", recommendedTemplateId: null, tone: "Professional" }; }
  },

  async suggestMissingTemplates(currentTemplates: any[]): Promise<WhatsAppTemplate[]> {
    const prompt = `Identify missing jewelry store collection templates. JSON array of WhatsAppTemplate objects.`;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      return JSON.parse(response.text || "[]");
    } catch (error) { return []; }
  },

  async generatePersuasiveTemplate(tactic: PsychologicalTactic, profile: RiskProfile): Promise<string> {
    const prompt = `Write persuasive WhatsApp reminder. Tactic: ${tactic}, Profile: ${profile}. {{1}}=name, {{2}}=amount.`;
    try {
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
      return response.text || "Hello {{1}}, just a reminder for your payment.";
    } catch (error) { return "Hello {{1}}, just a reminder for your payment."; }
  },

  async analyzeSystemLogsForImprovements(activities: ActivityLogEntry[]): Promise<{ reasoning: string, suggestion?: any }> {
    const logExcerpt = JSON.stringify(activities.slice(0, 30));
    const prompt = `Analyze logs for workflow improvement suggestions. JSON: { reasoning, suggestion: { name, content, category, variableExamples } }:\n${logExcerpt}`;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      return JSON.parse(response.text || "{}");
    } catch (error: any) { 
        return { reasoning: "Unable to analyze logs at this time." }; 
    }
  }
};
