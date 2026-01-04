import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SubmitForm } from "@/components/SubmitForm";

export default async function SubmitPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    // CHANGED: bg-gray-50 -> bg-gray-950 to match the dark theme
    <div className="min-h-screen bg-gray-950 py-12">
       <SubmitForm />
    </div>
  );
}