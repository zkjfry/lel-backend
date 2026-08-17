import 'dotenv/config';
import * as bcrypt from 'bcrypt';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

import {
  MatchFormat,
  PlayerRole,
  RankTier,
  RegistrationStatus,
  TournamentFormat,
  TournamentStatus,
  UserRole,
  UserStatus,
} from '../src/generated/prisma/enums';

const DEV_PLAYER_COUNT = 25;
const DEV_PASSWORD = 'DevPlayer123!';

const roles: PlayerRole[] = [
  PlayerRole.TOP,
  PlayerRole.JUNGLE,
  PlayerRole.MID,
  PlayerRole.ADC,
  PlayerRole.SUPPORT,
];

const ranks: RankTier[] = [
  RankTier.PLATINUM,
  RankTier.EMERALD,
  RankTier.DIAMOND,
  RankTier.MASTER,
];

const divisions = ['IV', 'III', 'II', 'I'];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured');
  }

  const adminUsername =
    process.env.SEED_ADMIN_USERNAME;

  if (!adminUsername) {
    throw new Error(
      'SEED_ADMIN_USERNAME is not configured',
    );
  }

  const adapter = new PrismaPg({
    connectionString: databaseUrl,
  });

  const prisma = new PrismaClient({
    adapter,
  });

  try {
    // ==========================================================
    // 1. FIND SUPER ADMIN
    // ==========================================================

    const admin =
      await prisma.user.findUnique({
        where: {
          username: adminUsername,
        },
      });

    if (!admin) {
      throw new Error(
        `Admin user "${adminUsername}" not found. Run npx prisma db seed first.`,
      );
    }

    // ==========================================================
    // 2. CREATE / UPDATE 25 DEV PLAYERS
    // ==========================================================

    const passwordHash =
      await bcrypt.hash(
        DEV_PASSWORD,
        12,
      );

    const devPlayers: {
      userId: number;
      playerId: number;
      username: string;
      mainRole: PlayerRole;
      secondaryRole: PlayerRole;
    }[] = [];

    for (
      let i = 1;
      i <= DEV_PLAYER_COUNT;
      i++
    ) {
      const number =
        i.toString().padStart(2, '0');

      const username =
        `devplayer${number}`;

      const displayName =
        `LEL测试选手${number}`;

      const mainRole =
        roles[(i - 1) % roles.length];

      const secondaryRole =
        roles[i % roles.length];

      const rankTier =
        ranks[(i - 1) % ranks.length];

      const rankDivision =
        divisions[
          (i - 1) %
            divisions.length
        ];

      const user =
        await prisma.user.upsert({
          where: {
            username,
          },

          update: {
            passwordHash,
            role: UserRole.PLAYER,
            status: UserStatus.ACTIVE,
          },

          create: {
            username,
            passwordHash,
            role: UserRole.PLAYER,
            status: UserStatus.ACTIVE,
          },
        });

      const profile =
        await prisma.playerProfile.upsert({
          where: {
            userId: user.id,
          },

          update: {
            displayName,

            riotGameName:
              `LELPlayer${number}`,

            riotTagLine: 'DEV',

            riotRegion: 'SG',

            rankTier,

            rankDivision,

            mainRole,

            secondaryRole,

            yyName:
              `lel${number}`,
          },

          create: {
            userId:
              user.id,

            displayName,

            riotGameName:
              `LELPlayer${number}`,

            riotTagLine: 'DEV',

            riotRegion: 'SG',

            rankTier,

            rankDivision,

            mainRole,

            secondaryRole,

            yyName:
              `lel${number}`,
          },
        });

      await prisma.playerStats.upsert({
        where: {
          playerId:
            profile.id,
        },

        update: {},

        create: {
          playerId:
            profile.id,
        },
      });

      for (
        const role of roles
      ) {
        await prisma.playerRoleRating.upsert({
          where: {
            playerId_role: {
              playerId:
                profile.id,

              role,
            },
          },

          update: {},

          create: {
            playerId:
              profile.id,

            role,

            rating: 0,
          },
        });
      }

      devPlayers.push({
        userId:
          user.id,

        playerId:
          profile.id,

        username,

        mainRole,

        secondaryRole,
      });

      console.log(
        `Created/updated ${username} (${mainRole}/${secondaryRole})`,
      );
    }

    // ==========================================================
    // 3. CREATE DEV TOURNAMENT
    // ==========================================================

    const slug =
      'lel-dev-draft-test-001';

    const existingTournament =
      await prisma.tournament.findUnique({
        where: {
          slug,
        },
      });

    if (existingTournament) {
      const participantCount =
        await prisma.tournamentParticipant.count({
          where: {
            tournamentId:
              existingTournament.id,
          },
        });

      if (participantCount > 0) {
        throw new Error(
          'LEL Draft Test #001 has already been finalized. Do not rerun this dev seed after participants have been generated.',
        );
      }
    }

    const tournament =
      await prisma.tournament.upsert({
        where: {
          slug,
        },

        update: {
          name:
            'LEL Draft Test #001',

          description:
            'Development tournament for testing registration, captains and Snake Draft.',

          status:
            TournamentStatus
              .REGISTRATION_CLOSED,

          maxPlayers: 20,
          maxWaitlist: 5,

          teamCount: 4,
          playersPerTeam: 5,

          matchFormat:
            MatchFormat.BO3,

          tournamentFormat:
            TournamentFormat
              .SINGLE_ELIMINATION,

          createdById:
            admin.id,
        },

        create: {
          name:
            'LEL Draft Test #001',

          slug,

          description:
            'Development tournament for testing registration, captains and Snake Draft.',

          status:
            TournamentStatus
              .REGISTRATION_CLOSED,

          maxPlayers: 20,
          maxWaitlist: 5,

          teamCount: 4,
          playersPerTeam: 5,

          matchFormat:
            MatchFormat.BO3,

          tournamentFormat:
            TournamentFormat
              .SINGLE_ELIMINATION,

          createdById:
            admin.id,
        },
      });

    // ==========================================================
    // 4. RESET ONLY THIS DEV TOURNAMENT'S REGISTRATIONS
    // ==========================================================

    await prisma.$transaction(
      async (tx) => {
        await tx.tournamentRegistration.deleteMany({
          where: {
            tournamentId:
              tournament.id,
          },
        });

        // ======================================================
        // First 20 = REGISTERED
        // Last 5  = WAITLIST
        // ======================================================

        await tx.tournamentRegistration.createMany({
          data:
            devPlayers.map(
              (
                player,
                index,
              ) => {
                const registered =
                  index < 20;

                return {
                  tournamentId:
                    tournament.id,

                  playerId:
                    player.playerId,

                  status:
                    registered
                      ? RegistrationStatus
                          .REGISTERED
                      : RegistrationStatus
                          .WAITLIST,

                  primaryRole:
                    player.mainRole,

                  secondaryRole:
                    player.secondaryRole,

                  waitlistPosition:
                    registered
                      ? null
                      : index -
                        20 +
                        1,

                  checkedIn:
                    false,

                  registeredAt:
                    new Date(
                      Date.now() +
                        index *
                          1000,
                    ),
                };
              },
            ),
        });
      },
    );

    // ==========================================================
    // 5. VERIFY
    // ==========================================================

    const registeredCount =
      await prisma.tournamentRegistration.count({
        where: {
          tournamentId:
            tournament.id,

          status:
            RegistrationStatus.REGISTERED,
        },
      });

    const waitlistCount =
      await prisma.tournamentRegistration.count({
        where: {
          tournamentId:
            tournament.id,

          status:
            RegistrationStatus.WAITLIST,
        },
      });

    console.log('');
    console.log(
      '========================================',
    );

    console.log(
      'LEL DEV DATA READY',
    );

    console.log(
      '========================================',
    );

    console.log(
      `Tournament ID: ${tournament.id}`,
    );

    console.log(
      `Tournament: ${tournament.name}`,
    );

    console.log(
      `Registered: ${registeredCount}/20`,
    );

    console.log(
      `Waitlist: ${waitlistCount}/5`,
    );

    console.log('');
    console.log(
      'Dev player accounts:',
    );

    console.log(
      'devplayer01 ~ devplayer25',
    );

    console.log(
      `Password: ${DEV_PASSWORD}`,
    );

    console.log(
      '========================================',
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