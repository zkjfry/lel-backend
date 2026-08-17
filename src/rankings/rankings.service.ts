import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client';

import {
  PlayerRole,
} from '../generated/prisma/enums';

import { PrismaService } from '../prisma/prisma.service';

import {
  RankingQueryDto,
  RankingType,
} from './dto/ranking-query.dto';

@Injectable()
export class RankingsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // ============================================================
  // GLOBAL RANKINGS
  // ============================================================

  async getRanking(
    query: RankingQueryDto,
  ) {
    const page =
      query.page ?? 1;

    const pageSize =
      query.pageSize ?? 20;

    const type =
      query.type ??
      RankingType.POINTS;

    if (
      type === RankingType.WINRATE
    ) {
      return this.getWinRateRanking(
        page,
        pageSize,
      );
    }

    const skip =
      (page - 1) * pageSize;

    const orderBy =
      this.getStatsOrderBy(
        type,
      );

    const [total, stats] =
      await Promise.all([
        this.prisma.playerStats.count(),

        this.prisma.playerStats.findMany({
          skip,
          take: pageSize,

          orderBy,

          include: {
            player: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    avatarUrl: true,
                    status: true,
                  },
                },
              },
            },
          },
        }),
      ]);

    const items =
      stats.map(
        (stats, index) => ({
          rank:
            skip +
            index +
            1,

          playerId:
            stats.playerId,

          userId:
            stats.player.user.id,

          username:
            stats.player.user.username,

          displayName:
            stats.player.displayName,

          avatarUrl:
            stats.player.user.avatarUrl,

          mainRole:
            stats.player.mainRole,

          rankTier:
            stats.player.rankTier,

          rankDivision:
            stats.player.rankDivision,

          value:
            this.getRankingValue(
              stats,
              type,
            ),

          stats: {
            points:
              stats.points,

            tournamentsPlayed:
              stats.tournamentsPlayed,

            seriesPlayed:
              stats.seriesPlayed,

            gamesPlayed:
              stats.gamesPlayed,

            wins:
              stats.wins,

            losses:
              stats.losses,

            championships:
              stats.championships,

            mvpCount:
              stats.mvpCount,

            svpCount:
              stats.svpCount,

            winRate:
              this.calculateWinRate(
                stats.wins,
                stats.losses,
              ),
          },
        }),
      );

    return {
      type,

      page,

      pageSize,

      total,

      totalPages:
        Math.ceil(
          total / pageSize,
        ),

      items,
    };
  }

  // ============================================================
  // WIN RATE
  //
  // Win rate is calculated dynamically, so V1 sorts it in
  // application memory instead of storing duplicate values.
  // ============================================================

  private async getWinRateRanking(
    page: number,
    pageSize: number,
  ) {
    const stats =
      await this.prisma.playerStats.findMany({
        where: {
          gamesPlayed: {
            gt: 0,
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
                  status: true,
                },
              },
            },
          },
        },
      });

    const sorted =
      stats
        .map((stats) => ({
          stats,

          winRate:
            this.calculateWinRate(
              stats.wins,
              stats.losses,
            ),
        }))

        .sort((a, b) => {
          if (
            b.winRate !==
            a.winRate
          ) {
            return (
              b.winRate -
              a.winRate
            );
          }

          if (
            b.stats.gamesPlayed !==
            a.stats.gamesPlayed
          ) {
            return (
              b.stats.gamesPlayed -
              a.stats.gamesPlayed
            );
          }

          return (
            b.stats.wins -
            a.stats.wins
          );
        });

    const total =
      sorted.length;

    const skip =
      (page - 1) *
      pageSize;

    const pageItems =
      sorted.slice(
        skip,
        skip +
          pageSize,
      );

    return {
      type:
        RankingType.WINRATE,

      page,

      pageSize,

      total,

      totalPages:
        Math.ceil(
          total /
          pageSize,
        ),

      items:
        pageItems.map(
          (
            item,
            index,
          ) => ({
            rank:
              skip +
              index +
              1,

            playerId:
              item.stats.playerId,

            userId:
              item.stats.player.user.id,

            username:
              item.stats.player.user.username,

            displayName:
              item.stats.player.displayName,

            avatarUrl:
              item.stats.player.user.avatarUrl,

            mainRole:
              item.stats.player.mainRole,

            rankTier:
              item.stats.player.rankTier,

            rankDivision:
              item.stats.player.rankDivision,

            value:
              item.winRate,

            stats: {
              points:
                item.stats.points,

              tournamentsPlayed:
                item.stats.tournamentsPlayed,

              gamesPlayed:
                item.stats.gamesPlayed,

              wins:
                item.stats.wins,

              losses:
                item.stats.losses,

              championships:
                item.stats.championships,

              mvpCount:
                item.stats.mvpCount,

              svpCount:
                item.stats.svpCount,

              winRate:
                item.winRate,
            },
          }),
        ),
    };
  }

  // ============================================================
  // ROLE RANKINGS
  // ============================================================

  async getRoleRanking(
    role: PlayerRole,
    page: number,
    pageSize: number,
  ) {
    if (
      !Object.values(
        PlayerRole,
      ).includes(role)
    ) {
      throw new BadRequestException(
        'Invalid player role',
      );
    }

    const skip =
      (page - 1) *
      pageSize;

    const [total, ratings] =
      await Promise.all([
        this.prisma.playerRoleRating.count({
          where: {
            role,
          },
        }),

        this.prisma.playerRoleRating.findMany({
          where: {
            role,
          },

          skip,
          take: pageSize,

          orderBy: [
            {
              rating: 'desc',
            },
            {
              gamesPlayed:
                'desc',
            },
            {
              wins: 'desc',
            },
            {
              playerId:
                'asc',
            },
          ],

          include: {
            player: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    avatarUrl: true,
                    status: true,
                  },
                },

                stats: true,
              },
            },
          },
        }),
      ]);

    return {
      role,

      page,

      pageSize,

      total,

      totalPages:
        Math.ceil(
          total /
          pageSize,
        ),

      items:
        ratings.map(
          (
            rating,
            index,
          ) => ({
            rank:
              skip +
              index +
              1,

            playerId:
              rating.playerId,

            userId:
              rating.player.user.id,

            username:
              rating.player.user.username,

            displayName:
              rating.player.displayName,

            avatarUrl:
              rating.player.user.avatarUrl,

            rankTier:
              rating.player.rankTier,

            rankDivision:
              rating.player.rankDivision,

            role:
              rating.role,

            rating:
              rating.rating,

            gamesPlayed:
              rating.gamesPlayed,

            wins:
              rating.wins,

            losses:
              rating.losses,

            winRate:
              this.calculateWinRate(
                rating.wins,
                rating.losses,
              ),

            totalPoints:
              rating.player.stats?.points ??
              0,
          }),
        ),
    };
  }

  // ============================================================
  // HOME PAGE OVERVIEW
  // ============================================================

  async getOverview() {
    const [
      points,
      championships,
      mvp,
      wins,
    ] =
      await Promise.all([
        this.getTopPlayers(
          RankingType.POINTS,
          10,
        ),

        this.getTopPlayers(
          RankingType.CHAMPIONSHIPS,
          5,
        ),

        this.getTopPlayers(
          RankingType.MVP,
          5,
        ),

        this.getTopPlayers(
          RankingType.WINS,
          5,
        ),
      ]);

    return {
      points,
      championships,
      mvp,
      wins,
    };
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private async getTopPlayers(
    type: RankingType,
    take: number,
  ) {
    const stats =
      await this.prisma.playerStats.findMany({
        take,

        orderBy:
          this.getStatsOrderBy(
            type,
          ),

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
            },
          },
        },
      });

    return stats.map(
      (
        stats,
        index,
      ) => ({
        rank:
          index + 1,

        playerId:
          stats.playerId,

        username:
          stats.player.user.username,

        displayName:
          stats.player.displayName,

        avatarUrl:
          stats.player.user.avatarUrl,

        mainRole:
          stats.player.mainRole,

        value:
          this.getRankingValue(
            stats,
            type,
          ),
      }),
    );
  }

  private getStatsOrderBy(
    type: RankingType,
  ): Prisma.PlayerStatsOrderByWithRelationInput[] {
    switch (type) {
      case RankingType.POINTS:
        return [
          {
            points: 'desc',
          },
          {
            wins: 'desc',
          },
          {
            playerId: 'asc',
          },
        ];

      case RankingType.CHAMPIONSHIPS:
        return [
          {
            championships:
              'desc',
          },
          {
            points: 'desc',
          },
          {
            playerId: 'asc',
          },
        ];

      case RankingType.WINS:
        return [
          {
            wins: 'desc',
          },
          {
            points: 'desc',
          },
          {
            playerId: 'asc',
          },
        ];

      case RankingType.MVP:
        return [
          {
            mvpCount:
              'desc',
          },
          {
            points: 'desc',
          },
          {
            playerId: 'asc',
          },
        ];

      case RankingType.SVP:
        return [
          {
            svpCount:
              'desc',
          },
          {
            points: 'desc',
          },
          {
            playerId: 'asc',
          },
        ];

      default:
        return [
          {
            points: 'desc',
          },
        ];
    }
  }

  private getRankingValue(
    stats: {
      points: number;
      championships: number;
      wins: number;
      mvpCount: number;
      svpCount: number;
    },
    type: RankingType,
  ) {
    switch (type) {
      case RankingType.POINTS:
        return stats.points;

      case RankingType.CHAMPIONSHIPS:
        return stats.championships;

      case RankingType.WINS:
        return stats.wins;

      case RankingType.MVP:
        return stats.mvpCount;

      case RankingType.SVP:
        return stats.svpCount;

      default:
        return stats.points;
    }
  }

  private calculateWinRate(
    wins: number,
    losses: number,
  ) {
    const total =
      wins +
      losses;

    if (total === 0) {
      return 0;
    }

    return Number(
      (
        (
          wins /
          total
        ) *
        100
      ).toFixed(2),
    );
  }
}