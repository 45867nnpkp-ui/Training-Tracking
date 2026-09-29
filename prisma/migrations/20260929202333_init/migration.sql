-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('UPPER', 'LOWER');

-- CreateEnum
CREATE TYPE "PlannedSource" AS ENUM ('STANDARD', 'HOLIDAY', 'RESCHEDULED', 'MANUAL');

-- CreateEnum
CREATE TYPE "PlannedStatus" AS ENUM ('PLANNED', 'MOVED', 'CANCELLED', 'DONE');

-- CreateEnum
CREATE TYPE "Phase" AS ENUM ('DIET', 'BULK');

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "SessionType" NOT NULL,
    "isCompound" BOOLEAN NOT NULL DEFAULT false,
    "sets" INTEGER NOT NULL,
    "repMin" INTEGER NOT NULL,
    "repMax" INTEGER NOT NULL,
    "restMinSec" INTEGER NOT NULL,
    "restMaxSec" INTEGER NOT NULL,
    "incrementKg" DOUBLE PRECISION NOT NULL,
    "startWeightKg" DOUBLE PRECISION,
    "setupNote" TEXT NOT NULL DEFAULT '',
    "hint" TEXT NOT NULL DEFAULT '',
    "isBonus" BOOLEAN NOT NULL DEFAULT false,
    "mainExerciseId" TEXT,
    "alternativePriority" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionTemplate" (
    "type" "SessionType" NOT NULL,
    "exerciseIds" TEXT[],

    CONSTRAINT "SessionTemplate_pkey" PRIMARY KEY ("type")
);

-- CreateTable
CREATE TABLE "PlannedSession" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "SessionType" NOT NULL,
    "slotStart" TIMESTAMP(3) NOT NULL,
    "slotEnd" TIMESTAMP(3) NOT NULL,
    "hardEnd" TIMESTAMP(3),
    "source" "PlannedSource" NOT NULL DEFAULT 'STANDARD',
    "status" "PlannedStatus" NOT NULL DEFAULT 'PLANNED',
    "originalDate" DATE,

    CONSTRAINT "PlannedSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workout" (
    "id" TEXT NOT NULL,
    "plannedSessionId" TEXT,
    "type" "SessionType" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "isDeload" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetLog" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "reps" INTEGER NOT NULL,
    "rir" INTEGER,
    "failure" BOOLEAN NOT NULL DEFAULT false,
    "isWarmup" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SetLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BodyMetric" (
    "date" DATE NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "waistCm" DOUBLE PRECISION,

    CONSTRAINT "BodyMetric_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "ScheduleConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "timetableA" JSONB,
    "timetableB" JSONB,
    "abOverrides" JSONB,
    "saturdayWorkUntil" TEXT NOT NULL DEFAULT '18:00',
    "travelMin" INTEGER NOT NULL DEFAULT 15,
    "gymOpen" TEXT NOT NULL DEFAULT '06:00',
    "gymClose" TEXT NOT NULL DEFAULT '22:00',
    "deloadIntervalWeeks" INTEGER NOT NULL DEFAULT 7,
    "planStartDate" DATE,
    "phase" "Phase" NOT NULL DEFAULT 'DIET',
    "examPhaseUntil" DATE,

    CONSTRAINT "ScheduleConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarCache" (
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "events" JSONB NOT NULL,
    "error" TEXT,

    CONSTRAINT "CalendarCache_pkey" PRIMARY KEY ("source")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlannedSession_date_idx" ON "PlannedSession"("date");

-- CreateIndex
CREATE INDEX "Workout_startedAt_idx" ON "Workout"("startedAt");

-- CreateIndex
CREATE INDEX "SetLog_exerciseId_idx" ON "SetLog"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "SetLog_workoutId_exerciseId_isWarmup_setNumber_key" ON "SetLog"("workoutId", "exerciseId", "isWarmup", "setNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_mainExerciseId_fkey" FOREIGN KEY ("mainExerciseId") REFERENCES "Exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_plannedSessionId_fkey" FOREIGN KEY ("plannedSessionId") REFERENCES "PlannedSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetLog" ADD CONSTRAINT "SetLog_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetLog" ADD CONSTRAINT "SetLog_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
