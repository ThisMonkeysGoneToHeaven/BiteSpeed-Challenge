import { PrismaClient } from '@prisma/client';
import e from 'express';
const prisma = new PrismaClient();

const deleteAllRows = async () => {
    await prisma.contact.deleteMany({});
};

export default deleteAllRows;