import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, tripDestination } = await req.json();
    
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Missing image data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Input validation: Check base64 format
    const base64Pattern = /^data:image\/(jpeg|jpg|png|gif|webp|heic|heif);base64,/i;
    if (!base64Pattern.test(imageBase64)) {
      return new Response(
        JSON.stringify({ error: 'Invalid image format. Allowed: JPEG, PNG, GIF, WebP, HEIC' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Input validation: Check file size (base64 is ~1.37x original size)
    const estimatedSizeMB = (imageBase64.length * 0.75) / (1024 * 1024);
    if (estimatedSizeMB > 10) {
      return new Response(
        JSON.stringify({ error: 'Image too large. Maximum size: 10MB' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Analyzing receipt with Lovable AI...', { tripDestination });
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Map countries to their local currencies
    const countryToCurrency: Record<string, string> = {
      // Europe
      'בולגריה': 'BGN', 'bulgaria': 'BGN',
      'פולין': 'PLN', 'poland': 'PLN',
      'הונגריה': 'HUF', 'hungary': 'HUF',
      'צ\'כיה': 'CZK', 'czech': 'CZK',
      'רומניה': 'RON', 'romania': 'RON',
      'שוודיה': 'SEK', 'sweden': 'SEK',
      'נורבגיה': 'NOK', 'norway': 'NOK',
      'דנמרק': 'DKK', 'denmark': 'DKK',
      'שוויץ': 'CHF', 'switzerland': 'CHF',
      'איסלנד': 'ISK', 'iceland': 'ISK',
      'קרואטיה': 'HRK', 'croatia': 'HRK',
      'סרביה': 'RSD', 'serbia': 'RSD',
      'אוקראינה': 'UAH', 'ukraine': 'UAH',
      'טורקיה': 'TRY', 'turkey': 'TRY',
      'בריטניה': 'GBP', 'uk': 'GBP', 'england': 'GBP', 'london': 'GBP',
      // Latin America
      'קנדה': 'CAD', 'canada': 'CAD',
      'מקסיקו': 'MXN', 'mexico': 'MXN',
      'ברזיל': 'BRL', 'brazil': 'BRL',
      'ארגנטינה': 'ARS', 'argentina': 'ARS',
      'צ\'ילה': 'CLP', 'chile': 'CLP',
      'קולומביה': 'COP', 'colombia': 'COP',
      'פרו': 'PEN', 'peru': 'PEN',
      'אורוגוואי': 'UYU', 'uruguay': 'UYU',
      // Far East
      'יפן': 'JPY', 'japan': 'JPY', 'tokyo': 'JPY',
      'סין': 'CNY', 'china': 'CNY', 'beijing': 'CNY',
      'קוריאה': 'KRW', 'korea': 'KRW', 'seoul': 'KRW',
      'הונג קונג': 'HKD', 'hong kong': 'HKD',
      'סינגפור': 'SGD', 'singapore': 'SGD',
      'תאילנד': 'THB', 'thailand': 'THB', 'bangkok': 'THB',
      'מלזיה': 'MYR', 'malaysia': 'MYR',
      'אינדונזיה': 'IDR', 'indonesia': 'IDR',
      'פיליפינים': 'PHP', 'philippines': 'PHP',
      'וייטנאם': 'VND', 'vietnam': 'VND',
      'טאיוואן': 'TWD', 'taiwan': 'TWD',
      'הודו': 'INR', 'india': 'INR',
      // Africa
      'דרום אפריקה': 'ZAR', 'south africa': 'ZAR',
      'מצרים': 'EGP', 'egypt': 'EGP',
      'מרוקו': 'MAD', 'morocco': 'MAD',
      'תוניסיה': 'TND', 'tunisia': 'TND',
      'קניה': 'KES', 'kenya': 'KES',
      'ניגריה': 'NGN', 'nigeria': 'NGN',
      'גאנה': 'GHS', 'ghana': 'GHS',
      // Australia & Oceania
      'אוסטרליה': 'AUD', 'australia': 'AUD',
      'ניו זילנד': 'NZD', 'new zealand': 'NZD',
      // Middle East
      'ישראל': 'ILS', 'israel': 'ILS',
      'אמירויות': 'AED', 'uae': 'AED', 'dubai': 'AED',
      'סעודיה': 'SAR', 'saudi': 'SAR',
      'קטאר': 'QAR', 'qatar': 'QAR',
      'כווית': 'KWD', 'kuwait': 'KWD',
      'ירדן': 'JOD', 'jordan': 'JOD',
      // US
      'ארצות הברית': 'USD', 'usa': 'USD', 'america': 'USD', 'united states': 'USD',
    };

    // Detect local currency based on trip destination
    let suggestedCurrency = 'EUR'; // Default to EUR
    if (tripDestination) {
      const destination = tripDestination.toLowerCase().trim();
      for (const [country, currency] of Object.entries(countryToCurrency)) {
        if (destination.includes(country.toLowerCase())) {
          suggestedCurrency = currency;
          break;
        }
      }
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `אתה עוזר שמנתח תמונות של קבלות וחשבוניות.
            
            **חשוב מאוד - זיהוי מטבעות:**
            1. חפש סמלי מטבע בקבלה:
               - $ → USD/CAD/AUD/NZD/MXN/ARS/CLP/COP/UYU/HKD/SGD (תלוי במדינה)
               - € → EUR
               - £ → GBP/EGP
               - ₪ → ILS
               - zł → PLN
               - лв → BGN
               - Ft → HUF
               - Kč → CZK
               - lei → RON
               - kr → SEK/NOK/DKK/ISK (תלוי במדינה)
               - CHF → CHF
               - ¥ → JPY/CNY
               - ₩ → KRW
               - ₺ → TRY
               - ₴ → UAH
               - ₹ → INR
               - R$ → BRL
               - S/ → PEN
               - ฿ → THB
               - RM → MYR
               - Rp → IDR
               - ₱ → PHP
               - ₫ → VND
               - NT$ → TWD
               - R → ZAR
               - dh → AED/MAD
               - ر.س → SAR
               - ر.ق → QAR
               - د.ك → KWD
               - د.ا → JOD
               - din → RSD/TND
               - kn → HRK
               - KSh → KES
               - ₦ → NGN
               - ₵ → GHS
            
            2. אם מצאת $ או € → השתמש בזה
            3. אם אין $ או € → השתמש במטבע המקומי של מדינת היעד: ${suggestedCurrency}
            4. אם אין שום סימון מטבע → ברירת מחדל: ${suggestedCurrency}
            
            **מטבעות נתמכים:**
            אירופה: USD, EUR, GBP, CHF, PLN, BGN, CZK, HUF, RON, SEK, NOK, DKK, ISK, HRK, RSD, UAH, TRY
            אמריקה לטינית: CAD, MXN, BRL, ARS, CLP, COP, PEN, UYU
            מזרח רחוק: JPY, CNY, KRW, HKD, SGD, THB, MYR, IDR, PHP, VND, TWD, INR
            אפריקה: ZAR, EGP, MAD, TND, KES, NGN, GHS
            אוסטרליה ואוקיאניה: AUD, NZD
            מזרח תיכון: ILS, AED, SAR, QAR, KWD, JOD
            
            **קטגוריזציה חכמה:**
            - flights: כרטיסי טיסה, כרטיס למטוס, טיסה, flight, airfare, airline
            - accommodation: בית מלון, לינה, מלון, חדר ישיבות, hotel, accommodation, room, conference room
            - food: מסעדה, אוכל, ארוחה, קפה, בית קפה, משקאות, restaurant, food, meal, coffee, drinks, lunch, dinner, breakfast
            - transportation: מונית, אוטובוס, רכבת, אובר, השכרת רכב, דלק, taxi, uber, train, bus, car rental, fuel, gas, parking
            - miscellaneous: כל דבר אחר, קניות, מתנות, שונות, miscellaneous, shopping, gifts
            
            בחר את הקטגוריה המתאימה ביותר בהתבסס על התוכן של הקבלה.
            
            חלץ את הפרטים הבאים מהקבלה:
            - תאריך (בפורמט YYYY-MM-DD)
            - סכום (מספר בלבד, ללא סימני מטבע)
            - מטבע (אחד מהמטבעות הנתמכים למעלה)
            - קטגוריה (flights, accommodation, food, transportation, או miscellaneous)
            - תיאור (תיאור קצר של מה נקנה)
            
            החזר JSON בפורמט הזה:
            {
              "date": "YYYY-MM-DD",
              "amount": number,
              "currency": "USD|EUR|ILS|...",
              "category": "flights|accommodation|food|transportation|miscellaneous",
              "description": "string"
            }
            
            אם לא מצאת ערך מסוים, השתמש בערכים ברירת מחדל סבירים.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'נתח את הקבלה הזו וחלץ את הפרטים'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'חרגת ממגבלת הקריאות, נסה שוב מאוחר יותר' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'יש להוסיף קרדיט למערכת' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log('AI Response:', aiResponse);
    
    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content in AI response');
    }

    // Extract JSON from response (might be wrapped in markdown code blocks)
    let receiptData;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        receiptData = JSON.parse(jsonMatch[0]);
      } else {
        receiptData = JSON.parse(content);
      }
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Failed to parse receipt data from AI response');
    }

    console.log('Extracted receipt data:', receiptData);

    return new Response(
      JSON.stringify({ data: receiptData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error analyzing receipt:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to analyze receipt';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
