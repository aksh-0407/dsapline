import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const prismaClientSingleton = () => {
  // 1. Create a standard Postgres connection pool using your Neon URL
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  
  // 2. Wrap it in the Prisma Adapter
  const adapter = new PrismaPg(pool)
  
  // 3. Pass the adapter to the Prisma Client
  return new PrismaClient({ adapter })
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma