import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Fetching live exchange rates from Bank of Israel API');

    // Fetch latest exchange rates from Bank of Israel API
    const response = await fetch('https://edge.boi.gov.il/FusionEdgeServer/sdmx-json/v1/data/dataflow/BOI.STATISTICS/EXR/1.0/RER_USD_ILS+RER_EUR_ILS+RER_GBP_ILS+RER_CHF_ILS+RER_JPY_ILS+RER_CAD_ILS?lastNObservations=1');
    
    if (!response.ok) {
      throw new Error('Failed to fetch exchange rates from Bank of Israel');
    }

    const data = await response.json();
    
    // Parse the SDMX-JSON format
    const rates: Record<string, number> = {
      ILS: 1.0, // Base currency
    };

    // Extract rates from the data structure
    const observations = data?.dataSets?.[0]?.observations;
    const series = data?.structure?.dimensions?.series;
    
    if (observations && series) {
      // Map currency codes to rates
      const currencyMap: Record<string, string> = {
        'RER_USD_ILS': 'USD',
        'RER_EUR_ILS': 'EUR', 
        'RER_GBP_ILS': 'GBP',
        'RER_CHF_ILS': 'CHF',
        'RER_JPY_ILS': 'JPY',
        'RER_CAD_ILS': 'CAD',
      };

      Object.entries(observations).forEach(([key, value]: [string, any]) => {
        const seriesIndex = parseInt(key.split(':')[0]);
        const seriesKey = series.find((s: any) => s.id === 'SERIES')?.values[seriesIndex]?.id;
        
        if (seriesKey && currencyMap[seriesKey]) {
          const currency = currencyMap[seriesKey];
          const rate = value[0]; // First value is the exchange rate
          if (rate && typeof rate === 'number') {
            rates[currency] = rate;
          }
        }
      });
    }

    // Add default rates for currencies not provided by BOI
    const defaultRates: Record<string, number> = {
      PLN: 0.88,
      BGN: 2.0,
      CZK: 0.16,
      HUF: 0.01,
      RON: 0.79,
      SEK: 0.35,
      NOK: 0.34,
      DKK: 0.52,
      ISK: 0.026,
      HRK: 0.52,
      RSD: 0.033,
      UAH: 0.09,
      TRY: 0.11,
      MXN: 0.18,
      BRL: 0.63,
      ARS: 0.0035,
      CLP: 0.0037,
      COP: 0.00083,
      PEN: 0.95,
      UYU: 0.08,
      CNY: 0.51,
      KRW: 0.0026,
      HKD: 0.47,
      SGD: 2.76,
      THB: 0.11,
      MYR: 0.83,
      IDR: 0.00023,
      PHP: 0.063,
      VND: 0.00015,
      TWD: 0.11,
      INR: 0.043,
      ZAR: 0.20,
      EGP: 0.069,
      MAD: 0.37,
      TND: 1.18,
      KES: 0.028,
      NGN: 0.0023,
      GHS: 0.24,
      AUD: 2.39,
      NZD: 2.18,
      AED: 1.01,
      SAR: 0.99,
      QAR: 1.02,
      KWD: 12.10,
      JOD: 5.24,
    };

    // Merge with default rates
    Object.entries(defaultRates).forEach(([currency, rate]) => {
      if (!rates[currency]) {
        rates[currency] = rate;
      }
    });

    console.log('Exchange rates fetched successfully:', rates);

    return new Response(
      JSON.stringify({ success: true, rates }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error fetching exchange rates:", error);
    
    // Return fallback rates if API fails
    const fallbackRates = {
      ILS: 1.0,
      USD: 3.7,
      EUR: 3.9,
      GBP: 4.6,
      CHF: 4.1,
      PLN: 0.88,
      BGN: 2.0,
      CZK: 0.16,
      HUF: 0.01,
      RON: 0.79,
      SEK: 0.35,
      NOK: 0.34,
      DKK: 0.52,
      ISK: 0.026,
      HRK: 0.52,
      RSD: 0.033,
      UAH: 0.09,
      TRY: 0.11,
      CAD: 2.6,
      MXN: 0.18,
      BRL: 0.63,
      ARS: 0.0035,
      CLP: 0.0037,
      COP: 0.00083,
      PEN: 0.95,
      UYU: 0.08,
      JPY: 0.024,
      CNY: 0.51,
      KRW: 0.0026,
      HKD: 0.47,
      SGD: 2.76,
      THB: 0.11,
      MYR: 0.83,
      IDR: 0.00023,
      PHP: 0.063,
      VND: 0.00015,
      TWD: 0.11,
      INR: 0.043,
      ZAR: 0.20,
      EGP: 0.069,
      MAD: 0.37,
      TND: 1.18,
      KES: 0.028,
      NGN: 0.0023,
      GHS: 0.24,
      AUD: 2.39,
      NZD: 2.18,
      AED: 1.01,
      SAR: 0.99,
      QAR: 1.02,
      KWD: 12.10,
      JOD: 5.24,
    };

    return new Response(
      JSON.stringify({ success: true, rates: fallbackRates, fallback: true }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
