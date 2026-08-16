-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ScanStage" AS ENUM ('UPLOADED', 'EXTRACTING', 'PREPROCESSING', 'ANALYZING', 'EVALUATING_RULES', 'SCORING', 'REPORTING', 'DONE');

-- CreateEnum
CREATE TYPE "RuleStatus" AS ENUM ('PASS', 'PARTIAL', 'FAIL', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "WeightClass" AS ENUM ('MANDATORY', 'CONDITIONAL', 'RECOMMENDED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('ACT', 'RULES_2025', 'PROJECT_SPECIFIC', 'BEST_PRACTICE');

-- CreateEnum
CREATE TYPE "Applicability" AS ENUM ('ALWAYS', 'CONDITIONAL', 'REQUIRES_LIVE_SCAN');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('PDF', 'JSON');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'QUEUED',
    "stage" "ScanStage" NOT NULL DEFAULT 'UPLOADED',
    "error" TEXT,
    "extractedText" TEXT,
    "pages" INTEGER,
    "words" INTEGER,
    "sentences" INTEGER,
    "paragraphs" INTEGER,
    "extractionRate" DOUBLE PRECISION,
    "nlpAvailable" BOOLEAN NOT NULL DEFAULT false,
    "ruleVersion" TEXT,
    "durationMs" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rules" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "categoryLabel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "legalBasis" TEXT,
    "actSection" TEXT,
    "ruleReference" TEXT,
    "scheduleReference" TEXT,
    "sourceUrl" TEXT,
    "ruleVersion" TEXT NOT NULL,
    "legalVersion" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "effectiveNote" TEXT,
    "weightClass" "WeightClass" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "severity" "Severity" NOT NULL,
    "applicability" "Applicability" NOT NULL,
    "detection" JSONB NOT NULL,
    "recommendation" TEXT NOT NULL,
    "remediation" TEXT NOT NULL,
    "suggestedLanguage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "findings" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "status" "RuleStatus" NOT NULL,
    "applicable" BOOLEAN NOT NULL DEFAULT true,
    "applicabilityReason" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "matchedSpecifics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "missingSpecifics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "negationDetected" BOOLEAN NOT NULL DEFAULT false,
    "hedgingDetected" BOOLEAN NOT NULL DEFAULT false,
    "semanticSupport" BOOLEAN NOT NULL DEFAULT false,
    "reasoning" TEXT NOT NULL,
    "recommendation" TEXT,
    "remediation" TEXT,
    "legalReference" TEXT,
    "severity" "Severity" NOT NULL,
    "priority" "Priority",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_scores" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "verdict" TEXT NOT NULL,
    "scoringModel" TEXT NOT NULL DEFAULT 'design-doc-1.0',
    "earnedPoints" DOUBLE PRECISION NOT NULL,
    "maxPoints" DOUBLE PRECISION NOT NULL,
    "passedCount" INTEGER NOT NULL DEFAULT 0,
    "partialCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "notApplicableCount" INTEGER NOT NULL DEFAULT 0,
    "categoryScores" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_assessments" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "level" "RiskLevel" NOT NULL,
    "explanation" TEXT NOT NULL,
    "factors" JSONB NOT NULL DEFAULT '[]',
    "criticalFindings" INTEGER NOT NULL DEFAULT 0,
    "highFindings" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "reportType" "ReportType" NOT NULL,
    "filePath" TEXT,
    "fileSize" INTEGER,
    "checksum" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "scans_userId_createdAt_idx" ON "scans"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "rules_ruleId_key" ON "rules"("ruleId");

-- CreateIndex
CREATE INDEX "rules_category_idx" ON "rules"("category");

-- CreateIndex
CREATE INDEX "findings_scanId_status_idx" ON "findings"("scanId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "findings_scanId_ruleId_key" ON "findings"("scanId", "ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "scan_scores_scanId_key" ON "scan_scores"("scanId");

-- CreateIndex
CREATE UNIQUE INDEX "risk_assessments_scanId_key" ON "risk_assessments"("scanId");

-- CreateIndex
CREATE INDEX "reports_scanId_reportType_idx" ON "reports"("scanId", "reportType");

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "rules"("ruleId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_scores" ADD CONSTRAINT "scan_scores_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
