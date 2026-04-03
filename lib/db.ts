import prisma from "./prisma";
import { currentUser } from "@clerk/nextjs/server";

/**
 * Upserts the current Clerk user into the SQL Users table.
 * Call this on profile pages / dashboard to ensure the user exists in SQL.
 */
export async function getOrCreateUserSQL() {
  const user = await currentUser();
  if (!user) return null;

  const fullName = `${user.firstName} ${user.lastName || ""}`.trim();

  return prisma.user.upsert({
    where: { id: user.id },
    update: {
      fullName,
      email: user.emailAddresses[0]?.emailAddress ?? `${user.id}@clerk.user`,
    },
    create: {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress ?? `${user.id}@clerk.user`,
      fullName,
    },
  });
}