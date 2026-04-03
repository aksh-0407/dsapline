import dotenv from "dotenv";
import { defineConfig } from "@prisma/config";

// Load both .env and .env.local
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});