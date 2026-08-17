import 'dotenv/config';
import * as bcrypt from 'bcrypt';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured');
  }

  const username = process.env.SEED_ADMIN_USERNAME;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const displayName =
    process.env.SEED_ADMIN_DISPLAY_NAME ?? 'LEL Admin';

  if (!username || !password) {
    throw new Error(
      'SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD are required',
    );
  }

  const adapter = new PrismaPg({
    connectionString: databaseUrl,
  });

  const prisma = new PrismaClient({ adapter });

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const existingUser = await prisma.user.findUnique({
      where: { username },
      include: {
        profile: true,
      },
    });

    if (existingUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
          passwordHash,
        },
      });

      console.log(`SUPER_ADMIN updated: ${username}`);
      return;
    }

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',

        profile: {
          create: {
            displayName,
          },
        },
      },

      include: {
        profile: true,
      },
    });

    if (!user.profile) {
      throw new Error('Admin profile creation failed');
    }

    await prisma.playerStats.create({
      data: {
        playerId: user.profile.id,
      },
    });

    await prisma.playerRoleRating.createMany({
      data: [
        { playerId: user.profile.id, role: 'TOP' },
        { playerId: user.profile.id, role: 'JUNGLE' },
        { playerId: user.profile.id, role: 'MID' },
        { playerId: user.profile.id, role: 'ADC' },
        { playerId: user.profile.id, role: 'SUPPORT' },
      ],
    });

    console.log(`SUPER_ADMIN created: ${username}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});