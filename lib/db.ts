import prisma from "./prisma";
import { currentUser } from "@clerk/nextjs/server";
import { resolveDisplayName } from "./utils";

/**
 * Upserts the current Clerk user into the SQL Users table.
 * Call this on profile pages / dashboard to ensure the user exists in SQL.
 */
export async function getOrCreateUserSQL() {
  const user = await currentUser();
  if (!user) return null;

  const email = user.emailAddresses[0]?.emailAddress ?? `${user.id}@clerk.user`;
  const fullName = resolveDisplayName(user.firstName, user.lastName, email, user.id);

  return prisma.user.upsert({
    where: { id: user.id },
    update: { fullName, email },
    create: { id: user.id, email, fullName },
  });
}