import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-500">
      <Loader2 size={32} className="animate-spin mb-4 text-blue-500" />
      <p className="text-sm font-medium animate-pulse">Loading ...</p>
    </div>
  );
}
