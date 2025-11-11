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
      description: `You are a nutrition expert. When given a food description, analyze it using your knowledge and return a JSON object with nutritional information.

CRITICAL INSTRUCTIONS:
1. Use your built-in nutrition knowledge to analyze the food
2. Extract weight/portion information from the description (e.g., "100g", "medium", "large")
3. Calculate accurate nutritional values based on standard serving sizes
4. Return ONLY valid JSON in the exact structure specified below

RULES FOR MEAL GROUPING:
- If items are part of a COMBO/MEAL/DEAL or mentioned WITH each other: Create ONE meal with items as ingredients
- If items are separate (mentioned with "and" but not a combo): Create separate meals
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
- "pizza and burger" → 2 separate meals`,
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
        // Return a structure that guides ChatGPT to analyze and populate the data
        // ChatGPT will use its native model to analyze the foodDescription
        // based on the detailed tool description above
        // ChatGPT will then populate structuredContent with the analyzed meal data
        
        return {
          content: [
            {
              type: "text",
              text: `Food to analyze: ${foodDescription}\n\nPlease analyze this food using your nutrition knowledge and return the nutritional data in the JSON structure specified in the tool description.`,
            },
          ],
          structuredContent: {
            // ChatGPT will populate this entire object based on its analysis
            // The tool description above provides detailed instructions
            // ChatGPT uses its built-in model to:
            // 1. Parse the food description
            // 2. Extract portion/weight information
            // 3. Calculate nutritional values
            // 4. Group items into meals correctly
            // 5. Return dailyTotals and loggedMeals arrays
            foodDescription: foodDescription,
            // ChatGPT will add dailyTotals and loggedMeals here
            // following the exact structure specified in the tool description
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