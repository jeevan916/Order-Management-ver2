
import { errorService } from './errorService';
import { proxyService } from './proxyService';

export interface GoldRateResponse {
  rate24K: number;
  rate22K: number;
  success: boolean;
  error?: string;
  source?: string;
}

export const goldRateService = {
  async fetchLiveRate(forceRefresh: boolean = false): Promise<GoldRateResponse> {
    if (!forceRefresh) {
        try {
          const cached = localStorage.getItem('aura_gold_rate_cache');
          if (cached) {
              const { rate24K, rate22K, timestamp } = JSON.parse(cached);
              // 4 hours validity
              if (Date.now() - timestamp < 14400000) {
                  return { rate24K, rate22K, success: true, source: "Cache" };
              }
          }
        } catch(e) { console.warn("Cache error", e); }
    }

    const TARGET_URL = "https://uat.batuk.in/augmont/gold";

    try {
        const result = await proxyService.fetchJson<any>(TARGET_URL);

        if (!result.success || !result.data) {
            throw new Error(result.error || "Proxy fetch failed");
        }

        const data = result.data;
        const rateObj = data?.data?.[0]?.[0];
        const rawRate = rateObj?.gSell || rateObj?.gBuy;

        if (rawRate) {
            const rate24K = parseFloat(rawRate);
            if (isNaN(rate24K) || rate24K === 0) throw new Error("Invalid rate value");

            const rate22K = Math.round(rate24K * 0.916);

            try {
                localStorage.setItem('aura_gold_rate_cache', JSON.stringify({ 
                    rate24K, rate22K, timestamp: Date.now() 
                }));
            } catch (e) {}

            return { rate24K, rate22K, success: true, source: `Augmont (${result.source})` };
        } else {
            throw new Error("Data format mismatch");
        }

    } catch (e: any) {
        console.warn(`Gold Rate Sync Failed: ${e.message}`);
        
        // Recover from cache if possible, even if expired
        const stale = localStorage.getItem('aura_gold_rate_cache');
        if (stale) {
            try {
                const { rate24K, rate22K } = JSON.parse(stale);
                return { rate24K, rate22K, success: true, source: "Offline Cache (Stale)" };
            } catch(err) {}
        }

        // Default Fallback
        return { rate24K: 7200, rate22K: 6600, success: false, error: e.message };
    }
  }
};
