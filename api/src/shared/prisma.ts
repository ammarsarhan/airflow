// Implements a singleton pattern to stop application from regenerating a new Prisma client due to hot reloads.

import { PrismaClient } from '@/generated/prisma/client';

const prismaGlobal = global as unknown as { prisma: PrismaClient };

const prisma = prismaGlobal.prisma || new PrismaClient({} as any);

if (process.env.NODE_ENV !== "production") {
    prismaGlobal.prisma = prisma;
}

export default prisma;