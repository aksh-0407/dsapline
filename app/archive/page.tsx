import { auth } from "@clerk/nextjs/server";
import { getGlobalArchive } from "@/lib/archive";
import Archive from "@/components/Archive";

// Force dynamic so we always see new submissions immediately
export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const { userId } = await auth();
  const data = await getGlobalArchive();

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
               Archive
            </h1>
            <p className="text-gray-400 mt-2">
              The complete library of every problem solved by the community.
            </p>
          </div>
          
          <div className="text-right hidden md:block">
            <div className="text-3xl font-mono font-bold text-white">
              {data.length}
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-widest">
              Total Problems
            </div>
          </div>
        </div>

        {/* The Archive Interface (Search, Filter, Table) */}
        <Archive data={data} currentUserId={userId} />
        
      </div>
    </main>
  );
}