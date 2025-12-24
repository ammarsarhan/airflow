// Implements a singleton pattern to stop application from regenerating a new Prisma client due to hot reloads.
import { PrismaClient } from '@/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const prismaGlobal = global as unknown as { prisma: PrismaClient };

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = prismaGlobal.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
    prismaGlobal.prisma = prisma;
}

export default prisma;
