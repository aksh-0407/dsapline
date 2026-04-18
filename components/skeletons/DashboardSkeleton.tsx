export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      
      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 p-6 rounded-xl flex items-center gap-4">
            <div className="p-3 bg-gray-800 rounded-lg w-12 h-12"></div>
            <div>
              <div className="h-3 bg-gray-800 rounded w-20 mb-2"></div>
              <div className="h-8 bg-gray-800 rounded w-12"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Heatmap Placeholder */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-gray-800" />
          <div className="h-5 bg-gray-800 rounded w-32"></div>
        </div>
        <div className="h-32 bg-gray-800 rounded-lg w-full"></div>
      </div>

      {/* Recent Activity List Skeleton */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 bg-gray-800 rounded" />
          <div className="h-6 bg-gray-800 rounded w-40"></div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 p-4 rounded-lg flex items-center justify-between">
              
              {/* LEFT: Info & Badges */}
              <div className="flex items-center gap-4">
                <div className="w-10 h-6 bg-gray-800 rounded"></div>
                <div>
                  <div className="h-5 bg-gray-800 rounded w-48 mb-2"></div>
                  <div className="flex gap-2">
                    <div className="h-3 bg-gray-800 rounded w-16"></div>
                    <div className="h-3 bg-gray-800 rounded w-2"></div>
                    <div className="h-3 bg-gray-800 rounded w-16"></div>
                  </div>
                </div>
              </div>

              {/* RIGHT: Tags & Action Button */}
              <div className="flex items-center gap-4">
                <div className="hidden md:flex gap-1">
                   <div className="w-12 h-5 bg-gray-800 rounded"></div>
                   <div className="w-12 h-5 bg-gray-800 rounded"></div>
                </div>
                <div className="w-9 h-9 bg-gray-800 rounded-full"></div>
              </div>

            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
