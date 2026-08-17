import 'dotenv/config';

import {
  PrismaPg,
} from '@prisma/adapter-pg';

import {
  PrismaClient,
} from '../src/generated/prisma/client';

import {
  DraftStatus,
  TournamentStatus,
} from '../src/generated/prisma/enums';

async function main() {
  const tournamentId =
    Number(
      process.argv[2],
    );

  if (
    !Number.isInteger(
      tournamentId,
    )
  ) {
    throw new Error(
      'Usage: npx tsx prisma/reset-draft-dev.ts <tournamentId>',
    );
  }

  const databaseUrl =
    process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL missing',
    );
  }

  const adapter =
    new PrismaPg({
      connectionString:
        databaseUrl,
    });

  const prisma =
    new PrismaClient({
      adapter,
    });

  try {
    const tournament =
      await prisma.tournament.findUnique({
        where: {
          id: tournamentId,
        },

        include: {
          teams: true,
        },
      });

    if (!tournament) {
      throw new Error(
        'Tournament not found',
      );
    }

    if (
      !tournament.name.includes(
        'Draft Test',
      )
    ) {
      throw new Error(
        'Refusing to reset a non-development Draft Test tournament',
      );
    }

    await prisma.$transaction(
      async (tx) => {
        const sessions =
          await tx.draftSession.findMany({
            where: {
              tournamentId,
            },

            select: {
              id: true,
            },
          });

        const sessionIds =
          sessions.map(
            (session) =>
              session.id,
          );

        if (
          sessionIds.length > 0
        ) {
          await tx.draftPick.deleteMany({
            where: {
              draftSessionId: {
                in: sessionIds,
              },
            },
          });
        }

        await tx.draftSession.deleteMany({
          where: {
            tournamentId,
          },
        });

        // 删除现有队员关系
        await tx.teamMember.deleteMany({
          where: {
            team: {
              tournamentId,
            },
          },
        });

        // Captain 放回各自队伍
        for (
          const team of tournament.teams
        ) {
          if (
            team.captainParticipantId
          ) {
            await tx.teamMember.create({
              data: {
                teamId:
                  team.id,

                participantId:
                  team.captainParticipantId,
              },
            });
          }
        }

        await tx.tournament.update({
          where: {
            id: tournamentId,
          },

          data: {
            status:
              TournamentStatus.DRAFTING,
          },
        });
      },
    );

    console.log(
      `Draft Test tournament ${tournamentId} reset successfully.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(
  (error) => {
    console.error(
      error,
    );

    process.exit(1);
  },
);