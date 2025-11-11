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
      description: `You are a nutrition expert. When given a food description, you MUST:
1. Analyze the foodDescription using your built-in nutrition knowledge
2. Generate complete meal data with dailyTotals and loggedMeals
3. Pass the analyzed data in the analyzedData parameter when calling this tool

CRITICAL: You must analyze the food FIRST, then call this tool with BOTH foodDescription AND analyzedData parameters populated with the complete analyzed meal data.

The analyzedData parameter MUST contain:
- dailyTotals: { calories: number, protein: number, carbs: number, fat: number }
- loggedMeals: array of complete meal objects with ingredients

STEP-BY-STEP PROCESS:
1. Read the foodDescription from the user
2. Use your nutrition knowledge to analyze the food
3. Extract weight/portion information (e.g., "100g", "medium", "large")
4. Calculate accurate nutritional values based on standard serving sizes
5. Group items into meals according to the rules below
6. Generate the complete JSON structure with dailyTotals and loggedMeals
7. Call this tool with foodDescription AND analyzedData parameters both populated

YOU MUST PROVIDE THE COMPLETE ANALYSIS in the analyzedData parameter - do not leave it empty.

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
        analyzedData: z
          .object({
            dailyTotals: z.object({
              calories: z.number(),
              protein: z.number(),
              carbs: z.number(),
              fat: z.number(),
            }),
            loggedMeals: z.array(z.any()),
          })
          .optional()
          .describe(
            "Pre-analyzed meal data. You should analyze the foodDescription using your nutrition knowledge and provide the complete analyzed data here with dailyTotals and loggedMeals arrays."
          ),
      },
      _meta: widgetMeta(macrosWidget),
    },
    async ({ foodDescription, analyzedData }) => {
      try {
        // If ChatGPT provides analyzed data, use it directly
        if (analyzedData?.loggedMeals && analyzedData?.dailyTotals) {
          return {
            content: [
              {
                type: "text",
                text: `Food analyzed: ${foodDescription}`,
              },
            ],
            structuredContent: {
              dailyTotals: analyzedData.dailyTotals,
              loggedMeals: analyzedData.loggedMeals,
            },
            _meta: widgetMeta(macrosWidget),
          };
        }

        // If analyzedData not provided, return placeholder
        // ChatGPT should analyze and call with analyzedData in the first call
        return {
          content: [
            {
              type: "text",
              text: `Please analyze "${foodDescription}" using your nutrition knowledge and call this tool with the analyzedData parameter populated with the complete meal data.`,
            },
          ],
          structuredContent: {
            foodDescription: foodDescription,
            error: "Please call this tool with the analyzedData parameter containing the analyzed meal data.",
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