import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import {
  PrismaClient,
} from '../src/generated/prisma/client';

async function main() {
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
    console.log(
      'Resetting role ratings...',
    );

    await prisma.playerRoleRating.updateMany({
      data: {
        rating: 0,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
      },
    });

    const tournaments =
      await prisma.tournament.findMany({
        where: {
          settledAt: {
            not: null,
          },
        },

        include: {
          registrations: {
            select: {
              playerId: true,
              primaryRole: true,
            },
          },

          participants: {
            include: {
              teamMembership: true,
            },
          },

          matches: {
            include: {
              games: true,
            },
          },
        },
      });

    for (
      const tournament of tournaments
    ) {
      console.log(
        `Processing ${tournament.name}`,
      );

      const roleMap =
        new Map();

      for (
        const registration of
        tournament.registrations
      ) {
        if (
          registration.primaryRole
        ) {
          roleMap.set(
            registration.playerId,
            registration.primaryRole,
          );
        }
      }

      const participantPlayerMap =
        new Map<number, number>();

      const teamPlayers =
        new Map<number, number[]>();

      for (
        const participant of
        tournament.participants
      ) {
        participantPlayerMap.set(
          participant.id,
          participant.playerId,
        );

        const teamId =
          participant
            .teamMembership
            ?.teamId;

        if (!teamId) {
          continue;
        }

        const players =
          teamPlayers.get(
            teamId,
          ) ?? [];

        players.push(
          participant.playerId,
        );

        teamPlayers.set(
          teamId,
          players,
        );
      }

      const adjustments =
        new Map<
          number,
          {
            rating: number;
            games: number;
            wins: number;
            losses: number;
          }
        >();

      for (
        const participant of
        tournament.participants
      ) {
        adjustments.set(
          participant.playerId,
          {
            rating: 0,
            games: 0,
            wins: 0,
            losses: 0,
          },
        );
      }

      for (
        const match of
        tournament.matches
      ) {
        if (
          !match.teamAId ||
          !match.teamBId
        ) {
          continue;
        }

        for (
          const game of
          match.games
        ) {
          if (!game.winnerTeamId) {
            continue;
          }

          const loserTeamId =
            game.winnerTeamId ===
            match.teamAId
              ? match.teamBId
              : match.teamAId;

          const winners =
            teamPlayers.get(
              game.winnerTeamId,
            ) ?? [];

          const losers =
            teamPlayers.get(
              loserTeamId,
            ) ?? [];

          for (
            const playerId of winners
          ) {
            const adjustment =
              adjustments.get(
                playerId,
              );

            if (!adjustment) {
              continue;
            }

            adjustment.games++;
            adjustment.wins++;
            adjustment.rating += 20;
          }

          for (
            const playerId of losers
          ) {
            const adjustment =
              adjustments.get(
                playerId,
              );

            if (!adjustment) {
              continue;
            }

            adjustment.games++;
            adjustment.losses++;
            adjustment.rating -= 10;
          }

          if (
            game.mvpParticipantId
          ) {
            const playerId =
              participantPlayerMap.get(
                game.mvpParticipantId,
              );

            const adjustment =
              playerId
                ? adjustments.get(
                    playerId,
                  )
                : undefined;

            if (adjustment) {
              adjustment.rating += 10;
            }
          }

          if (
            game.svpParticipantId
          ) {
            const playerId =
              participantPlayerMap.get(
                game.svpParticipantId,
              );

            const adjustment =
              playerId
                ? adjustments.get(
                    playerId,
                  )
                : undefined;

            if (adjustment) {
              adjustment.rating += 5;
            }
          }
        }
      }

      for (
        const [
          playerId,
          adjustment,
        ] of adjustments
      ) {
        const role =
          roleMap.get(
            playerId,
          );

        if (!role) {
          continue;
        }

        const current =
          await prisma.playerRoleRating.findUnique({
            where: {
              playerId_role: {
                playerId,
                role,
              },
            },
          });

        if (!current) {
          continue;
        }

        await prisma.playerRoleRating.update({
          where: {
            playerId_role: {
              playerId,
              role,
            },
          },

          data: {
            rating:
              Math.max(
                0,
                current.rating +
                  adjustment.rating,
              ),

            gamesPlayed: {
              increment:
                adjustment.games,
            },

            wins: {
              increment:
                adjustment.wins,
            },

            losses: {
              increment:
                adjustment.losses,
            },
          },
        });
      }
    }

    console.log('');
    console.log(
      'Role ratings rebuilt successfully.',
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