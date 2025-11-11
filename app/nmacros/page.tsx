"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useWidgetProps } from "../hooks";

// Type definitions
interface Nutrients {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface Ingredient {
  name: string;
  brand?: string;
  serving_info: string;
  nutrients: Nutrients;
}

interface Meal {
  meal_name: string;
  meal_size?: string;
  ingredients: Ingredient[];
  total_nutrients: Nutrients;
}

interface MealData {
  dailyTotals?: Nutrients;
  loggedMeals?: Meal[];
  error?: string;
}

export default function Macros() {
  const [isLoading, setIsLoading] = useState(true);
  const toolOutput = useWidgetProps<{
    result?: {
      structuredContent?: MealData;
    };
    structuredContent?: MealData;
    error?: string;
  }>();

  // Extract meal data from tool output
  let mealData: MealData | null = null;
  
  // Try different data paths
  if (toolOutput?.result?.structuredContent) {
    mealData = toolOutput.result.structuredContent as MealData;
  } else if (toolOutput?.structuredContent) {
    mealData = toolOutput.structuredContent as MealData;
  } else if (toolOutput?.result) {
    mealData = toolOutput.result as MealData;
  } else if (toolOutput && typeof toolOutput === 'object') {
    if ('loggedMeals' in toolOutput || 'dailyTotals' in toolOutput) {
      mealData = toolOutput as MealData;
    }
  }

  // Check for errors
  const error = mealData?.error || toolOutput?.error;
  const meals = mealData?.loggedMeals || [];

  // Handle loading state - show loading when no data yet
  useEffect(() => {
    // If we have meals, stop loading
    if (meals.length > 0) {
      setIsLoading(false);
      return;
    }
    
    // If toolOutput is null, we're still waiting
    if (toolOutput === null) {
      setIsLoading(true);
      return;
    }
    
    // If we have toolOutput but no meals, check if it's still processing
    // (e.g., has foodDescription but no loggedMeals yet means API is processing)
    if (toolOutput && typeof toolOutput === 'object') {
      const hasFoodDescription = 'foodDescription' in toolOutput;
      const hasMeals = 'loggedMeals' in toolOutput && Array.isArray(toolOutput.loggedMeals) && toolOutput.loggedMeals.length > 0;
      
      if (hasFoodDescription && !hasMeals) {
        // API is processing - show loading
        setIsLoading(true);
        return;
      }
    }
    
    // Otherwise, stop loading
    setIsLoading(false);
  }, [meals.length, toolOutput]);

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-white text-black font-sans">
        <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
            <p className="text-sm sm:text-base text-red-800">{error}</p>
          </div>
        </main>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white text-black font-sans">
        <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-black mb-4"></div>
            <p className="text-gray-600 text-base font-medium">Analyzing food nutrition...</p>
            <p className="text-gray-500 text-sm mt-2">Please wait</p>
          </div>
        </main>
      </div>
    );
  }

  // Show empty state
  if (meals.length === 0) {
    return (
      <div className="min-h-screen bg-white text-black font-sans p-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-gray-500 text-center">No meal data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Meal Cards */}
        <div className="space-y-4">
          {meals.map((meal, mealIndex) => (
            <MealCard key={mealIndex} meal={meal} />
          ))}
        </div>
      </main>
    </div>
  );
}

// Meal Card Component
interface MealCardProps {
  meal: Meal;
}

function MealCard({ meal }: MealCardProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const hasMultipleIngredients = meal.ingredients.length > 1;

  return (
    <div className="mb-4">
      {/* Main Card - Exact design from images */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
        {/* Header Section - Icon, Name, Size */}
        <div className="p-4 sm:p-6">
          <div className="flex items-start gap-3 mb-4">
            {/* Icon - Light grey square with rounded corners */}
            <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-gray-100 rounded-lg flex items-center justify-center">
              <Image
                src="/icon.jpeg"
                alt="Meal icon"
                width={56}
                height={56}
                className="w-full h-full object-cover rounded-lg"
              />
            </div>

            {/* Title and Size/Weight */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-0.5">
                {meal.meal_name}
              </h3>
              {meal.meal_size && (
                <p className="text-sm sm:text-base text-gray-500">
                  {meal.meal_size}
                </p>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 mb-4"></div>

          {/* Nutrition Grid - Labels on top, values below */}
          <div className="grid grid-cols-4 gap-3 sm:gap-4">
            <div className="text-center">
              <div className="text-gray-500 text-xs sm:text-sm mb-1">
                Calories
              </div>
              <div className="text-lg sm:text-xl font-bold text-gray-900">
                {Math.round(meal.total_nutrients.calories)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 text-xs sm:text-sm mb-1">
                Protein (g)
              </div>
              <div className="text-lg sm:text-xl font-bold text-gray-900">
                {Math.round(meal.total_nutrients.protein)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 text-xs sm:text-sm mb-1">
                Carbs (g)
              </div>
              <div className="text-lg sm:text-xl font-bold text-gray-900">
                {Math.round(meal.total_nutrients.carbs)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 text-xs sm:text-sm mb-1">
                Fat (g)
              </div>
              <div className="text-lg sm:text-xl font-bold text-gray-900">
                {Math.round(meal.total_nutrients.fat)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Show Breakdown Button - Only for meals with multiple ingredients */}
      {hasMultipleIngredients && (
        <div className="mt-3 text-center">
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="text-sm sm:text-base text-gray-600 hover:text-gray-900 transition-colors font-medium"
          >
            {showBreakdown ? "- Hide Breakdown" : "+ Show Breakdown"}
          </button>
        </div>
      )}

      {/* Ingredients Breakdown - Show as cards matching main card design */}
      {showBreakdown && hasMultipleIngredients && (
        <div className="mt-4 space-y-4">
          {meal.ingredients.map((ingredient, ingredientIndex) => (
            <div key={ingredientIndex} className="bg-white border border-gray-200 rounded-2xl shadow-sm">
              <div className="p-4 sm:p-6">
                <div className="flex items-start gap-3 mb-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Image
                      src="/icon.jpeg"
                      alt="Ingredient icon"
                      width={56}
                      height={56}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>

                  {/* Ingredient Name and Serving Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-0.5">
                      {ingredient.name}
                    </h3>
                    <p className="text-sm sm:text-base text-gray-500">
                      {ingredient.serving_info}
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 mb-4"></div>

                {/* Ingredient Nutrition Grid - Same style as main card */}
                <div className="grid grid-cols-4 gap-3 sm:gap-4">
                  <div className="text-center">
                    <div className="text-gray-500 text-xs sm:text-sm mb-1">
                      Calories
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-gray-900">
                      {Math.round(ingredient.nutrients.calories)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-500 text-xs sm:text-sm mb-1">
                      Protein (g)
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-gray-900">
                      {Math.round(ingredient.nutrients.protein)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-500 text-xs sm:text-sm mb-1">
                      Carbs (g)
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-gray-900">
                      {Math.round(ingredient.nutrients.carbs)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-500 text-xs sm:text-sm mb-1">
                      Fat (g)
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-gray-900">
                      {Math.round(ingredient.nutrients.fat)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}