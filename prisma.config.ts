import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";
import { getServerEnv } from "./lib/env";

loadEnvConfig(process.cwd(), true);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: getServerEnv().DATABASE_URL,
  },
});
