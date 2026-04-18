export function LeaderboardSkeleton() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl animate-pulse">
      
      {/* TABS HEADER SKELETON */}
      <div className="flex border-b border-gray-800">
        <div className="flex-1 py-4 flex items-center justify-center gap-2">
          <div className="w-4 h-4 bg-gray-800 rounded-full"></div>
          <div className="w-24 h-4 bg-gray-800 rounded"></div>
        </div>
        <div className="w-[1px] bg-gray-800"></div>
        <div className="flex-1 py-4 flex items-center justify-center gap-2">
          <div className="w-4 h-4 bg-gray-800 rounded-full"></div>
          <div className="w-24 h-4 bg-gray-800 rounded"></div>
        </div>
      </div>

      {/* LIST SKELETON */}
      <div className="divide-y divide-gray-800">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="p-6 flex items-center gap-4 md:gap-6">
            
            {/* Rank Skeleton */}
            <div className="flex-shrink-0 w-8 md:w-12 flex justify-center">
              {i < 3 ? (
                <div className="w-6 h-6 rounded-full bg-gray-800"></div>
              ) : (
                <div className="w-4 h-4 rounded bg-gray-800"></div>
              )}
            </div>

            {/* User Info Skeleton */}
            <div className="flex-1 min-w-0">
              <div className="h-5 bg-gray-800 rounded w-48 mb-2"></div>
              <div className="h-3 bg-gray-800 rounded w-32"></div>
            </div>

            {/* Metrics Skeleton */}
            <div className="flex gap-6 text-right">
              {/* Solved Count Skeleton */}
              <div>
                <div className="h-6 w-8 bg-gray-800 rounded mb-1 ml-auto"></div>
                <div className="h-2 w-10 bg-gray-800 rounded ml-auto"></div>
              </div>

              {/* Streak Count Skeleton */}
              <div>
                <div className="h-6 w-8 bg-gray-800 rounded mb-1 ml-auto"></div>
                <div className="h-2 w-10 bg-gray-800 rounded ml-auto"></div>
              </div>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}
