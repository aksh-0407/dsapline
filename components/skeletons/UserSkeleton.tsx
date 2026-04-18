export function UserSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-pulse">
      
      {/* PROFILE HEADER SKELETON */}
      <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 md:p-12 text-center md:text-left shadow-2xl">
        <div className="flex flex-col md:flex-row items-center gap-8">
          
          {/* Avatar Skeleton */}
          <div className="w-24 h-24 bg-gray-800 rounded-full border-4 border-gray-700 shadow-xl shrink-0"></div>

          {/* User Identity Skeleton */}
          <div className="space-y-3 flex-1 w-full md:w-auto flex flex-col items-center md:items-start">
            <div className="h-10 bg-gray-800 rounded w-48"></div>
            <div className="h-4 bg-gray-800 rounded w-64"></div>
          </div>

          {/* STATS GRID SKELETON */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center border-t md:border-t-0 border-gray-800 pt-6 md:pt-0 w-full md:w-auto">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="h-8 bg-gray-800 rounded w-12 mb-2"></div>
                <div className="h-3 bg-gray-700 rounded w-20"></div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Problem History Skeleton (reusing archive skeleton look) */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
          <div className="w-6 h-6 rounded bg-gray-800"></div>
          <div className="h-8 bg-gray-800 rounded w-48"></div>
        </div>
        
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
               <div key={i} className="h-12 bg-gray-800 rounded-lg w-full"></div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
