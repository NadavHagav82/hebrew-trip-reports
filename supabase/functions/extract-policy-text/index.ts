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
    const { imageBase64, fileType } = await req.json();
    
    if (!imageBase64) {
      throw new Error('Missing image data');
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`Processing ${fileType} file for OCR extraction`);

    const systemPrompt = `You are a document parser specialized in extracting travel policy rules from documents.
Extract ALL policy rules you find in the document and return them as a JSON array.

Each rule should have these fields:
- category: One of "flights", "accommodation", "food", "transportation", "miscellaneous" (in English)
- grade: The employee grade/level this applies to (in Hebrew or English, or null if applies to all)
- max_amount: The maximum amount as a number (without currency symbol)
- currency: The currency code (ILS, USD, EUR, etc.)
- destination_type: "domestic", "international", or "all"
- per_type: "per_trip", "per_day", or "per_item"
- notes: Any additional notes or conditions

Look for:
- Tables with expense limits
- Lists of allowances
- Budget caps per category
- Per diem amounts
- Travel policy sections

Return ONLY a valid JSON array. If no rules found, return an empty array [].
Example output:
[
  {"category": "flights", "grade": "מנהל", "max_amount": 5000, "currency": "ILS", "destination_type": "international", "per_type": "per_trip", "notes": ""},
  {"category": "accommodation", "grade": null, "max_amount": 800, "currency": "USD", "destination_type": "international", "per_type": "per_day", "notes": "מלון עד 4 כוכבים"}
]`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              },
              {
                type: "text",
                text: "Extract all travel policy rules from this document image and return them as a JSON array."
              }
            ]
          }
        ],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    
    console.log("Raw AI response:", content);

    // Extract JSON from the response
    let rules = [];
    try {
      // Try to find JSON array in the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        rules = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      rules = [];
    }

    console.log(`Extracted ${rules.length} rules`);

    return new Response(JSON.stringify({ rules }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in extract-policy-text:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
