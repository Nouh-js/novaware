import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";

const EXTRACTION_PROMPT = `You are an invoice data extraction assistant. Extract ALL information visible in this invoice image and return ONLY a valid JSON object with this exact structure:
{
  "supplier_name": "string or null",
  "supplier_tax_id": "string or null",
  "invoice_number": "string or null",
  "invoice_date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD or null",
  "currency": "MAD|EUR|USD|...",
  "lines": [
    {
      "reference": "string",
      "description": "string",
      "qty": number,
      "unit": "string",
      "unit_cost": number,
      "tax_rate": number,
      "discount": number,
      "line_total": number
    }
  ],
  "total_ht": number,
  "total_tva": number,
  "total_ttc": number,
  "notes": "string or null"
}
Return ONLY the JSON. No markdown, no explanation, no code fences.`;

type RequestBody = {
  type: "image" | "text";
  data: string;
  mimeType?: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return respond({ error: "Corps de requête JSON invalide" }, 200);
    }

    const { type, data, mimeType } = body;

    if (!type || !data) {
      return respond(
        { error: "Paramètres manquants : 'type' et 'data' sont requis" },
        200,
      );
    }

    if (type !== "image" && type !== "text") {
      return respond(
        { error: `Type non supporté : '${type}'. Valeurs acceptées : 'image', 'text'` },
        200,
      );
    }

    if (!GEMINI_API_KEY) {
      return respond(
        { error: "Clé API Gemini non configurée. Ajoutez la variable d'environnement GEMINI_API_KEY dans Supabase." },
        200,
      );
    }

    // Build Gemini request payload
    let geminiPayload: unknown;

    if (type === "image") {
      const imgMime = mimeType || "image/jpeg";
      geminiPayload = {
        contents: [
          {
            role: "user",
            parts: [
              { text: EXTRACTION_PROMPT },
              {
                inlineData: {
                  mimeType: imgMime,
                  data: data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 2048,
        },
      };
    } else {
      if (data.trim().length < 20) {
        return respond(
          {
            error:
              "Le texte extrait est trop court. La facture est peut-être une image scannée. Veuillez téléverser une image (PNG, JPG) plutôt qu'un PDF scanné.",
          },
          200,
        );
      }
      geminiPayload = {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${EXTRACTION_PROMPT}\n\nInvoice text content:\n${data.slice(0, 6000)}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 2048,
        },
      };
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload),
      },
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      let errMsg = `Erreur API Gemini (${geminiRes.status})`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson?.error?.message || errMsg;
        if (geminiRes.status === 400) errMsg = "Requête invalide vers Gemini.";
        if (geminiRes.status === 401 || geminiRes.status === 403) errMsg = "Clé API Gemini invalide ou expirée.";
        if (geminiRes.status === 429) errMsg = "Quota Gemini dépassé. Réessayez plus tard.";
      } catch { /* ignore */ }
      return respond({ error: errMsg, debug: errText.slice(0, 1000) }, 200);
    }

    const geminiData = await geminiRes.json();
    const candidate = geminiData.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text;

    if (!content) {
      return respond({ error: "L'IA n'a retourné aucune réponse.", raw: geminiData }, 200);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try to extract JSON from markdown code block
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[1].trim());
        } catch {
          return respond(
            {
              error: "L'IA n'a pas pu structurer les données. La facture est peut-être illisible ou dans un format non standard.",
              raw: content.slice(0, 500),
            },
            200,
          );
        }
      } else {
        return respond(
          {
            error: "L'IA n'a pas pu structurer les données. La facture est peut-être illisible ou dans un format non standard.",
            raw: content.slice(0, 500),
          },
          200,
        );
      }
    }

    // Basic validation
    const result = parsed as Record<string, unknown>;
    if (!result.supplier_name && !result.invoice_number && !result.lines) {
      return respond(
        {
          error: "Aucune donnée de facture détectée. Vérifiez que le fichier est bien une facture lisible.",
        },
        200,
      );
    }

    return respond(result);
  } catch (err) {
    return respond(
      { error: `Erreur interne : ${String(err)}` },
      200,
    );
  }
});
