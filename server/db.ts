// Bug Fights - Database Client
// Singleton Prisma client instance with libsql adapter for Bun

import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaLibSql({
    url: process.env['DATABASE_URL'] ?? 'file:./prisma/bugfights.db',
});
const prisma = new PrismaClient({ adapter });

export default prisma;
