import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { PointEventType } from '../src/generated/prisma/enums';

const rules = [
  {
    type: PointEventType.GAME_WIN,
    points: 10,
    description: 'Win one game',
  },
  {
    type: PointEventType.GAME_LOSS,
    points: 0,
    description: 'Lose one game',
  },
  {
    type: PointEventType.MVP,
    points: 5,
    description: 'Game MVP',
  },
  {
    type: PointEventType.SVP,
    points: 2,
    description: 'Game SVP',
  },
  {
    type: PointEventType.CHAMPION,
    points: 30,
    description: 'Tournament champion',
  },
  {
    type: PointEventType.RUNNER_UP,
    points: 10,
    description: 'Tournament runner-up',
  },
  {
    type: PointEventType.THIRD_PLACE,
    points: 5,
    description: 'Tournament third place',
  },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured');
  }

  const adapter = new PrismaPg({
    connectionString: databaseUrl,
  });

  const prisma = new PrismaClient({
    adapter,
  });

  try {
    for (const rule of rules) {
      await prisma.scoringRule.upsert({
        where: {
          type: rule.type,
        },

        update: {
          points: rule.points,
          enabled: true,
          description: rule.description,
        },

        create: {
          type: rule.type,
          points: rule.points,
          enabled: true,
          description: rule.description,
        },
      });
    }

    console.log('LEL scoring rules ready.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});