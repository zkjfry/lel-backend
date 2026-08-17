-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLAYER', 'REFEREE', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');

-- CreateEnum
CREATE TYPE "PlayerRole" AS ENUM ('TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT');

-- CreateEnum
CREATE TYPE "RankTier" AS ENUM ('IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'CHECK_IN', 'DRAFTING', 'ROSTER_LOCKED', 'SCHEDULED', 'LIVE', 'COMPLETED', 'ARCHIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TournamentFormat" AS ENUM ('SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN');

-- CreateEnum
CREATE TYPE "MatchFormat" AS ENUM ('BO1', 'BO3', 'BO5');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('REGISTERED', 'WAITLIST', 'WITHDRAWN', 'REMOVED');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('PLAYER', 'CAPTAIN');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('ACTIVE', 'WITHDRAWN', 'REMOVED', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('WAITING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PointEventType" AS ENUM ('GAME_WIN', 'GAME_LOSS', 'MVP', 'SVP', 'CHAMPION', 'RUNNER_UP', 'THIRD_PLACE', 'MANUAL_ADJUSTMENT');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(40) NOT NULL,
    "email" VARCHAR(255),
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "avatar_url" TEXT,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_profiles" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "display_name" VARCHAR(60) NOT NULL,
    "riot_game_name" VARCHAR(100),
    "riot_tag_line" VARCHAR(20),
    "riot_region" VARCHAR(20),
    "rank_tier" "RankTier",
    "rank_division" VARCHAR(10),
    "main_role" "PlayerRole",
    "secondary_role" "PlayerRole",
    "yy_name" VARCHAR(100),
    "bio" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "player_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
    "registration_start" TIMESTAMPTZ(3),
    "registration_end" TIMESTAMPTZ(3),
    "checkin_start" TIMESTAMPTZ(3),
    "checkin_end" TIMESTAMPTZ(3),
    "start_time" TIMESTAMPTZ(3),
    "max_players" INTEGER NOT NULL DEFAULT 20,
    "max_waitlist" INTEGER NOT NULL DEFAULT 5,
    "team_count" INTEGER NOT NULL DEFAULT 4,
    "players_per_team" INTEGER NOT NULL DEFAULT 5,
    "match_format" "MatchFormat" NOT NULL DEFAULT 'BO3',
    "tournament_format" "TournamentFormat" NOT NULL DEFAULT 'SINGLE_ELIMINATION',
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_registrations" (
    "id" SERIAL NOT NULL,
    "tournament_id" INTEGER NOT NULL,
    "player_id" INTEGER NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'REGISTERED',
    "primary_role" "PlayerRole",
    "secondary_role" "PlayerRole",
    "checked_in" BOOLEAN NOT NULL DEFAULT false,
    "waitlist_position" INTEGER,
    "notes" TEXT,
    "registered_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checked_in_at" TIMESTAMPTZ(3),

    CONSTRAINT "tournament_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_participants" (
    "id" SERIAL NOT NULL,
    "tournament_id" INTEGER NOT NULL,
    "player_id" INTEGER NOT NULL,
    "role" "ParticipantRole" NOT NULL DEFAULT 'PLAYER',
    "status" "ParticipantStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tournament_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_templates" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "short_name" VARCHAR(20) NOT NULL,
    "logo_url" TEXT,
    "region" VARCHAR(50),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "team_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_teams" (
    "id" SERIAL NOT NULL,
    "tournament_id" INTEGER NOT NULL,
    "team_template_id" INTEGER,
    "name" VARCHAR(100) NOT NULL,
    "short_name" VARCHAR(20),
    "logo_url" TEXT,
    "seed" INTEGER,
    "draft_order" INTEGER,
    "captain_participant_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tournament_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" SERIAL NOT NULL,
    "team_id" INTEGER NOT NULL,
    "participant_id" INTEGER NOT NULL,
    "position" "PlayerRole",
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_sessions" (
    "id" SERIAL NOT NULL,
    "tournament_id" INTEGER NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'WAITING',
    "current_round" INTEGER NOT NULL DEFAULT 1,
    "current_pick" INTEGER NOT NULL DEFAULT 1,
    "current_team_id" INTEGER,
    "pick_deadline_at" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "draft_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_picks" (
    "id" SERIAL NOT NULL,
    "draft_session_id" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "pick_number" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "participant_id" INTEGER NOT NULL,
    "picked_by_user_id" INTEGER,
    "picked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "draft_picks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" SERIAL NOT NULL,
    "tournament_id" INTEGER NOT NULL,
    "round_number" INTEGER NOT NULL,
    "match_number" INTEGER NOT NULL,
    "label" VARCHAR(100),
    "team_a_id" INTEGER,
    "team_b_id" INTEGER,
    "winner_team_id" INTEGER,
    "format" "MatchFormat" NOT NULL DEFAULT 'BO3',
    "team_a_score" INTEGER NOT NULL DEFAULT 0,
    "team_b_score" INTEGER NOT NULL DEFAULT 0,
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduled_at" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" SERIAL NOT NULL,
    "match_id" INTEGER NOT NULL,
    "game_number" INTEGER NOT NULL,
    "winner_team_id" INTEGER,
    "mvp_participant_id" INTEGER,
    "svp_participant_id" INTEGER,
    "result_image_url" TEXT,
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_results" (
    "id" SERIAL NOT NULL,
    "tournament_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "placement" INTEGER NOT NULL,
    "is_champion" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_stats" (
    "player_id" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "tournaments_played" INTEGER NOT NULL DEFAULT 0,
    "series_played" INTEGER NOT NULL DEFAULT 0,
    "games_played" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "championships" INTEGER NOT NULL DEFAULT 0,
    "mvp_count" INTEGER NOT NULL DEFAULT 0,
    "svp_count" INTEGER NOT NULL DEFAULT 0,
    "current_win_streak" INTEGER NOT NULL DEFAULT 0,
    "best_win_streak" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "player_stats_pkey" PRIMARY KEY ("player_id")
);

-- CreateTable
CREATE TABLE "player_role_ratings" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "role" "PlayerRole" NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "games_played" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "player_role_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_transactions" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "tournament_id" INTEGER,
    "game_id" INTEGER,
    "type" "PointEventType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" TEXT,
    "created_by_user_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_rules" (
    "id" SERIAL NOT NULL,
    "type" "PointEventType" NOT NULL,
    "points" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "scoring_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(100),
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "player_profiles_user_id_key" ON "player_profiles"("user_id");

-- CreateIndex
CREATE INDEX "player_profiles_display_name_idx" ON "player_profiles"("display_name");

-- CreateIndex
CREATE INDEX "player_profiles_rank_tier_idx" ON "player_profiles"("rank_tier");

-- CreateIndex
CREATE INDEX "player_profiles_main_role_idx" ON "player_profiles"("main_role");

-- CreateIndex
CREATE UNIQUE INDEX "tournaments_slug_key" ON "tournaments"("slug");

-- CreateIndex
CREATE INDEX "tournaments_status_idx" ON "tournaments"("status");

-- CreateIndex
CREATE INDEX "tournaments_start_time_idx" ON "tournaments"("start_time");

-- CreateIndex
CREATE INDEX "tournaments_created_at_idx" ON "tournaments"("created_at");

-- CreateIndex
CREATE INDEX "tournament_registrations_tournament_id_status_idx" ON "tournament_registrations"("tournament_id", "status");

-- CreateIndex
CREATE INDEX "tournament_registrations_player_id_idx" ON "tournament_registrations"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_registrations_tournament_id_player_id_key" ON "tournament_registrations"("tournament_id", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_registrations_tournament_id_waitlist_position_key" ON "tournament_registrations"("tournament_id", "waitlist_position");

-- CreateIndex
CREATE INDEX "tournament_participants_tournament_id_status_idx" ON "tournament_participants"("tournament_id", "status");

-- CreateIndex
CREATE INDEX "tournament_participants_player_id_idx" ON "tournament_participants"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_participants_tournament_id_player_id_key" ON "tournament_participants"("tournament_id", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_templates_short_name_key" ON "team_templates"("short_name");

-- CreateIndex
CREATE INDEX "team_templates_enabled_idx" ON "team_templates"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_teams_captain_participant_id_key" ON "tournament_teams"("captain_participant_id");

-- CreateIndex
CREATE INDEX "tournament_teams_tournament_id_idx" ON "tournament_teams"("tournament_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_teams_tournament_id_name_key" ON "tournament_teams"("tournament_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_teams_tournament_id_draft_order_key" ON "tournament_teams"("tournament_id", "draft_order");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_participant_id_key" ON "team_members"("participant_id");

-- CreateIndex
CREATE INDEX "team_members_team_id_idx" ON "team_members"("team_id");

-- CreateIndex
CREATE INDEX "draft_sessions_tournament_id_status_idx" ON "draft_sessions"("tournament_id", "status");

-- CreateIndex
CREATE INDEX "draft_picks_team_id_idx" ON "draft_picks"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "draft_picks_draft_session_id_pick_number_key" ON "draft_picks"("draft_session_id", "pick_number");

-- CreateIndex
CREATE UNIQUE INDEX "draft_picks_draft_session_id_participant_id_key" ON "draft_picks"("draft_session_id", "participant_id");

-- CreateIndex
CREATE INDEX "matches_tournament_id_status_idx" ON "matches"("tournament_id", "status");

-- CreateIndex
CREATE INDEX "matches_scheduled_at_idx" ON "matches"("scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "matches_tournament_id_round_number_match_number_key" ON "matches"("tournament_id", "round_number", "match_number");

-- CreateIndex
CREATE INDEX "games_winner_team_id_idx" ON "games"("winner_team_id");

-- CreateIndex
CREATE UNIQUE INDEX "games_match_id_game_number_key" ON "games"("match_id", "game_number");

-- CreateIndex
CREATE INDEX "tournament_results_tournament_id_placement_idx" ON "tournament_results"("tournament_id", "placement");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_results_tournament_id_team_id_key" ON "tournament_results"("tournament_id", "team_id");

-- CreateIndex
CREATE INDEX "player_stats_points_idx" ON "player_stats"("points");

-- CreateIndex
CREATE INDEX "player_stats_championships_idx" ON "player_stats"("championships");

-- CreateIndex
CREATE INDEX "player_stats_mvp_count_idx" ON "player_stats"("mvp_count");

-- CreateIndex
CREATE INDEX "player_stats_wins_idx" ON "player_stats"("wins");

-- CreateIndex
CREATE INDEX "player_role_ratings_role_rating_idx" ON "player_role_ratings"("role", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "player_role_ratings_player_id_role_key" ON "player_role_ratings"("player_id", "role");

-- CreateIndex
CREATE INDEX "point_transactions_player_id_created_at_idx" ON "point_transactions"("player_id", "created_at");

-- CreateIndex
CREATE INDEX "point_transactions_tournament_id_idx" ON "point_transactions"("tournament_id");

-- CreateIndex
CREATE INDEX "point_transactions_type_idx" ON "point_transactions"("type");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_rules_type_key" ON "scoring_rules"("type");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_team_template_id_fkey" FOREIGN KEY ("team_template_id") REFERENCES "team_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_captain_participant_id_fkey" FOREIGN KEY ("captain_participant_id") REFERENCES "tournament_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "tournament_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "tournament_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_sessions" ADD CONSTRAINT "draft_sessions_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_sessions" ADD CONSTRAINT "draft_sessions_current_team_id_fkey" FOREIGN KEY ("current_team_id") REFERENCES "tournament_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_draft_session_id_fkey" FOREIGN KEY ("draft_session_id") REFERENCES "draft_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "tournament_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "tournament_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_picked_by_user_id_fkey" FOREIGN KEY ("picked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_a_id_fkey" FOREIGN KEY ("team_a_id") REFERENCES "tournament_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_b_id_fkey" FOREIGN KEY ("team_b_id") REFERENCES "tournament_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_team_id_fkey" FOREIGN KEY ("winner_team_id") REFERENCES "tournament_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_winner_team_id_fkey" FOREIGN KEY ("winner_team_id") REFERENCES "tournament_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_mvp_participant_id_fkey" FOREIGN KEY ("mvp_participant_id") REFERENCES "tournament_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_svp_participant_id_fkey" FOREIGN KEY ("svp_participant_id") REFERENCES "tournament_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_results" ADD CONSTRAINT "tournament_results_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_results" ADD CONSTRAINT "tournament_results_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "tournament_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_role_ratings" ADD CONSTRAINT "player_role_ratings_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
