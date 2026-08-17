import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const templates = [
  {
    name: 'T1',
    shortName: 'T1',
    region: 'KR',
  },
  {
    name: 'Gen.G',
    shortName: 'GEN',
    region: 'KR',
  },
  {
    name: 'Bilibili Gaming',
    shortName: 'BLG',
    region: 'CN',
  },
  {
    name: 'G2 Esports',
    shortName: 'G2',
    region: 'EU',
  },
  {
    name: 'Top Esports',
    shortName: 'TES',
    region: 'CN',
  },
  {
    name: 'Dplus KIA',
    shortName: 'DK',
    region: 'KR',
  },
  {
    name: 'Hanwha Life Esports',
    shortName: 'HLE',
    region: 'KR',
  },
  {
    name: 'Cloud9',
    shortName: 'C9',
    region: 'NA',
  },
];

async function main() {
  const databaseUrl =
    process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not configured',
    );
  }

  const adapter = new PrismaPg({
    connectionString:
      databaseUrl,
  });

  const prisma =
    new PrismaClient({
      adapter,
    });

  try {
    for (
      const template of templates
    ) {
      await prisma.teamTemplate.upsert({
        where: {
          shortName:
            template.shortName,
        },

        update: {
          name:
            template.name,

          region:
            template.region,

          enabled: true,
        },

        create: {
          name:
            template.name,

          shortName:
            template.shortName,

          region:
            template.region,

          enabled: true,
        },
      });
    }

    console.log(
      `${templates.length} team templates ready.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(
  (error) => {
    console.error(error);
    process.exit(1);
  },
);