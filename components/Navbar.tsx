"use client";

import Link from "next/link";
import { 
  UserButton, 
  SignInButton, 
  SignedIn, 
  SignedOut,
  useUser 
} from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { Code2, LayoutDashboard, Trophy, Archive, PlusCircle, Menu, X } from "lucide-react";
import { useState } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path: string) => pathname === path;

  const navLinks = [
    { name: "Dashboard", href: "/", icon: <LayoutDashboard size={18} /> },
    { name: "Submit", href: "/submit", icon: <PlusCircle size={18} /> },
    { name: "Archive", href: "/archive", icon: <Archive size={18} /> },
    { name: "Leaderboard", href: "/leaderboard", icon: <Trophy size={18} /> },
  ];

  return (
    <nav className="border-b border-gray-800 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          
          {/* Logo - Always visible */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="bg-blue-600/20 p-2 rounded-lg group-hover:bg-blue-600/30 transition-colors">
              <Code2 className="text-blue-500" size={24} />
            </div>
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              DSAPline
            </span>
          </Link>

          {/* DESKTOP Navigation - Only visible if Signed In */}
          <SignedIn>
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive(link.href)
                      ? "bg-blue-600/10 text-blue-400"
                      : "text-gray-400 hover:text-gray-100 hover:bg-white/5"
                  }`}
                >
                  {link.icon}
                  {link.name}
                </Link>
              ))}
            </div>
          </SignedIn>

          {/* Auth & Mobile Toggle Section */}
          <div className="flex items-center gap-4">
            
            {/* If Signed Out: Show "Sign In" Button */}
            <SignedOut>
              <SignInButton mode="modal">
                <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-500/20">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>

            {/* If Signed In: Show User Profile & Mobile Menu Button */}
            <SignedIn>
              <div className="flex items-center gap-4">
                <UserButton afterSignOutUrl="/" />

                {/* Mobile Menu Toggle (Hidden on Desktop) */}
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="md:hidden p-2 text-gray-400 hover:text-white focus:outline-none bg-white/5 rounded-md"
                >
                  {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
              </div>
            </SignedIn>
          </div>
        </div>
      </div>

      {/* MOBILE MENU DROPDOWN - Only render if Signed In AND Menu is Open */}
      <SignedIn>
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-800 bg-black/95 backdrop-blur-xl animate-in slide-in-from-top-2">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)} // Close menu when clicked
                  className={`flex items-center gap-3 px-3 py-3 rounded-md text-base font-medium ${
                    isActive(link.href)
                      ? "bg-blue-600/10 text-blue-400"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {link.icon}
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </SignedIn>
    </nav>
  );
}