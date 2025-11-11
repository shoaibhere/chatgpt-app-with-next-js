"use client";

import { useState } from "react";
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
  const toolOutput = useWidgetProps<{
    result?: {
      structuredContent?: MealData;
    };
    structuredContent?: MealData;
    error?: string;
  }>();

  // Extract meal data from tool output
  const mealData: MealData | null =
    toolOutput?.result?.structuredContent ||
    toolOutput?.structuredContent ||
    null;

  // Check for errors
  const error = mealData?.error || toolOutput?.error;
  const meals = mealData?.loggedMeals || [];

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
        {/* Daily Totals - Optional */}
        {mealData?.dailyTotals && (
          <div className="bg-gray-100 border border-gray-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
              Daily Totals
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold text-black">
                  {Math.round(mealData.dailyTotals.calories)}
                </div>
                <div className="text-xs sm:text-sm text-gray-700">Calories</div>
              </div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold text-black">
                  {Math.round(mealData.dailyTotals.protein)}g
                </div>
                <div className="text-xs sm:text-sm text-gray-700">Protein</div>
              </div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold text-black">
                  {Math.round(mealData.dailyTotals.carbs)}g
                </div>
                <div className="text-xs sm:text-sm text-gray-700">Carbs</div>
              </div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold text-black">
                  {Math.round(mealData.dailyTotals.fat)}g
                </div>
                <div className="text-xs sm:text-sm text-gray-700">Fat</div>
              </div>
            </div>
          </div>
        )}

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
    <div className="mb-6">
      {/* Main Card */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Header Section */}
        <div className="bg-white p-4 sm:p-6">
          <div className="flex items-start gap-3">
            {/* Logo/Icon */}
            <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
              <Image
                src="/icon.jpeg"
                alt="Meal icon"
                width={56}
                height={56}
                className="w-full h-full object-cover"
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
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 mb-3"></div>

        {/* Nutrition Grid */}
        <div className="bg-white px-4 sm:px-6 pb-4 sm:pb-6">
          <div className="grid grid-cols-4 gap-3 sm:gap-6">
            <div className="text-center">
              <div className="text-gray-500 text-xs sm:text-sm mb-2">
                Calories
              </div>
              <div className="text-sm lg:text-2xl font-bold text-gray-900">
                {Math.round(meal.total_nutrients.calories)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 text-xs sm:text-sm mb-2">
                Protein (g)
              </div>
              <div className="text-sm lg:text-2xl font-bold text-gray-900">
                {Math.round(meal.total_nutrients.protein)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 text-xs sm:text-sm mb-2">
                Carbs (g)
              </div>
              <div className="text-sm lg:text-2xl font-bold text-gray-900">
                {Math.round(meal.total_nutrients.carbs)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 text-xs sm:text-sm mb-2">
                Fat (g)
              </div>
              <div className="text-sm lg:text-2xl font-bold text-gray-900">
                {Math.round(meal.total_nutrients.fat)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ingredients Breakdown - Collapsible (Fixed styling to match project-me-main) */}
      {hasMultipleIngredients && (
        <>
          {showBreakdown && (
            <div className="bg-gray-50 px-6 sm:px-8 py-4 sm:py-6 rounded-b-2xl">
              <div className="space-y-6">
                {meal.ingredients.map((ingredient, ingredientIndex) => (
                  <div key={ingredientIndex}>
                    {/* Ingredient Header */}
                    <h5 className="text-sm sm:text-base text-gray-500 mb-2">
                      {ingredient.name} ({ingredient.serving_info})
                    </h5>

                    {/* Ingredient Nutrition Grid - Same style as project-me-main (no labels, just values) */}
                    <div className="grid grid-cols-4 gap-3 sm:gap-6">
                      <div className="text-center">
                        <div className="text-sm lg:text-2xl font-bold text-gray-900">
                          {Math.round(ingredient.nutrients.calories)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm lg:text-2xl font-bold text-gray-900">
                          {Math.round(ingredient.nutrients.protein)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm lg:text-2xl font-bold text-gray-900">
                          {Math.round(ingredient.nutrients.carbs)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm lg:text-2xl font-bold text-gray-900">
                          {Math.round(ingredient.nutrients.fat)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Breakdown Toggle Button - Always at the End, Outside Card */}
          <div className="mt-4 text-center">
            <button
              onClick={() => setShowBreakdown(!showBreakdown)}
              className="text-sm sm:text-base text-gray-600 hover:text-gray-900 transition-colors font-medium"
            >
              {showBreakdown ? "- Hide Breakdown" : "+ Show Breakdown"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}