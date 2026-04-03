"use client";

import { useMemo } from "react";
import { toISTDateString } from "@/lib/date";

interface Props {
  activityMap: Record<string, number>;
}

export function ActivityHeatmap({ activityMap }: Props) {
  // Generate the last 365 days
  const dates = useMemo(() => {
    const days = [];
    const today = new Date();
    // We want roughly 52 weeks back
    for (let i = 364; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      days.push(toISTDateString(d));
    }
    return days;
  }, []);

  // Helper to determine color
  const getColor = (count: number) => {
    if (count === 0) return "bg-gray-800"; // Empty
    if (count === 1) return "bg-green-900"; // Light
    if (count <= 3) return "bg-green-700"; // Medium
    return "bg-green-500"; // High
  };

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="min-w-[700px]"> {/* Ensures it doesn't squish on mobile */}
        
        {/* The Grid: 7 Rows (Days), Auto Cols */}
        <div className="grid grid-rows-7 grid-flow-col gap-1">
          {dates.map((date) => {
            const count = activityMap[date] || 0;
            return (
              <div
                key={date}
                className={`w-3 h-3 rounded-sm ${getColor(count)} transition-all hover:ring-1 hover:ring-white`}
                title={`${date}: ${count} problems`}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-4 text-xs text-gray-500 justify-end">
          <span>Less</span>
          <div className="w-3 h-3 bg-gray-800 rounded-sm" />
          <div className="w-3 h-3 bg-green-900 rounded-sm" />
          <div className="w-3 h-3 bg-green-700 rounded-sm" />
          <div className="w-3 h-3 bg-green-500 rounded-sm" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}