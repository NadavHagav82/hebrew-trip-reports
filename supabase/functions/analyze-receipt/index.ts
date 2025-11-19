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
    const { imageBase64 } = await req.json();
    
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Missing image data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Analyzing receipt with Lovable AI...');
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
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
            חלץ את הפרטים הבאים מהקבלה:
            - תאריך (בפורמט YYYY-MM-DD)
            - סכום (מספר בלבד)
            - מטבע (USD, EUR, ILS, PLN, או GBP)
            - קטגוריה (flights, accommodation, food, transportation, או miscellaneous)
            - תיאור (תיאור קצר של מה נקנה)
            
            החזר JSON בפורמט הזה:
            {
              "date": "YYYY-MM-DD",
              "amount": number,
              "currency": "USD|EUR|ILS|PLN|GBP",
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
