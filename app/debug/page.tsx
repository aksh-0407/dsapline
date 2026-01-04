import { getFile } from "@/lib/github";
import { getDashboardData } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export default async function DebugPage() {
  // 1. Try to fetch the Index File directly
  const rawFile = await getFile("data/index.json");
  
  // 2. Try to run the Analytics Engine
  const analytics = await getDashboardData();

  return (
    <div className="p-10 bg-black text-green-400 font-mono text-sm whitespace-pre-wrap">
      <h1 className="text-xl text-white font-bold mb-4">🛑 Debug Console</h1>

      <div className="border border-green-800 p-4 rounded mb-8">
        <h2 className="text-white font-bold">1. Raw GitHub Response (data/index.json)</h2>
        <p>Exists: {rawFile.exists ? "YES" : "NO"}</p>
        <p>Content Type: {typeof rawFile.content}</p>
        <p>Raw Content Preview:</p>
        <div className="bg-gray-900 p-2 mt-2 border border-gray-700">
          {JSON.stringify(rawFile, null, 2)}
        </div>
      </div>

      <div className="border border-blue-800 p-4 rounded">
        <h2 className="text-white font-bold">2. Analytics Output</h2>
        <div className="bg-gray-900 p-2 mt-2 border border-gray-700">
          {JSON.stringify(analytics, null, 2)}
        </div>
      </div>
    </div>
  );
}