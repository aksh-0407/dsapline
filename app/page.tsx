export const dynamic = "force-dynamic";

import { auth, currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { getDashboardData } from "@/lib/analytics";
import { StatsGrid } from "@/components/StatsGrid";
import { ArrowRight, Code2, TrendingUp, Shield, BarChart3, Users } from "lucide-react";
import { ActivityHeatmap } from "@/components/ActivityHeatmap"; 

export default async function Home() {
  const { userId } = await auth();
  const user = await currentUser();
  
  // --- 1. LANDING PAGE (Logged Out) ---
  if (!userId || !user) {
    return (
      <main className="min-h-screen bg-gray-950 text-white selection:bg-blue-500/30 flex flex-col justify-center">
        
        {/* Note: Navbar is removed from here as it is handled by layout.tsx */}

        {/* Hero Section */}
        <section className="relative pt-20 pb-20 px-6 overflow-hidden">
          {/* Background Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[500px] bg-blue-600/20 blur-[120px] rounded-full opacity-50 pointer-events-none" />
          
          <div className="max-w-5xl mx-auto text-center relative z-10 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/30 border border-blue-800 text-blue-400 text-xs font-medium mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              v1.0 is now live
            </div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
              Master DSA through <br className="hidden md:block" />
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Discipline, Accountability
              </span>
              <br />
              and Collaborative Learning.
            </h1>
            
            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Stop solving in a vacuum. Track your LeetCode & Codeforces journey, 
              visualize your consistency, and build a legacy of your code.
            </p>

            {/* Buttons removed as requested. User must use top-right Sign In. */}
          </div>
        </section>

        {/* Features Grid */}
        <section className="max-w-6xl mx-auto px-6 pb-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* 1. Deep Analytics */}
            <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-2xl hover:border-gray-700 transition-colors">
              <div className="w-12 h-12 bg-purple-900/30 rounded-lg flex items-center justify-center mb-4 text-purple-400">
                <BarChart3 size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">Deep Analytics</h3>
              <p className="text-gray-400">
                Visualize your difficulty distribution, track your streaks, and analyze your average rating over time.
              </p>
            </div>

            {/* 2. Collaborative Learning */}
            <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-2xl hover:border-gray-700 transition-colors">
              <div className="w-12 h-12 bg-blue-900/30 rounded-lg flex items-center justify-center mb-4 text-blue-400">
                <Users size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">Collaborative Learning</h3>
              <p className="text-gray-400">
                Learn from the community. Compare solutions, share insights, and grow together through shared progress.
              </p>
            </div>

            {/* 3. Code Archive */}
            <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-2xl hover:border-gray-700 transition-colors">
              <div className="w-12 h-12 bg-emerald-900/30 rounded-lg flex items-center justify-center mb-4 text-emerald-400">
                <Shield size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">Code Archive</h3>
              <p className="text-gray-400">
                Never lose a solution again. Search your past submissions by tag, difficulty, or platform in milliseconds.
              </p>
            </div>

          </div>
        </section>

      </main>
    );
  }

  // --- 2. DASHBOARD (Logged In) ---
  const stats = await getDashboardData(userId);

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Dashboard</h2>
            <p className="text-gray-400">Welcome back, Whizz.</p>
          </div>
          <Link href="/submit">
            <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition shadow-lg shadow-blue-900/20 hover:scale-[1.02]">
              <span>Log Submission</span>
              <ArrowRight size={16} />
            </button>
          </Link>
        </div>

        {/* Stats Row */}
        <StatsGrid stats={stats} />

        {/* Heatmap Placeholder */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
           <div className="flex items-center gap-2 mb-4">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
             <h3 className="font-bold text-gray-300">Activity Graph</h3>
           </div>
           
           {/* Render the Heatmap passing the data from stats */}
           <ActivityHeatmap activityMap={stats.activityMap} />
        </div>

        {/* Recent Activity List */}
        <div>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-400"/> Recent Activity
          </h3>
          {stats.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {stats.recentActivity.map((sub) => (
                <div key={sub.id} className="bg-gray-900 border border-gray-800 p-4 rounded-lg flex items-center justify-between hover:border-gray-700 transition group">
                  
                  {/* LEFT: Info & Badges */}
                  <div className="flex items-center gap-4">
                    <span className={`px-2 py-1 rounded text-xs font-mono font-bold
                      ${sub.difficulty >= 7 ? 'bg-red-900/30 text-red-400' : 
                        sub.difficulty >= 4 ? 'bg-yellow-900/30 text-yellow-400' : 
                        'bg-emerald-900/30 text-emerald-400'}`}>
                      {sub.difficulty.toFixed(1)}
                    </span>
                    <div>
                      {/* Title Link */}
                      <Link href={`/submission/${sub.id}`} className="font-semibold hover:text-blue-400 transition-colors">
                        {sub.title}
                      </Link>
                      <div className="text-xs text-gray-500 flex gap-2">
                        <span>{sub.date}</span>
                        <span>•</span>
                        <span className="capitalize">{sub.platform}</span>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: Tags & Action Button */}
                  <div className="flex items-center gap-4">
                    <div className="hidden md:flex gap-1">
                      {sub.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] bg-gray-800 text-gray-400 px-2 py-1 rounded border border-gray-700">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <Link 
                      href={`/submission/${sub.id}`}
                      className="text-gray-500 hover:text-white transition-colors p-2 rounded-full hover:bg-gray-800"
                      title="View Code"
                    >
                      <Code2 size={18} />
                    </Link>
                  </div>

                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-900/30 rounded-xl border border-gray-800/50">
               <p className="text-gray-500 italic">No submissions yet. Go solve a problem!</p>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}