import 'dotenv/config';

import {
  PrismaPg,
} from '@prisma/adapter-pg';

import {
  PrismaClient,
} from '../src/generated/prisma/client';


/* =========================================================
   LEL TEAM TEMPLATE POOL

   V1 currently uses exactly these four official teams:

   YY
   ORZ
   VNR
   FNG

   Old templates are not deleted because historical
   tournaments may still reference them. They are disabled
   instead.
========================================================= */

const templates = [
  {
    name:
      'YY',

    shortName:
      'YY',

    logoUrl:
      '/team-logos/yy.png',

    region:
      'LEL',
  },

  {
    name:
      'ORZ',

    shortName:
      'ORZ',

    logoUrl:
      '/team-logos/orz.png',

    region:
      'LEL',
  },

  {
    name:
      'VNR',

    shortName:
      'VNR',

    logoUrl:
      '/team-logos/vnr.jpg',

    region:
      'LEL',
  },

  {
    name:
      'FNG',

    shortName:
      'FNG',

    logoUrl:
      '/team-logos/fng.jpg',

    region:
      'LEL',
  },
];


/* =========================================================
   MAIN
========================================================= */

async function main() {

  const databaseUrl =
    process.env.DATABASE_URL;


  if (!databaseUrl) {

    throw new Error(
      'DATABASE_URL is not configured',
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

    /* =====================================================
       STEP 1
       Disable every existing template.

       We deliberately do NOT delete old templates because
       TournamentTeam may still reference them.
    ===================================================== */

    await prisma.teamTemplate.updateMany({
      data: {
        enabled:
          false,
      },
    });


    /* =====================================================
       STEP 2
       Create/update the four official LEL teams.
    ===================================================== */

    for (
      const template
      of templates
    ) {

      await prisma.teamTemplate.upsert({

        where: {
          shortName:
            template.shortName,
        },


        update: {

          name:
            template.name,

          logoUrl:
            template.logoUrl,

          region:
            template.region,

          enabled:
            true,

        },


        create: {

          name:
            template.name,

          shortName:
            template.shortName,

          logoUrl:
            template.logoUrl,

          region:
            template.region,

          enabled:
            true,

        },

      });


      console.log(
        `Team template ready: ${template.shortName}`,
      );

    }


    /* =====================================================
       STEP 3
       Print enabled templates for verification.
    ===================================================== */

    const enabledTemplates =
      await prisma.teamTemplate.findMany({

        where: {
          enabled:
            true,
        },

        orderBy: {
          id:
            'asc',
        },

        select: {

          id:
            true,

          name:
            true,

          shortName:
            true,

          logoUrl:
            true,

          region:
            true,

          enabled:
            true,

        },

      });


    console.log(
      '',
    );

    console.log(
      '========================================',
    );

    console.log(
      'Enabled LEL team templates:',
    );

    console.table(
      enabledTemplates,
    );

    console.log(
      '========================================',
    );

    console.log(
      `${enabledTemplates.length} official teams enabled.`,
    );

  }
  finally {

    await prisma.$disconnect();

  }

}


/* =========================================================
   RUN
========================================================= */

main()
  .catch(
    (
      error,
    ) => {

      console.error(
        'Failed to seed team templates:',
        error,
      );


      process.exit(
        1,
      );

    },
  );