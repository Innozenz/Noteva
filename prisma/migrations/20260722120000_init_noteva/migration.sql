-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'TEACHER', 'ADMIN');

-- CreateEnum
CREATE TYPE "InstrumentFamily" AS ENUM ('VOICE', 'KEYBOARD', 'STRINGS', 'WINDS', 'BRASS', 'PERCUSSION', 'ELECTRONIC', 'THEORY');

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "VoiceType" AS ENUM ('SOPRANO', 'MEZZO_SOPRANO', 'ALTO', 'COUNTERTENOR', 'TENOR', 'BARITONE', 'BASS', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ExceptionType" AS ENUM ('BLOCKED', 'EXTRA');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW', 'DECLINED');

-- CreateEnum
CREATE TYPE "LessonMode" AS ENUM ('ONLINE', 'TEACHER_PLACE', 'STUDENT_PLACE');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" "Role",
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris',

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instrument" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" "InstrumentFamily" NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "instrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "ProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "headline" TEXT,
    "bio" TEXT,
    "videoUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "teachesOnline" BOOLEAN NOT NULL DEFAULT true,
    "teachesInPerson" BOOLEAN NOT NULL DEFAULT false,
    "teachesAtHome" BOOLEAN NOT NULL DEFAULT false,
    "city" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'FR',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "travelRadiusKm" INTEGER,
    "languages" TEXT[] DEFAULT ARRAY['fr']::TEXT[],
    "hourlyRateCents" INTEGER,
    "trialLessonOffered" BOOLEAN NOT NULL DEFAULT false,
    "trialLessonMinutes" INTEGER,
    "defaultDurationMin" INTEGER NOT NULL DEFAULT 60,
    "bufferMin" INTEGER NOT NULL DEFAULT 0,
    "minNoticeHours" INTEGER NOT NULL DEFAULT 24,
    "bookingHorizonDays" INTEGER NOT NULL DEFAULT 60,
    "cancellationWindowHours" INTEGER NOT NULL DEFAULT 24,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "stripeCurrentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_instrument" (
    "teacherId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "yearsExperience" INTEGER,
    "levelsTaught" "SkillLevel"[] DEFAULT ARRAY[]::"SkillLevel"[],

    CONSTRAINT "teacher_instrument_pkey" PRIMARY KEY ("teacherId","instrumentId")
);

-- CreateTable
CREATE TABLE "student_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "birthDate" DATE,
    "guardianName" TEXT,
    "guardianEmail" TEXT,
    "guardianPhone" TEXT,
    "goals" TEXT,
    "musicalBackground" TEXT,
    "readsSheetMusic" BOOLEAN NOT NULL DEFAULT false,
    "preferredGenres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "voiceType" "VoiceType",
    "prefersOnline" BOOLEAN NOT NULL DEFAULT true,
    "city" TEXT,
    "postalCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_instrument" (
    "studentId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "level" "SkillLevel" NOT NULL DEFAULT 'BEGINNER',
    "yearsPracticed" INTEGER,
    "ownsInstrument" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "student_instrument_pkey" PRIMARY KEY ("studentId","instrumentId")
);

-- CreateTable
CREATE TABLE "availability_rule" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "validFrom" DATE,
    "validUntil" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_exception" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "ExceptionType" NOT NULL,
    "startMinute" INTEGER,
    "endMinute" INTEGER,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_exception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "mode" "LessonMode" NOT NULL DEFAULT 'ONLINE',
    "isTrial" BOOLEAN NOT NULL DEFAULT false,
    "priceCents" INTEGER,
    "studentMessage" TEXT,
    "teacherNote" TEXT,
    "meetingUrl" TEXT,
    "address" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancellationReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "teacherRepl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "instrument_slug_key" ON "instrument"("slug");

-- CreateIndex
CREATE INDEX "instrument_family_idx" ON "instrument"("family");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_profile_userId_key" ON "teacher_profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_profile_slug_key" ON "teacher_profile"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_profile_stripeCustomerId_key" ON "teacher_profile"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_profile_stripeSubscriptionId_key" ON "teacher_profile"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "teacher_profile_status_city_idx" ON "teacher_profile"("status", "city");

-- CreateIndex
CREATE INDEX "teacher_profile_status_teachesOnline_idx" ON "teacher_profile"("status", "teachesOnline");

-- CreateIndex
CREATE INDEX "teacher_instrument_instrumentId_idx" ON "teacher_instrument"("instrumentId");

-- CreateIndex
CREATE UNIQUE INDEX "student_profile_userId_key" ON "student_profile"("userId");

-- CreateIndex
CREATE INDEX "student_instrument_instrumentId_idx" ON "student_instrument"("instrumentId");

-- CreateIndex
CREATE INDEX "availability_rule_teacherId_weekday_idx" ON "availability_rule"("teacherId", "weekday");

-- CreateIndex
CREATE INDEX "availability_exception_teacherId_date_idx" ON "availability_exception"("teacherId", "date");

-- CreateIndex
CREATE INDEX "booking_teacherId_startsAt_idx" ON "booking"("teacherId", "startsAt");

-- CreateIndex
CREATE INDEX "booking_studentId_startsAt_idx" ON "booking"("studentId", "startsAt");

-- CreateIndex
CREATE INDEX "booking_status_startsAt_idx" ON "booking"("status", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "review_bookingId_key" ON "review"("bookingId");

-- CreateIndex
CREATE INDEX "review_teacherId_publishedAt_idx" ON "review"("teacherId", "publishedAt");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_profile" ADD CONSTRAINT "teacher_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_instrument" ADD CONSTRAINT "teacher_instrument_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_instrument" ADD CONSTRAINT "teacher_instrument_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profile" ADD CONSTRAINT "student_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_instrument" ADD CONSTRAINT "student_instrument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_instrument" ADD CONSTRAINT "student_instrument_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_rule" ADD CONSTRAINT "availability_rule_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_exception" ADD CONSTRAINT "availability_exception_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Garanties d'intégrité non exprimables dans schema.prisma.
-- Tout ce qui suit est écrit à la main : `prisma migrate diff` ne le régénère
-- pas. En cas de refonte du schéma, penser à le reporter.
-- ---------------------------------------------------------------------------

-- Nécessaire pour combiner un opérateur d'égalité (=) sur une colonne texte et
-- un opérateur de recouvrement (&&) sur un range dans le même index GiST.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Un cours ne peut pas se terminer avant d'avoir commencé.
ALTER TABLE "booking"
  ADD CONSTRAINT "booking_time_order" CHECK ("endsAt" > "startsAt");

-- Anti-double-réservation côté PROF. La garantie doit être en base : un check
-- applicatif « le créneau est-il libre ? » suivi d'un INSERT laisse une fenêtre
-- de concurrence où deux élèves réservent le même horaire.
-- Les demandes en attente bloquent le créneau, sinon un prof reçoit plusieurs
-- demandes concurrentes sur le même horaire.
ALTER TABLE "booking"
  ADD CONSTRAINT "booking_teacher_no_overlap"
  EXCLUDE USING gist (
    "teacherId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("status" IN ('PENDING', 'CONFIRMED'));

-- Anti-double-réservation côté ÉLÈVE, restreint aux cours confirmés : un élève
-- peut légitimement avoir plusieurs demandes en attente sur le même créneau
-- auprès de profs différents, mais ne peut pas être à deux cours à la fois.
ALTER TABLE "booking"
  ADD CONSTRAINT "booking_student_no_overlap"
  EXCLUDE USING gist (
    "studentId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("status" = 'CONFIRMED');

-- Les minutes sont exprimées depuis minuit dans le fuseau du prof.
ALTER TABLE "availability_rule"
  ADD CONSTRAINT "availability_rule_weekday_range" CHECK ("weekday" BETWEEN 1 AND 7),
  ADD CONSTRAINT "availability_rule_minute_range"
    CHECK ("startMinute" >= 0 AND "endMinute" <= 1440 AND "startMinute" < "endMinute");

-- start/endMinute nuls = journée entière ; sinon les deux sont requis.
ALTER TABLE "availability_exception"
  ADD CONSTRAINT "availability_exception_minute_range"
    CHECK (
      ("startMinute" IS NULL AND "endMinute" IS NULL)
      OR (
        "startMinute" IS NOT NULL AND "endMinute" IS NOT NULL
        AND "startMinute" >= 0 AND "endMinute" <= 1440
        AND "startMinute" < "endMinute"
      )
    );

-- Une dispo exceptionnelle doit porter des horaires : bloquer une journée
-- entière a du sens, l'ouvrir « en entier » sans bornes n'en a pas.
ALTER TABLE "availability_exception"
  ADD CONSTRAINT "availability_exception_extra_needs_range"
    CHECK ("type" <> 'EXTRA' OR "startMinute" IS NOT NULL);

ALTER TABLE "review"
  ADD CONSTRAINT "review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);

-- Recherche par instrument : accélère le filtre sur les alias.
CREATE INDEX "instrument_aliases_idx" ON "instrument" USING gin ("aliases");
