import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client';

import {
  DraftStatus,
  ParticipantStatus,
  TournamentStatus,
} from '../generated/prisma/enums';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DraftService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // ============================================================
  // GET CURRENT DRAFT STATE
  // ============================================================

  async getState(tournamentId: number) {
    const tournament =
      await this.prisma.tournament.findUnique({
        where: {
          id: tournamentId,
        },

        select: {
          id: true,
          name: true,
          status: true,
          teamCount: true,
          playersPerTeam: true,
        },
      });

    if (!tournament) {
      throw new NotFoundException(
        'Tournament not found',
      );
    }

    const session =
      await this.prisma.draftSession.findFirst({
        where: {
          tournamentId,
        },

        orderBy: {
          id: 'desc',
        },

        include: {
          currentTeam: true,

          picks: {
            orderBy: {
              pickNumber: 'asc',
            },

            include: {
              team: true,

              participant: {
                include: {
                  player: {
                    include: {
                      user: {
                        select: {
                          id: true,
                          username: true,
                          avatarUrl: true,
                        },
                      },

                      stats: true,
                      roleRatings: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

    const teams =
      await this.prisma.tournamentTeam.findMany({
        where: {
          tournamentId,
        },

        orderBy: {
          draftOrder: 'asc',
        },

        include: {
          captainParticipant: {
            include: {
              player: {
                include: {
                  user: {
                    select: {
                      id: true,
                      username: true,
                      avatarUrl: true,
                    },
                  },

                  stats: true,
                  roleRatings: true,
                },
              },
            },
          },

          members: {
            include: {
              participant: {
                include: {
                  player: {
                    include: {
                      user: {
                        select: {
                          id: true,
                          username: true,
                          avatarUrl: true,
                        },
                      },

                      stats: true,
                      roleRatings: true,
                    },
                  },
                },
              },
            },

            orderBy: {
              joinedAt: 'asc',
            },
          },
        },
      });

    const availablePlayers =
      await this.prisma.tournamentParticipant.findMany({
        where: {
          tournamentId,

          status:
            ParticipantStatus.ACTIVE,

          teamMembership: {
            is: null,
          },
        },

        include: {
          player: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  avatarUrl: true,
                },
              },

              stats: true,

              roleRatings: {
                orderBy: {
                  role: 'asc',
                },
              },
            },
          },
        },

        orderBy: {
          id: 'asc',
        },
      });

    const totalPicks =
      tournament.teamCount *
      (tournament.playersPerTeam - 1);

    return {
      tournament,

      session,

      teams,

      availablePlayers,

      progress: {
        completedPicks:
          session?.picks.length ?? 0,

        totalPicks,

        remainingPicks:
          totalPicks -
          (session?.picks.length ?? 0),
      },
    };
  }

  // ============================================================
  // ADMIN: START DRAFT
  // ============================================================

  async start(tournamentId: number) {
    return this.prisma.$transaction(
      async (tx) => {
        const tournament =
          await tx.tournament.findUnique({
            where: {
              id: tournamentId,
            },
          });

        if (!tournament) {
          throw new NotFoundException(
            'Tournament not found',
          );
        }

        if (
          tournament.status !==
          TournamentStatus.DRAFTING
        ) {
          throw new BadRequestException(
            'Tournament must be in DRAFTING stage',
          );
        }

        const teams =
          await tx.tournamentTeam.findMany({
            where: {
              tournamentId,
            },

            orderBy: {
              draftOrder: 'asc',
            },

            include: {
              captainParticipant: true,
              members: true,
            },
          });

        if (
          teams.length !==
          tournament.teamCount
        ) {
          throw new BadRequestException(
            `Exactly ${tournament.teamCount} teams are required`,
          );
        }

        for (const team of teams) {
          if (
            !team.captainParticipant ||
            team.draftOrder === null
          ) {
            throw new BadRequestException(
              'Every team must have a captain and draft order',
            );
          }

          if (team.members.length !== 1) {
            throw new BadRequestException(
              'Every team must contain only its captain before the draft starts',
            );
          }
        }

        const existing =
          await tx.draftSession.findFirst({
            where: {
              tournamentId,
            },

            orderBy: {
              id: 'desc',
            },
          });

        if (existing) {
          throw new ConflictException(
            'Draft session already exists',
          );
        }

        const participantCount =
          await tx.tournamentParticipant.count({
            where: {
              tournamentId,
              status:
                ParticipantStatus.ACTIVE,
            },
          });

        const requiredPlayers =
          tournament.teamCount *
          tournament.playersPerTeam;

        if (
          participantCount !== requiredPlayers
        ) {
          throw new BadRequestException(
            `Exactly ${requiredPlayers} active participants are required`,
          );
        }

        const firstTeam = teams[0];

        if (!firstTeam) {
          throw new BadRequestException(
            'No draft teams found',
          );
        }

        return tx.draftSession.create({
          data: {
            tournamentId,

            status:
              DraftStatus.ACTIVE,

            currentRound: 1,
            currentPick: 1,

            currentTeamId:
              firstTeam.id,

            startedAt:
              new Date(),
          },
        });
      },

      {
        isolationLevel:
          Prisma.TransactionIsolationLevel
            .Serializable,
      },
    );
  }

  // ============================================================
  // CAPTAIN: PICK PLAYER
  // ============================================================

  async pick(
    tournamentId: number,
    participantId: number,
    userId: number,
  ) {
    for (
      let attempt = 1;
      attempt <= 3;
      attempt++
    ) {
      try {
        const result =
          await this.prisma.$transaction(
            async (tx) => {
              const tournament =
                await tx.tournament.findUnique({
                  where: {
                    id: tournamentId,
                  },
                });

              if (!tournament) {
                throw new NotFoundException(
                  'Tournament not found',
                );
              }

              const session =
                await tx.draftSession.findFirst({
                  where: {
                    tournamentId,
                    status:
                      DraftStatus.ACTIVE,
                  },

                  orderBy: {
                    id: 'desc',
                  },
                });

              if (!session) {
                throw new BadRequestException(
                  'No active draft session',
                );
              }

              if (!session.currentTeamId) {
                throw new BadRequestException(
                  'Draft has no current team',
                );
              }

              const teams =
                await tx.tournamentTeam.findMany({
                  where: {
                    tournamentId,
                  },

                  orderBy: {
                    draftOrder: 'asc',
                  },
                });

              const currentTeam =
                await tx.tournamentTeam.findUnique({
                  where: {
                    id:
                      session.currentTeamId,
                  },

                  include: {
                    captainParticipant: {
                      include: {
                        player: true,
                      },
                    },

                    members: true,
                  },
                });

              if (
                !currentTeam ||
                currentTeam.tournamentId !==
                  tournamentId
              ) {
                throw new BadRequestException(
                  'Invalid current draft team',
                );
              }

              if (
                !currentTeam
                  .captainParticipant
              ) {
                throw new BadRequestException(
                  'Current team has no captain',
                );
              }

              // 当前登录用户必须正好是
              // 当前轮到的 Captain
              if (
                currentTeam
                  .captainParticipant
                  .player.userId !==
                userId
              ) {
                throw new ForbiddenException(
                  'It is not your turn to pick',
                );
              }

              if (
                currentTeam.members.length >=
                tournament.playersPerTeam
              ) {
                throw new ConflictException(
                  'Current team is already full',
                );
              }

              const target =
                await tx.tournamentParticipant.findFirst({
                  where: {
                    id:
                      participantId,

                    tournamentId,

                    status:
                      ParticipantStatus.ACTIVE,
                  },

                  include: {
                    teamMembership: true,
                  },
                });

              if (!target) {
                throw new NotFoundException(
                  'Participant not found',
                );
              }

              if (target.teamMembership) {
                throw new ConflictException(
                  'Player has already been selected',
                );
              }

              const totalPicks =
                tournament.teamCount *
                (
                  tournament.playersPerTeam -
                  1
                );

              const currentPickNumber =
                session.currentPick;

              const createdPick =
                await tx.draftPick.create({
                  data: {
                    draftSessionId:
                      session.id,

                    round:
                      session.currentRound,

                    pickNumber:
                      currentPickNumber,

                    teamId:
                      currentTeam.id,

                    participantId:
                      target.id,

                    pickedByUserId:
                      userId,
                  },
                });

              await tx.teamMember.create({
                data: {
                  teamId:
                    currentTeam.id,

                  participantId:
                    target.id,
                },
              });

              // 最后一手
              if (
                currentPickNumber >=
                totalPicks
              ) {
                await tx.draftSession.update({
                  where: {
                    id:
                      session.id,
                  },

                  data: {
                    status:
                      DraftStatus.COMPLETED,

                    completedAt:
                      new Date(),

                    currentTeamId:
                      null,
                  },
                });

                await tx.tournament.update({
                  where: {
                    id:
                      tournamentId,
                  },

                  data: {
                    status:
                      TournamentStatus
                        .ROSTER_LOCKED,
                  },
                });

                return {
                  completed: true,
                  pick:
                    createdPick,
                };
              }

              // ----------------------------------------------
              // Snake Draft 计算下一支队
              // ----------------------------------------------

              const nextPickNumber =
                currentPickNumber + 1;

              const zeroBased =
                nextPickNumber - 1;

              const roundIndex =
                Math.floor(
                  zeroBased /
                    tournament.teamCount,
                );

              const positionInRound =
                zeroBased %
                tournament.teamCount;

              const nextTeamIndex =
                roundIndex % 2 === 0
                  ? positionInRound
                  : tournament.teamCount -
                    1 -
                    positionInRound;

              const nextTeam =
                teams[nextTeamIndex];

              if (!nextTeam) {
                throw new BadRequestException(
                  'Unable to calculate next draft team',
                );
              }

              await tx.draftSession.update({
                where: {
                  id:
                    session.id,
                },

                data: {
                  currentPick:
                    nextPickNumber,

                  currentRound:
                    roundIndex + 1,

                  currentTeamId:
                    nextTeam.id,
                },
              });

              return {
                completed: false,
                pick:
                  createdPick,

                nextPick:
                  nextPickNumber,

                nextRound:
                  roundIndex + 1,

                nextTeamId:
                  nextTeam.id,
              };
            },

            {
              isolationLevel:
                Prisma.TransactionIsolationLevel
                  .Serializable,

              timeout: 10000,
            },
          );

        return {
          ...result,
          state:
            await this.getState(
              tournamentId,
            ),
        };
      } catch (error) {
        if (
          this.isTransactionConflict(
            error,
          ) &&
          attempt < 3
        ) {
          continue;
        }

        if (
          this.isUniqueConflict(error)
        ) {
          throw new ConflictException(
            'This player has already been selected',
          );
        }

        throw error;
      }
    }

    throw new ConflictException(
      'Draft conflict, please try again',
    );
  }

  private isTransactionConflict(
    error: unknown,
  ) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string })
        .code === 'P2034'
    );
  }

  private isUniqueConflict(
    error: unknown,
  ) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string })
        .code === 'P2002'
    );
  }
}