"use client";

import { 
  SignedIn, 
  SignedOut, 
  SignInButton, 
  UserButton 
} from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image"; // Import the Image component
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

export function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Dashboard", href: "/" },
    { name: "Submit", href: "/submit" },
    { name: "Archive", href: "/archive" },
    { name: "Leaderboard", href: "/leaderboard" },
  ];

  return (
    <nav className="border-b border-gray-800 bg-gray-950 text-white p-4">
      <div className="container mx-auto flex items-center justify-between">
        
        {/* Logo Section */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
           {/* We use /logo.png because it is in the public folder */}
           <Image 
             src="/logo.png" 
             alt="DSApline Logo" 
             width={40} 
             height={40} 
             className="rounded-md object-contain"
           />
           <span className="text-xl font-bold tracking-tight text-blue-500">
             DSApline
           </span>
        </Link>

        <div className="flex items-center gap-6">
          <SignedIn>
            <div className="hidden md:flex gap-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "text-sm font-medium transition-colors hover:text-white",
                    pathname === item.href ? "text-white" : "text-gray-400"
                  )}
                >
                  {item.name}
                </Link>
              ))}
            </div>
            
            <UserButton afterSignOutUrl="/" />
          </SignedIn>

          <SignedOut>
             <SignInButton mode="modal">
               <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition">
                 Sign In
               </button>
             </SignInButton>
          </SignedOut>
        </div>
      </div>
    </nav>
  );
}