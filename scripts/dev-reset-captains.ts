import 'dotenv/config';

import bcrypt from 'bcrypt';

import {
  ConfigService,
} from '@nestjs/config';

import {
  PrismaService,
} from '../src/prisma/prisma.service';


async function main() {

  const tournamentId =
    Number(
      process.argv[2],
    );


  const password =
    process.argv[3];


  if (
    !Number.isInteger(
      tournamentId,
    )
    ||
    tournamentId <= 0
    ||
    !password
  ) {

    throw new Error(
      'Usage: npx tsx scripts/dev-reset-captains.ts <tournamentId> <password>',
    );

  }


  if (
    process.env.NODE_ENV ===
    'production'
  ) {

    throw new Error(
      'This dev script must not run in production.',
    );

  }


  const configService =
    new ConfigService();


  const prisma =
    new PrismaService(
      configService,
    );


  await prisma.$connect();


  try {

    const teams =
      await prisma
        .tournamentTeam
        .findMany({

          where: {
            tournamentId,
          },

          orderBy: {
            draftOrder:
              'asc',
          },

          select: {

            name:
              true,

            draftOrder:
              true,

            captainParticipant: {

              select: {

                player: {

                  select: {

                    userId:
                      true,

                    displayName:
                      true,

                    user: {

                      select: {

                        username:
                          true,

                      },

                    },

                  },

                },

              },

            },

          },

        });


    if (
      teams.length === 0
    ) {

      throw new Error(
        'No tournament teams found.',
      );

    }


    const passwordHash =
      await bcrypt.hash(
        password,
        12,
      );


    console.log('');
    console.log(
      `Tournament ${tournamentId} Captain accounts`,
    );
    console.log('');


    for (
      const team
      of teams
    ) {

      const player =
        team
          .captainParticipant
          ?.player;


      if (!player) {

        throw new Error(
          `Team ${team.name} has no Captain`,
        );

      }


      await prisma.user.update({

        where: {
          id:
            player.userId,
        },

        data: {
          passwordHash,
        },

      });


      console.log(
        [
          `#${team.draftOrder}`,
          team.name,
          '→',
          player.displayName,
          `→ username: ${player.user.username}`,
        ].join(
          ' ',
        ),
      );

    }


    console.log('');
    console.log(
      'Captain passwords updated.',
    );

  }
  finally {

    await prisma.$disconnect();

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