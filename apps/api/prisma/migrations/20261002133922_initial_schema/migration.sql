-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('AGENT', 'BANCA', 'STAFF');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'LOCKED', 'DISABLED');

-- CreateEnum
CREATE TYPE "AuthSource" AS ENUM ('LOCAL', 'DIRECTORY');

-- CreateEnum
CREATE TYPE "Audience" AS ENUM ('PORTAL', 'BACKOFFICE');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('AGENCY', 'BANCA');

-- CreateEnum
CREATE TYPE "AgencyStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('MAIN_AGENT', 'SUB_AGENT', 'BANKER');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "IdType" AS ENUM ('NRIC', 'PASSPORT', 'BUSINESS_REG');

-- CreateEnum
CREATE TYPE "ParticipantType" AS ENUM ('INDIVIDUAL', 'CORPORATE');

-- CreateEnum
CREATE TYPE "AmlStatus" AS ENUM ('NOT_SCREENED', 'CLEAR', 'FLAGGED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AmlCaseStatus" AS ENUM ('AUTO_CLEARED', 'PENDING_REVIEW', 'CLEARED', 'CONFIRMED_MATCH');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'PENDING_PAYMENT', 'ACTIVE', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PolicyPaymentStatus" AS ENUM ('UNPAID', 'PENDING_VERIFICATION', 'PAID');

-- CreateEnum
CREATE TYPE "NomineeRole" AS ENUM ('NOMINEE', 'BENEFICIARY', 'EXECUTOR');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CHEQUE', 'CASH_DEPOSIT', 'ONLINE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'ACKNOWLEDGED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DocumentOwnerType" AS ENUM ('AGENT', 'AGENCY', 'PARTICIPANT', 'POLICY', 'PAYMENT', 'CLAIM', 'ISSUE', 'REPORT');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('AGENT_REGISTRATION', 'AGENT_PROFILE_UPDATE', 'AGENT_STATUS_CHANGE', 'PARTICIPANT_UPDATE', 'POLICY_REFERRAL', 'POLICY_ENDORSEMENT', 'POLICY_CANCELLATION', 'PAYMENT_VERIFICATION');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ApprovalActionType" AS ENUM ('SUBMIT', 'APPROVE', 'REJECT', 'WITHDRAW');

-- CreateEnum
CREATE TYPE "IssuePriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "IntegrationSystem" AS ENUM ('CORE', 'FINANCE', 'AML', 'EMAIL', 'SMS', 'DIRECTORY');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'DEAD');

-- CreateEnum
CREATE TYPE "IntegrationDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('MATCHED', 'MISMATCH');

-- CreateEnum
CREATE TYPE "ParameterType" AS ENUM ('STRING', 'INTEGER', 'DECIMAL', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "ReportFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('XLSX', 'CSV', 'PDF');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('ACCRUED', 'PAID');

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL,
    "username" VARCHAR(64) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "mobile" VARCHAR(20),
    "user_type" "UserType" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "auth_source" "AuthSource" NOT NULL DEFAULT 'LOCAL',
    "password_hash" TEXT,
    "password_changed_at" TIMESTAMP(3),
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "agent_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_history" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "audience" "Audience" NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "role_id" UUID NOT NULL,
    "permission" VARCHAR(80) NOT NULL,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("role_id","permission")
);

-- CreateTable
CREATE TABLE "user_role" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "user_role_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "user_session" (
    "sid" VARCHAR NOT NULL,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "user_session_pkey" PRIMARY KEY ("sid")
);

-- CreateTable
CREATE TABLE "agency" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "channel" "Channel" NOT NULL,
    "registration_no" VARCHAR(50),
    "email" VARCHAR(254),
    "phone" VARCHAR(20),
    "address" VARCHAR(300),
    "status" "AgencyStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuance_blocked" BOOLEAN NOT NULL DEFAULT false,
    "issuance_blocked_at" TIMESTAMP(3),
    "issuance_block_reason" VARCHAR(300),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent" (
    "id" UUID NOT NULL,
    "agent_code" VARCHAR(20) NOT NULL,
    "agency_id" UUID NOT NULL,
    "agent_type" "AgentType" NOT NULL,
    "parent_agent_id" UUID,
    "full_name" VARCHAR(150) NOT NULL,
    "id_type" "IdType" NOT NULL,
    "id_number_enc" TEXT NOT NULL,
    "id_number_hash" VARCHAR(64) NOT NULL,
    "date_of_birth" DATE,
    "email" VARCHAR(254) NOT NULL,
    "mobile" VARCHAR(20) NOT NULL,
    "address" VARCHAR(300),
    "branch_name" VARCHAR(100),
    "licence_no" VARCHAR(50),
    "licence_expiry" DATE,
    "status" "AgentStatus" NOT NULL DEFAULT 'PENDING',
    "status_reason" VARCHAR(300),
    "aml_status" "AmlStatus" NOT NULL DEFAULT 'NOT_SCREENED',
    "authority_limit" DECIMAL(14,2),
    "activated_at" TIMESTAMP(3),
    "terminated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participant" (
    "id" UUID NOT NULL,
    "participant_no" VARCHAR(20) NOT NULL,
    "type" "ParticipantType" NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "id_type" "IdType" NOT NULL,
    "id_number_enc" TEXT NOT NULL,
    "id_number_hash" VARCHAR(64) NOT NULL,
    "date_of_birth" DATE,
    "gender" VARCHAR(10),
    "nationality" VARCHAR(50),
    "occupation" VARCHAR(100),
    "occupation_class" INTEGER,
    "email" VARCHAR(254),
    "mobile" VARCHAR(20) NOT NULL,
    "address_line1" VARCHAR(200) NOT NULL,
    "address_line2" VARCHAR(200),
    "postcode" VARCHAR(10),
    "district" VARCHAR(50),
    "contact_person" VARCHAR(150),
    "aml_status" "AmlStatus" NOT NULL DEFAULT 'NOT_SCREENED',
    "aml_screened_at" TIMESTAMP(3),
    "created_by_agent_id" UUID,
    "created_by_agency_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aml_screening" (
    "id" UUID NOT NULL,
    "subject_type" VARCHAR(20) NOT NULL,
    "subject_id" UUID NOT NULL,
    "subject_name" VARCHAR(150) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "score" INTEGER NOT NULL,
    "matches" JSONB NOT NULL,
    "status" "AmlCaseStatus" NOT NULL,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_remarks" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aml_screening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aml_watchlist_entry" (
    "id" UUID NOT NULL,
    "list_name" VARCHAR(50) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "normalised" VARCHAR(150) NOT NULL,
    "id_number" VARCHAR(50),
    "country" VARCHAR(50),
    "reference" VARCHAR(100),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aml_watchlist_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "line_of_business" VARCHAR(50) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "rating_engine" VARCHAR(30) NOT NULL,
    "config" JSONB NOT NULL,
    "required_documents" JSONB NOT NULL,
    "questionnaire" JSONB NOT NULL,
    "payment_before_issuance" BOOLEAN NOT NULL DEFAULT true,
    "allow_renewal" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy" (
    "id" UUID NOT NULL,
    "quotation_no" VARCHAR(20) NOT NULL,
    "policy_no" VARCHAR(20),
    "product_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "status" "PolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "payment_status" "PolicyPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "plan_code" VARCHAR(20),
    "coverage_type" VARCHAR(20),
    "sum_covered" DECIMAL(14,2) NOT NULL,
    "term_months" INTEGER NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "contribution" DECIMAL(14,2) NOT NULL,
    "contribution_breakdown" JSONB NOT NULL,
    "risk_details" JSONB NOT NULL,
    "questionnaire" JSONB,
    "referral_reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "outstanding_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "payment_due_date" DATE,
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "issued_at" TIMESTAMP(3),
    "rejected_reason" VARCHAR(1000),
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" VARCHAR(1000),
    "renewal_of_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nominee" (
    "id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "id_number_enc" TEXT,
    "relationship" VARCHAR(50) NOT NULL,
    "role" "NomineeRole" NOT NULL DEFAULT 'NOMINEE',
    "share_percent" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "nominee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_event" (
    "id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "from_status" "PolicyStatus",
    "to_status" "PolicyStatus",
    "remarks" VARCHAR(1000),
    "actor_id" UUID,
    "actor_name" VARCHAR(150),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signature_request" (
    "id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "recipient_name" VARCHAR(150) NOT NULL,
    "recipient_email" VARCHAR(254) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "signed_at" TIMESTAMP(3),
    "signer_ip" VARCHAR(64),
    "document_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signature_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" UUID NOT NULL,
    "payment_no" VARCHAR(20) NOT NULL,
    "agency_id" UUID NOT NULL,
    "submitted_by_id" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "bank_name" VARCHAR(100),
    "reference_no" VARCHAR(50) NOT NULL,
    "payment_date" DATE NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "remarks" VARCHAR(500),
    "verified_by_id" UUID,
    "verified_at" TIMESTAMP(3),
    "rejection_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocation" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "payment_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt" (
    "id" UUID NOT NULL,
    "receipt_no" VARCHAR(20) NOT NULL,
    "payment_id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "document_id" UUID,

    CONSTRAINT "receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "contribution" DECIMAL(14,2) NOT NULL,
    "rate" DECIMAL(6,4) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'ACCRUED',
    "paid_at" TIMESTAMP(3),
    "source" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim" (
    "id" UUID NOT NULL,
    "claim_no" VARCHAR(20) NOT NULL,
    "policy_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "claim_type" VARCHAR(50) NOT NULL,
    "event_date" DATE NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "claimed_amount" DECIMAL(14,2),
    "status" "ClaimStatus" NOT NULL DEFAULT 'SUBMITTED',
    "remarks" VARCHAR(1000),
    "submitted_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document" (
    "id" UUID NOT NULL,
    "owner_type" "DocumentOwnerType" NOT NULL,
    "owner_id" UUID NOT NULL,
    "doc_type" VARCHAR(50) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" VARCHAR(255) NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "expiry_date" DATE,
    "remarks" VARCHAR(500),
    "system_generated" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_by_id" UUID,
    "verified_by_id" UUID,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_definition" (
    "id" UUID NOT NULL,
    "type" "ApprovalType" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_step" (
    "id" UUID NOT NULL,
    "definition_id" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "permission" VARCHAR(80) NOT NULL,
    "min_amount" DECIMAL(14,2),

    CONSTRAINT "workflow_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_request" (
    "id" UUID NOT NULL,
    "request_no" VARCHAR(20) NOT NULL,
    "type" "ApprovalType" NOT NULL,
    "entity_type" VARCHAR(30) NOT NULL,
    "entity_id" UUID NOT NULL,
    "summary" VARCHAR(300) NOT NULL,
    "payload" JSONB NOT NULL,
    "amount" DECIMAL(14,2),
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "current_level" INTEGER NOT NULL DEFAULT 1,
    "total_levels" INTEGER NOT NULL,
    "level_permissions" TEXT[],
    "maker_id" UUID NOT NULL,
    "maker_name" VARCHAR(150) NOT NULL,
    "agency_id" UUID,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    "final_remarks" VARCHAR(1000),

    CONSTRAINT "approval_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_action" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "action" "ApprovalActionType" NOT NULL,
    "actor_id" UUID NOT NULL,
    "actor_name" VARCHAR(150) NOT NULL,
    "remarks" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue" (
    "id" UUID NOT NULL,
    "issue_no" VARCHAR(20) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(4000) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "priority" "IssuePriority" NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "reported_by_id" UUID NOT NULL,
    "reported_by_name" VARCHAR(150) NOT NULL,
    "agency_id" UUID,
    "assigned_to_id" UUID,
    "assigned_to_name" VARCHAR(150),
    "assigned_team" VARCHAR(50),
    "response_due_at" TIMESTAMP(3) NOT NULL,
    "resolution_due_at" TIMESTAMP(3) NOT NULL,
    "first_responded_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "sla_breached" BOOLEAN NOT NULL DEFAULT false,
    "resolution" VARCHAR(2000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_comment" (
    "id" UUID NOT NULL,
    "issue_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "author_name" VARCHAR(150) NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "channel" "NotificationChannel" NOT NULL,
    "recipient" VARCHAR(254) NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "link" VARCHAR(300),
    "attachment_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" VARCHAR(1000),
    "read_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" UUID,
    "actor_name" VARCHAR(150),
    "action" VARCHAR(60) NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" VARCHAR(64),
    "before" JSONB,
    "after" JSONB,
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(300),
    "correlation_id" VARCHAR(64),

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_parameter" (
    "key" VARCHAR(80) NOT NULL,
    "value" VARCHAR(1000) NOT NULL,
    "value_type" "ParameterType" NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "min_value" DECIMAL(14,2),
    "max_value" DECIMAL(14,2),
    "updated_by_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_parameter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "code_item" (
    "id" UUID NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "code_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_message" (
    "id" UUID NOT NULL,
    "system" "IntegrationSystem" NOT NULL,
    "operation" VARCHAR(60) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" VARCHAR(1000),
    "aggregate_type" VARCHAR(30),
    "aggregate_id" VARCHAR(64),
    "correlation_id" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "outbox_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_log" (
    "id" UUID NOT NULL,
    "system" "IntegrationSystem" NOT NULL,
    "operation" VARCHAR(60) NOT NULL,
    "direction" "IntegrationDirection" NOT NULL,
    "success" BOOLEAN NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "reference" VARCHAR(100),
    "request_summary" VARCHAR(1000),
    "response_summary" VARCHAR(1000),
    "error_message" VARCHAR(1000),
    "outbox_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_run" (
    "id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "system" "IntegrationSystem" NOT NULL,
    "expected_count" INTEGER NOT NULL,
    "matched_count" INTEGER NOT NULL,
    "expected_amount" DECIMAL(14,2) NOT NULL,
    "matched_amount" DECIMAL(14,2) NOT NULL,
    "status" "ReconciliationStatus" NOT NULL,
    "details" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eod_run" (
    "id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "status" "JobStatus" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "policies_issued" INTEGER NOT NULL DEFAULT 0,
    "receipts_issued" INTEGER NOT NULL DEFAULT 0,
    "total_contribution" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_receipts" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "report_document_id" UUID,
    "fin_file_document_id" UUID,
    "error_message" VARCHAR(1000),
    "triggered_by" VARCHAR(150) NOT NULL,

    CONSTRAINT "eod_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_schedule" (
    "id" UUID NOT NULL,
    "report_code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "frequency" "ReportFrequency" NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "recipients" TEXT[],
    "filters" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_user_username_key" ON "app_user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_agent_id_key" ON "app_user"("agent_id");

-- CreateIndex
CREATE INDEX "app_user_user_type_status_idx" ON "app_user"("user_type", "status");

-- CreateIndex
CREATE INDEX "password_history_user_id_created_at_idx" ON "password_history"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "role_code_key" ON "role"("code");

-- CreateIndex
CREATE INDEX "user_session_expire_idx" ON "user_session"("expire");

-- CreateIndex
CREATE UNIQUE INDEX "agency_code_key" ON "agency"("code");

-- CreateIndex
CREATE UNIQUE INDEX "agent_agent_code_key" ON "agent"("agent_code");

-- CreateIndex
CREATE INDEX "agent_agency_id_status_idx" ON "agent"("agency_id", "status");

-- CreateIndex
CREATE INDEX "agent_parent_agent_id_idx" ON "agent"("parent_agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_id_type_id_number_hash_key" ON "agent"("id_type", "id_number_hash");

-- CreateIndex
CREATE UNIQUE INDEX "participant_participant_no_key" ON "participant"("participant_no");

-- CreateIndex
CREATE INDEX "participant_full_name_idx" ON "participant"("full_name");

-- CreateIndex
CREATE INDEX "participant_created_by_agency_id_idx" ON "participant"("created_by_agency_id");

-- CreateIndex
CREATE UNIQUE INDEX "participant_id_type_id_number_hash_key" ON "participant"("id_type", "id_number_hash");

-- CreateIndex
CREATE INDEX "aml_screening_subject_type_subject_id_idx" ON "aml_screening"("subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "aml_screening_status_idx" ON "aml_screening"("status");

-- CreateIndex
CREATE INDEX "aml_watchlist_entry_normalised_idx" ON "aml_watchlist_entry"("normalised");

-- CreateIndex
CREATE UNIQUE INDEX "product_code_key" ON "product"("code");

-- CreateIndex
CREATE UNIQUE INDEX "policy_quotation_no_key" ON "policy"("quotation_no");

-- CreateIndex
CREATE UNIQUE INDEX "policy_policy_no_key" ON "policy"("policy_no");

-- CreateIndex
CREATE INDEX "policy_agency_id_status_idx" ON "policy"("agency_id", "status");

-- CreateIndex
CREATE INDEX "policy_agent_id_status_idx" ON "policy"("agent_id", "status");

-- CreateIndex
CREATE INDEX "policy_participant_id_idx" ON "policy"("participant_id");

-- CreateIndex
CREATE INDEX "policy_status_payment_status_payment_due_date_idx" ON "policy"("status", "payment_status", "payment_due_date");

-- CreateIndex
CREATE INDEX "policy_issued_at_idx" ON "policy"("issued_at");

-- CreateIndex
CREATE INDEX "nominee_policy_id_idx" ON "nominee"("policy_id");

-- CreateIndex
CREATE INDEX "policy_event_policy_id_created_at_idx" ON "policy_event"("policy_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "signature_request_token_hash_key" ON "signature_request"("token_hash");

-- CreateIndex
CREATE INDEX "signature_request_policy_id_idx" ON "signature_request"("policy_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_payment_no_key" ON "payment"("payment_no");

-- CreateIndex
CREATE INDEX "payment_agency_id_status_idx" ON "payment"("agency_id", "status");

-- CreateIndex
CREATE INDEX "payment_status_created_at_idx" ON "payment"("status", "created_at");

-- CreateIndex
CREATE INDEX "payment_allocation_policy_id_idx" ON "payment_allocation"("policy_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocation_payment_id_policy_id_key" ON "payment_allocation"("payment_id", "policy_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_receipt_no_key" ON "receipt"("receipt_no");

-- CreateIndex
CREATE INDEX "receipt_policy_id_idx" ON "receipt"("policy_id");

-- CreateIndex
CREATE INDEX "receipt_issued_at_idx" ON "receipt"("issued_at");

-- CreateIndex
CREATE INDEX "commission_agent_id_period_idx" ON "commission"("agent_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "commission_policy_id_agent_id_key" ON "commission"("policy_id", "agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "claim_claim_no_key" ON "claim"("claim_no");

-- CreateIndex
CREATE INDEX "claim_agency_id_status_idx" ON "claim"("agency_id", "status");

-- CreateIndex
CREATE INDEX "claim_policy_id_idx" ON "claim"("policy_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_storage_key_key" ON "document"("storage_key");

-- CreateIndex
CREATE INDEX "document_owner_type_owner_id_idx" ON "document"("owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "document_status_idx" ON "document"("status");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_definition_type_key" ON "workflow_definition"("type");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_step_definition_id_level_key" ON "workflow_step"("definition_id", "level");

-- CreateIndex
CREATE UNIQUE INDEX "approval_request_request_no_key" ON "approval_request"("request_no");

-- CreateIndex
CREATE INDEX "approval_request_status_type_idx" ON "approval_request"("status", "type");

-- CreateIndex
CREATE INDEX "approval_request_entity_type_entity_id_idx" ON "approval_request"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "approval_request_maker_id_idx" ON "approval_request"("maker_id");

-- CreateIndex
CREATE INDEX "approval_action_request_id_idx" ON "approval_action"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "issue_issue_no_key" ON "issue"("issue_no");

-- CreateIndex
CREATE INDEX "issue_status_priority_idx" ON "issue"("status", "priority");

-- CreateIndex
CREATE INDEX "issue_reported_by_id_idx" ON "issue"("reported_by_id");

-- CreateIndex
CREATE INDEX "issue_assigned_to_id_idx" ON "issue"("assigned_to_id");

-- CreateIndex
CREATE INDEX "issue_comment_issue_id_idx" ON "issue_comment"("issue_id");

-- CreateIndex
CREATE INDEX "notification_user_id_channel_read_at_idx" ON "notification"("user_id", "channel", "read_at");

-- CreateIndex
CREATE INDEX "notification_status_channel_idx" ON "notification"("status", "channel");

-- CreateIndex
CREATE INDEX "audit_log_occurred_at_idx" ON "audit_log"("occurred_at");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_actor_id_occurred_at_idx" ON "audit_log"("actor_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_log_action_idx" ON "audit_log"("action");

-- CreateIndex
CREATE UNIQUE INDEX "code_item_category_code_key" ON "code_item"("category", "code");

-- CreateIndex
CREATE INDEX "outbox_message_status_next_attempt_at_idx" ON "outbox_message"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "outbox_message_system_created_at_idx" ON "outbox_message"("system", "created_at");

-- CreateIndex
CREATE INDEX "integration_log_system_created_at_idx" ON "integration_log"("system", "created_at");

-- CreateIndex
CREATE INDEX "integration_log_success_created_at_idx" ON "integration_log"("success", "created_at");

-- CreateIndex
CREATE INDEX "reconciliation_run_business_date_system_idx" ON "reconciliation_run"("business_date", "system");

-- CreateIndex
CREATE UNIQUE INDEX "eod_run_business_date_key" ON "eod_run"("business_date");

-- CreateIndex
CREATE INDEX "report_schedule_active_next_run_at_idx" ON "report_schedule"("active", "next_run_at");

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_history" ADD CONSTRAINT "password_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent" ADD CONSTRAINT "agent_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent" ADD CONSTRAINT "agent_parent_agent_id_fkey" FOREIGN KEY ("parent_agent_id") REFERENCES "agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy" ADD CONSTRAINT "policy_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy" ADD CONSTRAINT "policy_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy" ADD CONSTRAINT "policy_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy" ADD CONSTRAINT "policy_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy" ADD CONSTRAINT "policy_renewal_of_id_fkey" FOREIGN KEY ("renewal_of_id") REFERENCES "policy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nominee" ADD CONSTRAINT "nominee_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_event" ADD CONSTRAINT "policy_event_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_request" ADD CONSTRAINT "signature_request_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission" ADD CONSTRAINT "commission_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission" ADD CONSTRAINT "commission_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim" ADD CONSTRAINT "claim_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step" ADD CONSTRAINT "workflow_step_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "workflow_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_action" ADD CONSTRAINT "approval_action_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "approval_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_comment" ADD CONSTRAINT "issue_comment_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Business reference number sequences (used by NumberingService)
-- ---------------------------------------------------------------------------
CREATE SEQUENCE "seq_agent_code" START 1;
CREATE SEQUENCE "seq_participant_no" START 1;
CREATE SEQUENCE "seq_quotation_no" START 1;
CREATE SEQUENCE "seq_policy_no" START 1;
CREATE SEQUENCE "seq_payment_no" START 1;
CREATE SEQUENCE "seq_receipt_no" START 1;
CREATE SEQUENCE "seq_claim_no" START 1;
CREATE SEQUENCE "seq_issue_no" START 1;
CREATE SEQUENCE "seq_request_no" START 1;

-- ---------------------------------------------------------------------------
-- Audit trail is append-only: block UPDATE and DELETE at database level.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "audit_log_block_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_log_no_update"
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION "audit_log_block_mutation"();

-- ---------------------------------------------------------------------------
-- Data integrity checks not expressible in the Prisma schema.
-- ---------------------------------------------------------------------------
ALTER TABLE "policy" ADD CONSTRAINT "policy_amounts_non_negative"
  CHECK ("contribution" >= 0 AND "sum_covered" >= 0 AND "outstanding_amount" >= 0);
ALTER TABLE "payment" ADD CONSTRAINT "payment_amount_positive" CHECK ("total_amount" > 0);
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "nominee" ADD CONSTRAINT "nominee_share_range" CHECK ("share_percent" > 0 AND "share_percent" <= 100);
