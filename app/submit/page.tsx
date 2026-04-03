import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SubmitForm } from "@/components/SubmitForm";

export default async function SubmitPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="min-h-screen bg-gray-950 py-12">
       <SubmitForm />
    </div>
  );
}