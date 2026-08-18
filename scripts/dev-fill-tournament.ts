import 'dotenv/config';

import {
  ConfigService,
} from '@nestjs/config';

import {
  PrismaService,
} from '../src/prisma/prisma.service';

import {
  RegistrationStatus,
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
    ||
    tournamentId <= 0
  ) {

    throw new Error(
      'Usage: npx tsx scripts/dev-fill-tournament.ts <tournamentId>',
    );

  }


  /* =========================================================
     PRISMA
  ========================================================= */

  const configService =
    new ConfigService();


  const prisma =
    new PrismaService(
      configService,
    );


  await prisma.$connect();


  try {

    /* =======================================================
       TOURNAMENT
    ======================================================= */

    const tournament =
      await prisma
        .tournament
        .findUnique({

          where: {
            id:
              tournamentId,
          },

        });


    if (!tournament) {

      throw new Error(
        `Tournament ${tournamentId} not found`,
      );

    }


    if (
      tournament.status !==
      TournamentStatus
        .REGISTRATION_OPEN
    ) {

      throw new Error(
        `Tournament must be REGISTRATION_OPEN. Current status: ${tournament.status}`,
      );

    }


    /* =======================================================
       EXISTING REGISTRATIONS
    ======================================================= */

    const existing =
      await prisma
        .tournamentRegistration
        .findMany({

          where: {

            tournamentId,

            status:
              RegistrationStatus
                .REGISTERED,

          },


          select: {
            playerId:
              true,
          },

        });


    const registeredPlayerIds =
      existing.map(
        (
          item,
        ) =>
          item.playerId,
      );


    const remaining =
      tournament.maxPlayers
      -
      existing.length;


    console.log('');
    console.log(
      `Tournament: ${tournament.name}`,
    );

    console.log(
      `Required players: ${tournament.maxPlayers}`,
    );

    console.log(
      `Already registered: ${existing.length}`,
    );

    console.log(
      `Need to add: ${remaining}`,
    );


    if (
      remaining <= 0
    ) {

      console.log('');
      console.log(
        'Tournament is already full.',
      );

      return;

    }


    /* =======================================================
       FIND DEV PLAYERS
    ======================================================= */

    const candidates =
      await prisma
        .playerProfile
        .findMany({

          where: {

            displayName: {
              startsWith:
                'LEL测试选手',
            },


            id: {
              notIn:
                registeredPlayerIds,
            },

          },


          orderBy: {
            id:
              'asc',
          },


          take:
            remaining,


          select: {

            id:
              true,

            displayName:
              true,

            mainRole:
              true,

            secondaryRole:
              true,

          },

        });


    if (
      candidates.length <
      remaining
    ) {

      throw new Error(
        [
          'Not enough dev players.',
          `Need ${remaining},`,
          `found ${candidates.length}.`,
        ].join(
          ' ',
        ),
      );

    }


    /* =======================================================
       CREATE REGISTRATIONS
    ======================================================= */

    await prisma
      .tournamentRegistration
      .createMany({

        data:
          candidates.map(
            (
              player,
            ) => ({

              tournamentId,

              playerId:
                player.id,

              status:
                RegistrationStatus
                  .REGISTERED,

              primaryRole:
                player.mainRole,

              secondaryRole:
                player.secondaryRole,

              checkedIn:
                false,

              waitlistPosition:
                null,

              registeredAt:
                new Date(),

            }),
          ),

      });


    /* =======================================================
       OUTPUT
    ======================================================= */

    console.log('');
    console.log(
      'Added players:',
    );


    for (
      const player
      of candidates
    ) {

      console.log(
        `- ${player.id}: ${player.displayName}`,
      );

    }


    const finalCount =
      await prisma
        .tournamentRegistration
        .count({

          where: {

            tournamentId,

            status:
              RegistrationStatus
                .REGISTERED,

          },

        });


    console.log('');
    console.log(
      `Final registered count: ${finalCount}/${tournament.maxPlayers}`,
    );


    if (
      finalCount ===
      tournament.maxPlayers
    ) {

      console.log('');
      console.log(
        'READY TO CLOSE REGISTRATION.',
      );

    }

  }
  finally {

    await prisma
      .$disconnect();

  }

}


main()
  .catch(
    (
      error,
    ) => {

      console.error(
        error,
      );

      process.exit(
        1,
      );

    },
  );