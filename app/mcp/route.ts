import { baseURL } from "@/baseUrl";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

const getAppsSdkCompatibleHtml = async (baseUrl: string, path: string) => {
  const result = await fetch(`${baseUrl}${path}`);
  return await result.text();
};

type ContentWidget = {
  id: string;
  title: string;
  templateUri: string;
  invoking: string;
  invoked: string;
  html: string;
  description: string;
  widgetDomain: string;
};

function widgetMeta(widget: ContentWidget) {
  return {
    "openai/outputTemplate": widget.templateUri,
    "openai/toolInvocation/invoking": widget.invoking,
    "openai/toolInvocation/invoked": widget.invoked,
    "openai/widgetAccessible": false,
    "openai/resultCanProduceWidget": true,
  } as const;
}

const handler = createMcpHandler(async (server) => {
  // Get HTML for the macros widget page
  const macrosHtml = await getAppsSdkCompatibleHtml(baseURL, "/nmacros");

  // Define the macros widget
  const macrosWidget: ContentWidget = {
    id: "analyze_food",
    title: "Analyze Food Macros",
    templateUri: "ui://widget/macros-template.html",
    invoking: "Analyzing food nutrition...",
    invoked: "Food analysis complete",
    html: macrosHtml,
    description: "Analyzes food descriptions and displays nutritional information in meal cards",
    widgetDomain: baseURL,
  };

  // Register the resource (widget HTML)
  server.registerResource(
    "macros-widget",
    macrosWidget.templateUri,
    {
      title: macrosWidget.title,
      description: macrosWidget.description,
      mimeType: "text/html+skybridge",
      _meta: {
        "openai/widgetDescription": macrosWidget.description,
        "openai/widgetPrefersBorder": true,
      },
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/html+skybridge",
          text: `<html>${macrosWidget.html}</html>`,
          _meta: {
            "openai/widgetDescription": macrosWidget.description,
            "openai/widgetPrefersBorder": true,
            "openai/widgetDomain": macrosWidget.widgetDomain,
          },
        },
      ],
    })
  );

  // Register the tool
  server.registerTool(
    macrosWidget.id,
    {
      title: macrosWidget.title,
      description: `Analyze food descriptions and return nutritional information. The tool uses ChatGPT's model via API to analyze the food and return meal data with nutritional information.

RULES FOR MEAL GROUPING:
- If items are part of a COMBO/MEAL/DEAL or mentioned WITH each other: Create ONE meal with items as ingredients
- If items are separate (mentioned with "and", "vs", "versus", or comparison words): Create SEPARATE meals for comparison
- Always provide realistic nutritional values - never use zeros
- Calculate dailyTotals as the sum of all meals' nutrients

REQUIRED JSON STRUCTURE (return this exact format):
{
  "dailyTotals": {
    "calories": <number - sum of all meals>,
    "protein": <number in grams - sum of all meals>,
    "carbs": <number in grams - sum of all meals>,
    "fat": <number in grams - sum of all meals>
  },
  "loggedMeals": [
    {
      "meal_name": "<meal name>",
      "meal_size": "<size or weight from description, e.g., '100g', 'Medium', '6 pieces'>",
      "total_nutrients": {
        "calories": <number>,
        "protein": <number in grams>,
        "carbs": <number in grams>,
        "fat": <number in grams>
      },
      "ingredients": [
        {
          "name": "<ingredient name>",
          "brand": "<brand name or 'Generic'>",
          "serving_info": "<serving description, e.g., '1 serving (100g)'>",
          "nutrients": {
            "calories": <number>,
            "protein": <number in grams>,
            "carbs": <number in grams>,
            "fat": <number in grams>
          }
        }
      ]
    }
  ]
}

EXAMPLES:
- "100g blueberries" → 1 meal with 57 calories, 1g protein, 14g carbs, 0g fat
- "Big Mac meal" → 1 meal with ingredients: Big Mac, fries, drink
- "pizza and burger" → 2 separate meals (shows 2 cards for comparison)
- "pizza vs burger" → 2 separate meals (shows 2 cards for comparison)`,
      inputSchema: {
        foodDescription: z
          .string()
          .describe(
            "The food description from the user (e.g., 'I had 100g of blueberries', 'Big Mac meal', 'pizza and burger')"
          ),
      },
      _meta: widgetMeta(macrosWidget),
    },
    async ({ foodDescription }) => {
      try {
        // Use OpenAI API to analyze the food
        // This uses ChatGPT's model via API to generate meal data
        const apiKey = process.env.OPENAI_API_KEY;
        
        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text: `Error: OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.`,
              },
            ],
            structuredContent: {
              error: "OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.",
            },
            _meta: widgetMeta(macrosWidget),
          };
        }

        const prompt = `You are a nutrition expert. Analyze the following food description and return ONLY a valid JSON object (no markdown, no code blocks, no extra text) with this exact structure:

IMPORTANT RULES:
1. MEAL vs INGREDIENTS logic:
   - If items are part of a COMBO/DEAL/MEAL (like "Big Mac Meal", "Combo", "Deal", or items mentioned WITH each other using "with"): Create ONE meal with ALL items as ingredients
   - If items are SEPARATE/INDEPENDENT foods mentioned with "and", "vs", "versus", or comparison words: Create SEPARATE meals for each (for comparison)
   
2. Examples of ONE MEAL (items as ingredients):
   - "Big Mac deal" → 1 meal named "Big Mac Meal" with ingredients: Big Mac burger, fries, drink
   - "burger with fries and coke" → 1 meal with 3 ingredients
   - "chicken combo" → 1 meal with all combo items as ingredients
   - "pizza with wings" → 1 meal with 2 ingredients

3. Examples of SEPARATE MEALS (for comparison):
   - "pizza and burger" → 2 separate meals (Pizza card, Burger card)
   - "pizza vs burger" → 2 separate meals (Pizza card, Burger card)
   - "pizza versus burger" → 2 separate meals (Pizza card, Burger card)
   - "I had chicken then later ate ice cream" → 2 separate meals
   - "breakfast was eggs, lunch was sandwich" → 2 separate meals

4. Calculate dailyTotals as the sum of all meals' nutrients.
5. YOU MUST PROVIDE REALISTIC NUTRITIONAL VALUES - DO NOT USE ZEROS! Use standard serving sizes and accurate calorie/macro estimates.

{
  "dailyTotals": {
    "calories": <sum of all meals>,
    "protein": <sum of all meals in grams>,
    "carbs": <sum of all meals in grams>,
    "fat": <sum of all meals in grams>
  },
  "loggedMeals": [
    {
      "meal_name": "Meal Name",
      "meal_size": "Small/Medium/Large or specific size like '100g' or '6 pieces'",
      "total_nutrients": {
        "calories": <actual number>,
        "protein": <actual number in grams>,
        "carbs": <actual number in grams>,
        "fat": <actual number in grams>
      },
      "ingredients": [
        {
          "name": "Ingredient Name",
          "brand": "Brand Name or Generic",
          "serving_info": "1 serving (Xg) or specific portion",
          "nutrients": {
            "calories": <actual number>,
            "protein": <actual number in grams>,
            "carbs": <actual number in grams>,
            "fat": <actual number in grams>
          }
        }
      ]
    }
  ]
}

For a pizza slice: ~285 calories, 12g protein, 36g carbs, 10g fat
For a burger: ~540 calories, 25g protein, 40g carbs, 25g fat
For fries (medium): ~365 calories, 4g protein, 48g carbs, 17g fat
For a coke (medium): ~210 calories, 0g protein, 58g carbs, 0g fat

Food description: "${foodDescription}"

Return ONLY the JSON object with REAL nutritional values, nothing else.`;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are a nutrition expert that returns ONLY valid JSON responses with no additional text or formatting."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "Failed to process food data");
        }

        const responseData = await response.json();
        const content = responseData.choices[0].message.content;
        
        // Parse and validate the JSON response
        const data = JSON.parse(content);

        if (!data.dailyTotals || !data.loggedMeals) {
          throw new Error("Invalid response format from AI. Please try again.");
        }

        // Return the analyzed data
        return {
          content: [
            {
              type: "text",
              text: `Food analyzed: ${foodDescription}`,
            },
          ],
          structuredContent: {
            dailyTotals: data.dailyTotals,
            loggedMeals: data.loggedMeals,
          },
          _meta: widgetMeta(macrosWidget),
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error processing food analysis request: ${foodDescription}`,
            },
          ],
          structuredContent: {
            error: error instanceof Error ? error.message : "Failed to analyze food. Please try again.",
          },
          _meta: widgetMeta(macrosWidget),
        };
      }
    }
  );
});

export const GET = handler;
export const POST = handler;