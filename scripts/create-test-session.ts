import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function genCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r = '';
  for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)];
  return r;
}

async function main() {
  const old = await prisma.liveSession.findFirst({
    where: { code: 'HLL69G' },
    select: { quizId: true, workspaceId: true, hostUserId: true },
  });
  
  if (!old) {
    console.error('Session HLL69G not found');
    process.exit(1);
  }

  const ns = await prisma.liveSession.create({
    data: {
      code: genCode(),
      quizId: old.quizId,
      workspaceId: old.workspaceId,
      hostUserId: old.hostUserId,
      status: 'LOBBY',
    },
  });

  console.log('New session code:', ns.code);
  console.log('Host URL: http://localhost:3000/host/' + ns.code);
  console.log('Player URL: http://localhost:3000/play/' + ns.code);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
