export function ArchiveSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Filter Bar Placeholder */}
      <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex flex-wrap gap-4 items-center">
        <div className="h-10 bg-gray-800 rounded flex-grow min-w-[200px]"></div>
        <div className="h-10 w-32 bg-gray-800 rounded"></div>
        <div className="h-10 w-32 bg-gray-800 rounded"></div>
        <div className="h-10 w-32 bg-gray-800 rounded"></div>
      </div>

      {/* Table Placeholder */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-950 text-gray-400 uppercase text-xs font-bold border-b border-gray-800">
              <tr>
                <th className="px-6 py-4 w-[15%]">
                  <div className="h-3 bg-gray-800 rounded w-16"></div>
                </th>
                <th className="px-6 py-4 w-[30%]">
                  <div className="h-3 bg-gray-800 rounded w-20"></div>
                </th>
                <th className="px-6 py-4 w-[15%]">
                  <div className="h-3 bg-gray-800 rounded w-16"></div>
                </th>
                <th className="px-6 py-4 w-[10%]">
                  <div className="h-3 bg-gray-800 rounded w-16"></div>
                </th>
                <th className="px-6 py-4 w-[15%]">
                  <div className="h-3 bg-gray-800 rounded w-16"></div>
                </th>
                <th className="px-6 py-4 w-[10%]">
                  <div className="h-3 bg-gray-800 rounded w-16"></div>
                </th>
                <th className="px-6 py-4 w-[5%] text-right">
                  <div className="h-3 bg-gray-800 rounded w-10 ml-auto"></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {[...Array(10)].map((_, i) => (
                <tr key={i} className="hover:bg-gray-800/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gray-800"></div>
                      <div className="h-4 bg-gray-700 rounded w-24"></div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 bg-gray-700 rounded w-48 mb-2"></div>
                    <div className="flex gap-1">
                      <div className="h-3 bg-gray-800 rounded w-12"></div>
                      <div className="h-3 bg-gray-800 rounded w-16"></div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-6 w-20 bg-gray-800 rounded"></div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 w-8 bg-gray-700 rounded mb-1"></div>
                    <div className="h-2 w-12 bg-gray-800 rounded"></div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm bg-gray-800"></div>
                      <div className="h-3 bg-gray-800 rounded w-20"></div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-3 bg-gray-800 rounded w-16"></div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="h-8 w-8 rounded-full bg-gray-800 ml-auto"></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
