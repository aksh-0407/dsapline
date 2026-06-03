import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SubmitForm } from "@/components/SubmitForm";

export default async function SubmitPage() {
  const { userId } = await auth();
  // No dedicated /sign-in route exists (Clerk uses a modal). Send logged-out
  // visitors to the landing page, which hosts the Sign In button.
  if (!userId) redirect("/");

  return (
    <div className="min-h-screen bg-gray-950 py-12">
       <SubmitForm />
    </div>
  );
}