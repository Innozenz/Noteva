import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 : le moteur Rust a disparu et `datasource db` n'a pas d'`url` (elle
// vit dans prisma.config.ts, côté CLI). Le client runtime doit donc recevoir un
// driver adapter explicite — `new PrismaClient()` sans argument lève à
// l'instanciation. PrismaPg fonctionne aussi bien avec Neon qu'avec le Postgres
// local du docker-compose.
const prismaClientSingleton = () => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL n'est pas défini (voir .env.example)");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;
