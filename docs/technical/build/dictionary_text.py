"""Business descriptions for the data dictionary.

Keys are PostgreSQL names ("table" or "table.column"). The generator fails if a
table or column in the schema has no description here, so this file must be
updated in the same change as any migration.
"""

# Columns whose meaning is identical in every table that has them.
COMMON = {
    "id": "Surrogate primary key.",
    "created_at": "Date and time the row was created (UTC).",
    "updated_at": "Date and time the row was last changed (UTC), maintained by the application.",
    "version": "Optimistic-lock counter. Incremented on every update; an update that quotes a stale version is "
               "rejected with STALE_RECORD so two users cannot overwrite each other's changes.",
}

TABLES = {
    "app_user": "Every person who can sign in: agents and bank officers (portal) and IIFT staff (back-office). "
                "Holds credentials, lockout state and the optional link to an agent profile.",
    "password_history": "Hashes of previous passwords, used to stop reuse of the last N passwords "
                        "(security.password.history_count).",
    "role": "Configurable roles (BO-04). Each role belongs to one audience, portal or back-office, and is "
            "built from permissions in role_permission.",
    "role_permission": "Permissions granted to a role. Permission codes are defined in the application "
                       "(src/common/security/permissions.ts) because each one guards code.",
    "user_role": "Roles assigned to a user. A user's effective permissions are the union of the permissions of "
                 "roles that match the user's audience.",
    "user_session": "Server-side HTTP sessions written by connect-pg-simple. The browser holds only the "
                    "session id in an HttpOnly cookie; deleting a row ends that session immediately.",
    "agency": "Distribution partners: agencies (agency channel) and banks (banca channel). Carries the "
              "automatic issuance block applied when contributions are overdue (AP-42).",
    "agent": "Agents, sub-agents and bank officers with their hierarchy, licence, status, AML status and "
             "authority limit. Identification numbers are encrypted.",
    "participant": "Shared participant (certificate holder) master record, individual or corporate. One record "
                   "per identification number across all agencies (AP-11). Identification numbers are encrypted.",
    "aml_screening": "One row per AML/KYC screening of an agent or participant, with match details and the "
                     "Compliance review decision (BO-13 to BO-15).",
    "aml_watchlist_entry": "Watch-list entries (sanctions, PEP, internal lists) loaded by Compliance and used by "
                           "the built-in screening.",
    "product": "Takaful products offered through the portal (Appendix 3) with their rating configuration, "
               "required documents and questionnaire, all maintainable without code changes (BO-33).",
    "policy": "Quotations and policies. A row starts as a DRAFT quotation and keeps the same id through approval, "
              "issuance, renewal, endorsement, cancellation and expiry.",
    "nominee": "Nominees, beneficiaries and executors named on a policy.",
    "policy_event": "Business history of a policy: every status change and significant action with actor and "
                    "remarks (AP-31).",
    "signature_request": "One-time e-signature links e-mailed to participants (AP-62). Only a hash of the token "
                         "is stored.",
    "payment": "Contribution payments submitted by agencies and banks, with proof of payment, awaiting or "
               "after Finance verification (AP-38 to AP-40).",
    "payment_allocation": "How a payment is split across the policies it pays for (bulk payment, AP-38).",
    "receipt": "Official e-Receipts issued per policy when a payment is verified (AP-41).",
    "commission": "Commission or referral fee accrued per agent and policy at issuance, and marked paid when "
                  "Finance confirms payment (INT-05).",
    "claim": "Claim notifications submitted through the portal (AP-43). Assessment happens in the core system.",
    "document": "Metadata of every uploaded or system-generated document. File content is held encrypted in "
                "the document store and addressed by storage_key.",
    "workflow_definition": "Approval workflow per transaction type (COM-04, BO-16). Inactive definitions approve "
                           "requests automatically.",
    "workflow_step": "Levels of a workflow: permission required to approve the level and optional amount "
                     "threshold above which the level applies (authority limits).",
    "approval_request": "Maker-checker requests raised for a transaction type, with the proposed change as "
                        "payload and the approval levels resolved at submission.",
    "approval_action": "Every action on an approval request: submit, approve, reject or withdraw, with actor and "
                       "remarks (AP-61).",
    "issue": "Issues reported from the portal or back-office with priority, assignment and SLA timestamps "
             "(AP-55, BO-29 to BO-31).",
    "issue_comment": "Comments on an issue. Internal comments are visible only to back-office staff.",
    "notification": "In-app, e-mail and SMS notifications. E-mail and SMS rows are delivered asynchronously by the "
                    "notification dispatcher with retry.",
    "audit_log": "Append-only audit trail of security and business events with before and after values "
                 "(BO-26 to BO-28, COM-03). A trigger rejects UPDATE and DELETE.",
    "config_parameter": "Business parameters administrators can change without a release: password policy, "
                        "session timeouts, grace period, SLA hours and similar (BO-33, COM-09).",
    "code_item": "Master data code lists (document types, relationships, nationalities, districts, banks, "
                 "occupations, claim types, issue categories and others) maintained in the back-office (BO-32).",
    "outbox_message": "Transactional outbox for messages to the core and financial systems. Written in the same "
                      "transaction as the business change and delivered asynchronously with retry.",
    "integration_log": "One row per integration call, outbound or inbound, with outcome and duration "
                       "(INT-11, INT-14).",
    "reconciliation_run": "Results of daily reconciliation between receipts issued by the portal and receipts "
                          "posted by the financial system (INT-15).",
    "eod_run": "End-of-day runs per business date with totals and links to the EOD report and FIN interface "
               "file.",
    "report_schedule": "Scheduled reports e-mailed to recipients daily, weekly or monthly (BO-25).",
}

COLUMNS = {
    # --- app_user ----------------------------------------------------------------
    "app_user.username": "Sign-in name, stored in lower case and unique across all users.",
    "app_user.email": "E-mail address for notifications and password reset communication.",
    "app_user.full_name": "Name shown on screens, in approval history and in the audit trail.",
    "app_user.mobile": "Mobile number for SMS notifications, in international format.",
    "app_user.user_type": "AGENT, BANCA or STAFF. STAFF users belong to the back-office audience; the others to "
                          "the portal.",
    "app_user.status": "ACTIVE, LOCKED (temporarily, after failed sign-ins) or DISABLED (by an administrator or "
                       "core-system status sync).",
    "app_user.auth_source": "LOCAL for passwords held by the application; DIRECTORY for back-office users "
                            "authenticated against Active Directory/LDAP.",
    "app_user.password_hash": "Argon2id hash of the password (memory 19 MiB, 2 iterations). Null for directory "
                              "accounts.",
    "app_user.password_changed_at": "When the password was last changed; drives password expiry.",
    "app_user.must_change_password": "True when the user must change the password at next sign-in (new account "
                                     "or administrator reset).",
    "app_user.failed_login_count": "Consecutive failed sign-in attempts since the last success or lock.",
    "app_user.locked_until": "End of the current lockout period; null when not locked.",
    "app_user.last_login_at": "Time of the last successful sign-in.",
    "app_user.agent_id": "Agent profile of a portal user; null for back-office staff. One user per agent.",
    # --- password_history ----------------------------------------------------------
    "password_history.user_id": "User the historical password belonged to.",
    "password_history.password_hash": "Argon2id hash of a previous password.",
    # --- role ----------------------------------------------------------------------
    "role.code": "Stable role code used by seed data and integrations, e.g. OPERATIONS_SUPERVISOR.",
    "role.name": "Role name shown to administrators.",
    "role.description": "What the role is for.",
    "role.audience": "PORTAL or BACKOFFICE. Only permissions of the same audience can be granted to the role.",
    "role.is_system": "True for roles created by the seed script. System roles can be edited but not deleted.",
    # --- role_permission / user_role -----------------------------------------------------
    "role_permission.role_id": "Role receiving the permission.",
    "role_permission.permission": "Permission code, e.g. bo.approve.policies, from the application catalogue.",
    "user_role.user_id": "User holding the role.",
    "user_role.role_id": "Role assigned to the user.",
    # --- user_session ------------------------------------------------------------------
    "user_session.sid": "Session identifier carried in the session cookie. Regenerated at sign-in.",
    "user_session.sess": "Session data: signed-in user snapshot (identity, audience, permissions, agency link), "
                         "CSRF token and authentication time.",
    "user_session.expire": "When the session expires if idle. Expired rows are pruned every 15 minutes.",
    # --- agency -------------------------------------------------------------------------
    "agency.code": "Unique agency or bank code used on reports and the FIN interface file.",
    "agency.name": "Registered name of the agency or bank.",
    "agency.channel": "AGENCY or BANCA distribution channel.",
    "agency.registration_no": "Business registration number of the agency or bank.",
    "agency.email": "Main contact e-mail address.",
    "agency.phone": "Main contact telephone number.",
    "agency.address": "Business address.",
    "agency.status": "ACTIVE, INACTIVE or SUSPENDED. Users of a non-active agency cannot sign in.",
    "agency.issuance_blocked": "True while new business is blocked because an issued policy is unpaid beyond the "
                               "grace period (AP-42).",
    "agency.issuance_blocked_at": "When the current block was applied.",
    "agency.issuance_block_reason": "Reason shown to the agency, including the number of overdue policies and the "
                                    "amount.",
    # --- agent -------------------------------------------------------------------------
    "agent.agent_code": "Unique agent code, AG-nnnnnn for agency agents and BK-nnnnnn for bank officers, issued from "
                        "seq_agent_code.",
    "agent.agency_id": "Agency or bank the agent belongs to.",
    "agent.agent_type": "MAIN_AGENT, SUB_AGENT or BANKER.",
    "agent.parent_agent_id": "Main agent a sub-agent reports to; null for main agents and bank officers without a "
                             "supervisor.",
    "agent.full_name": "Agent's full name as on the identity document.",
    "agent.id_type": "Type of identification: NRIC or PASSPORT.",
    "agent.id_number_enc": "Identification number encrypted with AES-256-GCM (format v1:<base64 iv|tag|ciphertext>). "
                           "Decrypted only for authorised display, and then masked.",
    "agent.id_number_hash": "Blind index: HMAC-SHA256 of the normalised identification number. Allows exact search "
                            "and the uniqueness check without decrypting.",
    "agent.date_of_birth": "Date of birth.",
    "agent.email": "Agent's e-mail address for notifications.",
    "agent.mobile": "Agent's mobile number for SMS notifications.",
    "agent.address": "Correspondence address.",
    "agent.branch_name": "Bank branch of a bank officer.",
    "agent.licence_no": "Agent licence or registration number.",
    "agent.licence_expiry": "Licence expiry date, used for expiry warnings.",
    "agent.status": "Registration status: PENDING approval, ACTIVE, INACTIVE, SUSPENDED, TERMINATED or REJECTED.",
    "agent.status_reason": "Reason for the latest status change, including changes received from the core system.",
    "agent.aml_status": "Latest AML/KYC outcome: NOT_SCREENED, CLEAR, FLAGGED or REJECTED.",
    "agent.authority_limit": "Highest sum covered (B$) the agent may submit without referral; above it the "
                             "quotation is referred for approval (AP-60). Null means no personal limit.",
    "agent.activated_at": "When the registration was approved and the agent activated.",
    "agent.terminated_at": "When the agent was terminated.",
    # --- participant ------------------------------------------------------------------
    "participant.participant_no": "Business reference PT/yy/nnnnnn issued from seq_participant_no.",
    "participant.type": "INDIVIDUAL or CORPORATE.",
    "participant.full_name": "Full name of the individual or registered name of the company.",
    "participant.id_type": "NRIC, PASSPORT or BUSINESS_REG.",
    "participant.id_number_enc": "Identification number encrypted with AES-256-GCM; displayed masked.",
    "participant.id_number_hash": "Blind index (HMAC-SHA256) of the normalised identification number; enforces one "
                                  "participant per identification number and supports exact search.",
    "participant.date_of_birth": "Date of birth; drives age-next-birthday rating and eligibility.",
    "participant.gender": "Gender code from master data.",
    "participant.nationality": "Nationality code from master data; used by eligibility rules (e.g. OSA).",
    "participant.occupation": "Occupation code from master data.",
    "participant.occupation_class": "Occupational class 1 to 4; the Professional plan accepts class I only.",
    "participant.email": "Participant e-mail for documents and e-signature links.",
    "participant.mobile": "Participant mobile number.",
    "participant.address_line1": "First address line.",
    "participant.address_line2": "Second address line.",
    "participant.postcode": "Postcode.",
    "participant.district": "District code from master data.",
    "participant.contact_person": "Contact person for a corporate participant.",
    "participant.aml_status": "Latest AML/KYC outcome. FLAGGED or REJECTED blocks submission of applications.",
    "participant.aml_screened_at": "When the participant was last screened.",
    "participant.created_by_agent_id": "Agent who registered the participant (no foreign key, kept for history).",
    "participant.created_by_agency_id": "Agency of the registering agent; used for data scoping.",
    # --- aml_screening --------------------------------------------------------------------
    "aml_screening.subject_type": "AGENT or PARTICIPANT.",
    "aml_screening.subject_id": "Id of the screened agent or participant.",
    "aml_screening.subject_name": "Name screened, kept as at the time of screening.",
    "aml_screening.provider": "Source of the result: WATCHLIST, WATCHLIST+EXTERNAL or WATCHLIST+EXTERNAL_UNAVAILABLE.",
    "aml_screening.score": "Highest match score, 0 to 100. At or above aml.match_threshold the case is flagged.",
    "aml_screening.matches": "Up to ten best matches: list name, matched name, score, reference and reason (NAME or "
                             "ID_NUMBER).",
    "aml_screening.status": "AUTO_CLEARED, PENDING_REVIEW, CLEARED or CONFIRMED_MATCH.",
    "aml_screening.reviewed_by_id": "Compliance officer who reviewed the case.",
    "aml_screening.reviewed_at": "When the case was reviewed.",
    "aml_screening.review_remarks": "Mandatory reviewer remarks explaining the decision.",
    # --- aml_watchlist_entry ---------------------------------------------------------------
    "aml_watchlist_entry.list_name": "Name of the list the entry came from, e.g. UN, LOCAL, INTERNAL.",
    "aml_watchlist_entry.full_name": "Listed name as published.",
    "aml_watchlist_entry.normalised": "Name in upper case without punctuation or honorifics; used for candidate "
                                      "selection and similarity scoring.",
    "aml_watchlist_entry.id_number": "Identification number of the listed person, where published. An exact match "
                                     "scores 100.",
    "aml_watchlist_entry.country": "Country associated with the entry.",
    "aml_watchlist_entry.reference": "Reference of the entry in the source list.",
    "aml_watchlist_entry.active": "False when the entry was withdrawn or replaced by a newer import of the list.",
    # --- product ---------------------------------------------------------------------------
    "product.code": "Product code, e.g. FTP-HP, PRO, KHR. Prefixes the policy number.",
    "product.name": "Product name shown in the catalogue and on documents.",
    "product.line_of_business": "Line of business, e.g. Mortgage Takaful or Annual.",
    "product.description": "Short description shown in the product catalogue.",
    "product.rating_engine": "Rating engine that interprets config: FINANCING (decreasing-term financing products) "
                             "or FIXED_PLAN (plan-based annual products).",
    "product.config": "Rating configuration: rate tables, plans, loadings, limits, eligibility, wakalah fee and "
                      "commission rates. Validated by the rating engine before it is saved.",
    "product.required_documents": "Documents required for the product: type, label and whether mandatory before "
                                  "submission.",
    "product.questionnaire": "Health or risk questions; a 'yes' to a question marked referIfYes refers the "
                             "application for approval.",
    "product.payment_before_issuance": "True for pay-first products; false for issue-then-pay products, which must "
                                       "be paid within the grace period.",
    "product.allow_renewal": "Whether policies of the product can be renewed from the portal.",
    "product.active": "Inactive products are hidden from the catalogue and cannot be quoted.",
    "product.sort_order": "Display order in the catalogue.",
    # --- policy ----------------------------------------------------------------------------
    "policy.quotation_no": "Quotation reference QT/yy/nnnnnn issued from seq_quotation_no when the draft is created.",
    "policy.policy_no": "Policy number <product code>/yy/nnnnnn issued from seq_policy_no at issuance; null before "
                        "issuance.",
    "policy.product_id": "Product quoted.",
    "policy.participant_id": "Participant (certificate holder).",
    "policy.agent_id": "Agent or bank officer who owns the business.",
    "policy.agency_id": "Agency or bank of the agent; used for data scoping and the grace-period rule.",
    "policy.status": "Lifecycle status: DRAFT, PENDING_APPROVAL, PENDING_PAYMENT, ACTIVE, REJECTED, EXPIRED or "
                     "CANCELLED.",
    "policy.payment_status": "UNPAID, PENDING_VERIFICATION (payment submitted) or PAID.",
    "policy.plan_code": "Selected plan for plan-based products, e.g. A, B, C.",
    "policy.coverage_type": "Coverage option, e.g. INDIVIDUAL or WIDER for Khairat.",
    "policy.sum_covered": "Sum covered in B$.",
    "policy.term_months": "Cover term in months.",
    "policy.start_date": "Cover start date.",
    "policy.end_date": "Cover end date; the expiry job sets status EXPIRED after this date.",
    "policy.contribution": "Total contribution payable in B$, including any additional cover.",
    "policy.contribution_breakdown": "Contribution lines, tabarru' and wakalah fee split and commission rate, as "
                                     "rated.",
    "policy.risk_details": "Product-specific rating inputs, e.g. financing amount, tenure and profit rate, "
                           "employer details, student institution.",
    "policy.questionnaire": "Answers to the product questionnaire.",
    "policy.referral_reasons": "Reasons the application was referred for approval (authority limit, high-risk "
                               "limit, questionnaire, quality check). Empty when not referred.",
    "policy.outstanding_amount": "Contribution not yet paid in B$.",
    "policy.payment_due_date": "Last day to submit payment for issue-then-pay products (issuance date plus grace "
                               "days).",
    "policy.submitted_at": "When the quotation was last submitted.",
    "policy.approved_at": "When the referral was approved.",
    "policy.issued_at": "When the policy was issued; drives the EOD selection.",
    "policy.rejected_reason": "Reason given by the checker when the application was rejected (AP-51).",
    "policy.cancelled_at": "When the policy was cancelled.",
    "policy.cancellation_reason": "Approved cancellation reason.",
    "policy.renewal_of_id": "Policy this one renews; null for new business.",
    "policy.created_by_id": "User who created the quotation.",
    # --- nominee ---------------------------------------------------------------------------
    "nominee.policy_id": "Policy the nominee belongs to.",
    "nominee.full_name": "Nominee's full name.",
    "nominee.id_number_enc": "Nominee's identification number encrypted with AES-256-GCM; optional.",
    "nominee.relationship": "Relationship to the participant, from master data.",
    "nominee.role": "NOMINEE, BENEFICIARY or EXECUTOR.",
    "nominee.share_percent": "Share of the benefit in per cent, greater than 0 and at most 100; shares on a policy "
                             "total 100.",
    # --- policy_event ----------------------------------------------------------------------
    "policy_event.policy_id": "Policy the event belongs to.",
    "policy_event.action": "Event code, e.g. QUOTATION_CREATED, SUBMITTED, REFERRED, ISSUED, PARTICIPANT_SIGNED, PAYMENT_APPLIED, EXPIRED.",
    "policy_event.from_status": "Status before the event, when the event changed status.",
    "policy_event.to_status": "Status after the event.",
    "policy_event.remarks": "Free-text detail, e.g. referral reasons or rejection remarks.",
    "policy_event.actor_id": "User who performed the action; null for system jobs and participants.",
    "policy_event.actor_name": "Name of the actor at the time: user name, participant name or System.",
    # --- signature_request -------------------------------------------------------------------
    "signature_request.policy_id": "Quotation to be signed.",
    "signature_request.token_hash": "SHA-256 of the one-time token in the e-mailed link. The token itself is never "
                                    "stored.",
    "signature_request.recipient_name": "Participant name the signer must type to confirm identity.",
    "signature_request.recipient_email": "Address the link was sent to.",
    "signature_request.expires_at": "Link expiry (policy.esign_link_hours after sending).",
    "signature_request.signed_at": "When the participant signed; a non-null value makes the link unusable.",
    "signature_request.signer_ip": "IP address the signature was made from.",
    "signature_request.document_id": "Signature image stored as a document.",
    "signature_request.created_by_id": "Agent user who sent the link.",
    # --- payment ---------------------------------------------------------------------------
    "payment.payment_no": "Payment reference PY/yy/nnnnnn issued from seq_payment_no.",
    "payment.agency_id": "Agency or bank that made the payment.",
    "payment.submitted_by_id": "User who submitted the payment.",
    "payment.method": "BANK_TRANSFER, CHEQUE, CASH_DEPOSIT or ONLINE.",
    "payment.bank_name": "Paying bank, from master data.",
    "payment.reference_no": "Bank transaction or cheque reference; carried to the FIN interface file.",
    "payment.payment_date": "Date the payment was made.",
    "payment.total_amount": "Total paid in B$; must be greater than zero and equal the sum of allocations.",
    "payment.status": "PENDING_VERIFICATION, VERIFIED or REJECTED.",
    "payment.remarks": "Remarks from the submitter.",
    "payment.verified_by_id": "Finance officer who verified or rejected the payment.",
    "payment.verified_at": "When the payment was verified or rejected.",
    "payment.rejection_reason": "Reason the payment was rejected.",
    # --- payment_allocation --------------------------------------------------------------------
    "payment_allocation.payment_id": "Payment being allocated.",
    "payment_allocation.policy_id": "Policy the amount pays for.",
    "payment_allocation.amount": "Amount allocated to the policy in B$; greater than zero.",
    # --- receipt ---------------------------------------------------------------------------
    "receipt.receipt_no": "Receipt number RC/yy/nnnnnn issued from seq_receipt_no; reconciled with the financial "
                          "system.",
    "receipt.payment_id": "Verified payment the receipt was issued from.",
    "receipt.policy_id": "Policy the receipt is for.",
    "receipt.amount": "Amount received for the policy in B$.",
    "receipt.issued_at": "When the receipt was issued; drives the EOD and reconciliation selection.",
    "receipt.document_id": "PDF e-Receipt stored as a document.",
    # --- commission ------------------------------------------------------------------------
    "commission.agent_id": "Agent earning the commission or referral fee.",
    "commission.policy_id": "Policy the commission relates to.",
    "commission.period": "Accrual period as YYYY-MM.",
    "commission.contribution": "Contribution the commission was calculated on, in B$.",
    "commission.rate": "Commission rate applied, as a fraction (0.1000 = 10%).",
    "commission.amount": "Commission amount in B$.",
    "commission.status": "ACCRUED until Finance confirms payment, then PAID.",
    "commission.paid_at": "Payment date confirmed by Finance through the inbound API.",
    "commission.source": "Where the accrual was created; PORTAL for accruals at issuance.",
    # --- claim -----------------------------------------------------------------------------
    "claim.claim_no": "Claim notification reference CL/yy/nnnnnn issued from seq_claim_no.",
    "claim.policy_id": "Policy the claim is notified under.",
    "claim.agent_id": "Agent who notified the claim (copied from the policy for data scoping).",
    "claim.agency_id": "Agency of the agent (copied from the policy for data scoping).",
    "claim.claim_type": "Claim type code from master data: DEATH, TPD, ACCIDENT, MEDICAL, REPATRIATION or OTHER.",
    "claim.event_date": "Date of the insured event.",
    "claim.description": "Description of the event.",
    "claim.claimed_amount": "Amount claimed in B$, where known.",
    "claim.status": "SUBMITTED, UNDER_REVIEW, ACKNOWLEDGED, REJECTED or CLOSED.",
    "claim.remarks": "Back-office remarks visible to the agent.",
    "claim.submitted_by_id": "User who submitted the notification.",
    # --- document ---------------------------------------------------------------------------
    "document.owner_type": "Type of record the document belongs to: AGENT, AGENCY, PARTICIPANT, POLICY, PAYMENT, "
                           "CLAIM, ISSUE or REPORT.",
    "document.owner_id": "Id of the owning record (polymorphic, no foreign key).",
    "document.doc_type": "Document type code from master data, e.g. IC_COPY, PROPOSAL_FORM, PAYMENT_PROOF, "
                         "POLICY_SCHEDULE, RECEIPT, EOD_REPORT, FIN_FILE.",
    "document.file_name": "Sanitised file name; the extension always matches the detected content type.",
    "document.mime_type": "Content type detected from the file's magic bytes (PDF, PNG, JPEG) or set for generated "
                          "files.",
    "document.size_bytes": "File size in bytes before encryption.",
    "document.storage_key": "Location in the encrypted store, yyyy/mm/<uuid>.bin. Generated by the application; "
                            "never derived from user input.",
    "document.sha256": "SHA-256 checksum of the original content, for integrity and duplicate checks.",
    "document.status": "UPLOADED, VERIFIED or REJECTED by a back-office checker.",
    "document.expiry_date": "Expiry date of the document (e.g. passport, licence) for expiry warnings.",
    "document.remarks": "Verifier remarks, required on rejection.",
    "document.system_generated": "True for documents produced by the system (schedule, receipt, reports).",
    "document.uploaded_by_id": "User who uploaded the file; null for system-generated files and participant "
                               "e-signatures.",
    "document.verified_by_id": "Back-office user who verified or rejected the document.",
    "document.verified_at": "When the document was verified or rejected.",
    # --- workflow ---------------------------------------------------------------------------
    "workflow_definition.type": "Transaction type governed by the workflow; one definition per type.",
    "workflow_definition.name": "Workflow name shown to administrators.",
    "workflow_definition.description": "What the workflow covers.",
    "workflow_definition.active": "When false, requests of this type are approved automatically on submission.",
    "workflow_step.definition_id": "Workflow the step belongs to.",
    "workflow_step.level": "Approval level, starting at 1.",
    "workflow_step.name": "Step name shown in the inbox and approval history.",
    "workflow_step.permission": "Permission a checker needs to approve this level.",
    "workflow_step.min_amount": "Amount threshold in B$; the level applies only when the request amount is at or "
                                "above it. Null means always.",
    "approval_request.request_no": "Request reference RQ/yy/nnnnnn issued from seq_request_no.",
    "approval_request.type": "Transaction type, e.g. AGENT_REGISTRATION, POLICY_REFERRAL, PAYMENT_VERIFICATION.",
    "approval_request.entity_type": "Type of record the request is about, e.g. Agent, Policy, Payment.",
    "approval_request.entity_id": "Id of the record the request is about.",
    "approval_request.summary": "One-line summary shown in the inbox.",
    "approval_request.payload": "Proposed change or context for the checker, e.g. before and after values of a "
                                "profile update.",
    "approval_request.amount": "Amount used to select levels with thresholds, e.g. sum covered.",
    "approval_request.status": "PENDING, APPROVED, REJECTED or WITHDRAWN.",
    "approval_request.current_level": "Level awaiting a decision.",
    "approval_request.total_levels": "Number of levels that apply to this request, fixed at submission.",
    "approval_request.level_permissions": "Permission required at each level, in order, fixed at submission so a "
                                          "later workflow change does not alter a request in flight.",
    "approval_request.maker_id": "User who raised the request. Cannot approve it.",
    "approval_request.maker_name": "Maker's name at the time.",
    "approval_request.agency_id": "Agency the request relates to, for portal visibility.",
    "approval_request.submitted_at": "When the request was raised.",
    "approval_request.decided_at": "When the request reached its final status.",
    "approval_request.final_remarks": "Remarks of the final decision.",
    "approval_action.request_id": "Request the action belongs to.",
    "approval_action.level": "Level acted on; 0 for submission.",
    "approval_action.action": "SUBMIT, APPROVE, REJECT or WITHDRAW.",
    "approval_action.actor_id": "User who acted.",
    "approval_action.actor_name": "Actor's name at the time.",
    "approval_action.remarks": "Remarks; mandatory for rejection.",
    # --- issue ------------------------------------------------------------------------------
    "issue.issue_no": "Issue reference IS/yy/nnnnnn issued from seq_issue_no.",
    "issue.title": "Short summary of the issue.",
    "issue.description": "Full description.",
    "issue.category": "Issue category code from master data.",
    "issue.priority": "CRITICAL, HIGH, MEDIUM or LOW; sets the SLA targets.",
    "issue.status": "OPEN, ASSIGNED, IN_PROGRESS, RESOLVED or CLOSED.",
    "issue.reported_by_id": "User who reported the issue.",
    "issue.reported_by_name": "Reporter's name at the time.",
    "issue.agency_id": "Reporter's agency, for portal users.",
    "issue.assigned_to_id": "Support user the issue is assigned to.",
    "issue.assigned_to_name": "Assignee's name at the time.",
    "issue.assigned_team": "Support team the issue is assigned to.",
    "issue.response_due_at": "Response target: creation time plus the response hours for the priority.",
    "issue.resolution_due_at": "Resolution target: creation time plus the resolution hours for the priority.",
    "issue.first_responded_at": "When support first responded.",
    "issue.resolved_at": "When the issue was resolved.",
    "issue.closed_at": "When the issue was closed.",
    "issue.sla_breached": "Set by the SLA monitor when a target is missed; support is alerted once.",
    "issue.resolution": "Resolution notes.",
    "issue_comment.issue_id": "Issue the comment belongs to.",
    "issue_comment.author_id": "User who wrote the comment.",
    "issue_comment.author_name": "Author's name at the time.",
    "issue_comment.body": "Comment text.",
    "issue_comment.internal": "True for back-office-only comments.",
    # --- notification -----------------------------------------------------------------------
    "notification.user_id": "Recipient user; null for external recipients such as participants and report "
                            "subscribers.",
    "notification.channel": "IN_APP, EMAIL or SMS.",
    "notification.recipient": "E-mail address, mobile number or user id, depending on the channel.",
    "notification.event_type": "Event that caused the notification, e.g. POLICY_ISSUED, APPROVAL_REQUIRED, "
                               "AGENCY_BLOCKED.",
    "notification.subject": "Subject line or in-app title.",
    "notification.body": "Message text. For sensitive messages (e.g. e-signature links) replaced with a "
                         "placeholder after delivery.",
    "notification.link": "Application path the in-app notification opens.",
    "notification.attachment_ids": "Documents attached to the e-mail.",
    "notification.sensitive": "True when the body must be removed once delivered.",
    "notification.status": "PENDING, SENT or FAILED (after notification.max_attempts attempts).",
    "notification.attempts": "Delivery attempts so far.",
    "notification.last_error": "Error from the last failed attempt.",
    "notification.read_at": "When the user read an in-app notification.",
    "notification.sent_at": "When the e-mail or SMS was accepted by the gateway.",
    # --- audit_log --------------------------------------------------------------------------
    "audit_log.id": "Sequential primary key; gives a total order of audit events.",
    "audit_log.occurred_at": "When the event happened (UTC).",
    "audit_log.actor_id": "User who performed the action; null for system jobs and inbound integrations.",
    "audit_log.actor_name": "Username of the actor, or 'system'.",
    "audit_log.action": "Event code, e.g. LOGIN, LOGIN_FAILED, ACCOUNT_LOCKED, APPROVAL_DECIDED, PRODUCT_UPDATED, "
                        "AGENCY_BLOCKED.",
    "audit_log.entity_type": "Type of record affected.",
    "audit_log.entity_id": "Id of the record affected.",
    "audit_log.before": "Values before the change. Passwords, hashes, encrypted identifiers, tokens and storage keys "
                        "are written as a fixed REDACTED marker.",
    "audit_log.after": "Values after the change, redacted in the same way.",
    "audit_log.ip_address": "Client IP address as seen through the reverse proxy.",
    "audit_log.user_agent": "Client browser user agent, truncated to 300 characters.",
    "audit_log.correlation_id": "Request correlation id (X-Request-Id); links the event to application logs.",
    # --- config_parameter / code_item ------------------------------------------------------------
    "config_parameter.key": "Parameter key, e.g. security.lockout.max_attempts.",
    "config_parameter.value": "Current value as text, interpreted according to value_type.",
    "config_parameter.value_type": "STRING, INTEGER, DECIMAL or BOOLEAN.",
    "config_parameter.category": "Grouping shown in the back-office, e.g. Security, Billing, Issue SLA.",
    "config_parameter.description": "What the parameter controls.",
    "config_parameter.min_value": "Lowest value accepted for numeric parameters.",
    "config_parameter.max_value": "Highest value accepted for numeric parameters.",
    "config_parameter.updated_by_id": "Administrator who last changed the value.",
    "code_item.category": "Code list name, e.g. DOCUMENT_TYPE, RELATIONSHIP, DISTRICT, BANK, CLAIM_TYPE.",
    "code_item.code": "Stable code stored on business records.",
    "code_item.label": "Label shown to users.",
    "code_item.active": "Inactive codes are hidden from new entries but remain valid on existing records.",
    "code_item.sort_order": "Display order within the list.",
    # --- outbox / integration -------------------------------------------------------------------
    "outbox_message.id": "Primary key; also sent as the Idempotency-Key header so the receiver can discard "
                         "duplicates.",
    "outbox_message.system": "Target system: CORE or FINANCE.",
    "outbox_message.operation": "Operation code from the interface specification, e.g. POLICY_ISSUED, "
                                "RECEIPT_POSTED, EOD_POSTING.",
    "outbox_message.payload": "JSON message body.",
    "outbox_message.status": "PENDING, SENT, FAILED (retry scheduled) or DEAD (attempts exhausted or not "
                             "retryable).",
    "outbox_message.attempts": "Delivery attempts so far.",
    "outbox_message.next_attempt_at": "Earliest time of the next attempt (exponential back-off, capped at 60 "
                                      "minutes).",
    "outbox_message.last_error": "Error from the last failed attempt.",
    "outbox_message.aggregate_type": "Type of business record that produced the message, e.g. Policy, Receipt.",
    "outbox_message.aggregate_id": "Id of the business record.",
    "outbox_message.correlation_id": "Correlation id of the request that produced the message.",
    "outbox_message.processed_at": "When the message was delivered.",
    "integration_log.system": "CORE, FINANCE, AML, EMAIL, SMS or DIRECTORY.",
    "integration_log.operation": "Operation or notification event code.",
    "integration_log.direction": "OUTBOUND (portal calls the system) or INBOUND (system calls the portal).",
    "integration_log.success": "Whether the call succeeded.",
    "integration_log.duration_ms": "Call duration in milliseconds.",
    "integration_log.reference": "Reference returned by the receiver, or the business reference of an inbound call. "
                                 "Simulated deliveries are marked '(simulated)'.",
    "integration_log.request_summary": "Short description of the request, e.g. aggregate type and id. Never the full "
                                       "payload.",
    "integration_log.response_summary": "Short description of the response.",
    "integration_log.error_message": "Error text for failed calls.",
    "integration_log.outbox_id": "Outbox message delivered by this call, if any.",
    "reconciliation_run.business_date": "Business date reconciled.",
    "reconciliation_run.system": "System reconciled against; FINANCE.",
    "reconciliation_run.expected_count": "Receipts issued by the portal on the date.",
    "reconciliation_run.matched_count": "Receipts also reported as posted by the financial system.",
    "reconciliation_run.expected_amount": "Total of receipts issued, in B$.",
    "reconciliation_run.matched_amount": "Total of matched receipts, in B$.",
    "reconciliation_run.status": "MATCHED or MISMATCH.",
    "reconciliation_run.details": "Unmatched receipt numbers for investigation.",
    "eod_run.business_date": "Business date processed; one run per date (a re-run updates the same row).",
    "eod_run.status": "RUNNING, COMPLETED or FAILED.",
    "eod_run.started_at": "When the run started.",
    "eod_run.finished_at": "When the run finished.",
    "eod_run.policies_issued": "Policies issued on the date.",
    "eod_run.receipts_issued": "Receipts issued on the date.",
    "eod_run.total_contribution": "Total contribution of policies issued, in B$.",
    "eod_run.total_receipts": "Total of receipts issued, in B$.",
    "eod_run.report_document_id": "EOD issuance report (Excel) stored as a document.",
    "eod_run.fin_file_document_id": "FIN interface file (CSV) stored as a document.",
    "eod_run.error_message": "Error text of a failed run.",
    "eod_run.triggered_by": "'Scheduler' or the name of the user who ran it from the back-office.",
    "report_schedule.report_code": "Report from the report catalogue, e.g. POLICY_REGISTER, COLLECTIONS.",
    "report_schedule.name": "Schedule name used in the e-mail subject.",
    "report_schedule.frequency": "DAILY (07:00), WEEKLY (Monday) or MONTHLY (1st), Brunei time.",
    "report_schedule.format": "XLSX, CSV or PDF.",
    "report_schedule.recipients": "E-mail addresses that receive the report.",
    "report_schedule.filters": "Report period, e.g. PREVIOUS_DAY, PREVIOUS_7_DAYS, PREVIOUS_MONTH, MONTH_TO_DATE.",
    "report_schedule.active": "Paused schedules are not run.",
    "report_schedule.last_run_at": "When the schedule last ran.",
    "report_schedule.next_run_at": "When the schedule runs next.",
    "report_schedule.created_by_id": "User who created the schedule.",
}

ENUMS = {
    "UserType": ("Kind of user account.", {
        "AGENT": "Agency agent or sub-agent using the portal.",
        "BANCA": "Bank officer using the portal.",
        "STAFF": "IIFT staff using the back-office."}),
    "UserStatus": ("State of a user account.", {
        "ACTIVE": "Can sign in.",
        "LOCKED": "Temporarily locked after repeated failed sign-ins; unlocks at locked_until or by an administrator.",
        "DISABLED": "Cannot sign in until re-activated."}),
    "AuthSource": ("Where the password is verified.", {
        "LOCAL": "Argon2id hash held in app_user.",
        "DIRECTORY": "Active Directory / LDAP bind."}),
    "Audience": ("Application a role or user belongs to.", {
        "PORTAL": "Agent/Banca Portal.",
        "BACKOFFICE": "Back-office."}),
    "Channel": ("Distribution channel of an agency.", {
        "AGENCY": "Agency channel.",
        "BANCA": "Bancatakaful channel (bank partner)."}),
    "AgencyStatus": ("State of an agency or bank.", {
        "ACTIVE": "Trading; users can sign in.",
        "INACTIVE": "Not trading; users cannot sign in.",
        "SUSPENDED": "Suspended by IIFT; users cannot sign in."}),
    "AgentType": ("Position in the distribution hierarchy.", {
        "MAIN_AGENT": "Main agent; may have sub-agents.",
        "SUB_AGENT": "Sub-agent reporting to a main agent.",
        "BANKER": "Bank officer."}),
    "AgentStatus": ("Registration status of an agent.", {
        "PENDING": "Registration awaiting approval.",
        "ACTIVE": "Approved and able to transact.",
        "INACTIVE": "Deactivated; cannot sign in.",
        "SUSPENDED": "Suspended; cannot sign in.",
        "TERMINATED": "Contract ended.",
        "REJECTED": "Registration rejected."}),
    "IdType": ("Identification document type.", {
        "NRIC": "Brunei identity card (IC).",
        "PASSPORT": "Passport.",
        "BUSINESS_REG": "Business registration number of a company."}),
    "ParticipantType": ("Kind of participant.", {
        "INDIVIDUAL": "Natural person.",
        "CORPORATE": "Company or organisation."}),
    "AmlStatus": ("AML/KYC outcome held on agents and participants.", {
        "NOT_SCREENED": "Not yet screened.",
        "CLEAR": "No match, or match cleared by Compliance.",
        "FLAGGED": "Potential match awaiting Compliance review; blocks submission.",
        "REJECTED": "Match confirmed by Compliance; business is refused."}),
    "AmlCaseStatus": ("State of a screening case.", {
        "AUTO_CLEARED": "Score below the threshold; no review needed.",
        "PENDING_REVIEW": "Score at or above the threshold; awaiting Compliance.",
        "CLEARED": "Compliance decided the match is false.",
        "CONFIRMED_MATCH": "Compliance confirmed the match."}),
    "PolicyStatus": ("Lifecycle status of a quotation or policy.", {
        "DRAFT": "Quotation being prepared; editable.",
        "PENDING_APPROVAL": "Referred to IIFT for approval or quality check.",
        "PENDING_PAYMENT": "Accepted; pay-first product awaiting verified payment before issuance.",
        "ACTIVE": "Issued and in force.",
        "REJECTED": "Rejected by a checker; can be reopened as a draft.",
        "EXPIRED": "Cover period ended.",
        "CANCELLED": "Cancelled after an approved cancellation request."}),
    "PolicyPaymentStatus": ("Payment state of a policy.", {
        "UNPAID": "No verified payment and none pending.",
        "PENDING_VERIFICATION": "Payment submitted, awaiting Finance.",
        "PAID": "Fully paid."}),
    "NomineeRole": ("Role of a person named on a policy.", {
        "NOMINEE": "Nominee.",
        "BENEFICIARY": "Beneficiary.",
        "EXECUTOR": "Executor."}),
    "PaymentMethod": ("How a payment was made.", {
        "BANK_TRANSFER": "Bank transfer.",
        "CHEQUE": "Cheque.",
        "CASH_DEPOSIT": "Cash deposited at a bank.",
        "ONLINE": "Online payment."}),
    "PaymentStatus": ("Verification state of a payment.", {
        "PENDING_VERIFICATION": "Awaiting Finance verification.",
        "VERIFIED": "Verified; receipts issued.",
        "REJECTED": "Rejected with a reason."}),
    "ClaimStatus": ("State of a claim notification.", {
        "SUBMITTED": "Notified by the agent.",
        "UNDER_REVIEW": "Being reviewed by IIFT.",
        "ACKNOWLEDGED": "Accepted and registered in the core system.",
        "REJECTED": "Not accepted.",
        "CLOSED": "Closed."}),
    "DocumentOwnerType": ("Type of record a document is attached to.", {
        "AGENT": "Agent profile.",
        "AGENCY": "Agency or bank.",
        "PARTICIPANT": "Participant.",
        "POLICY": "Quotation or policy.",
        "PAYMENT": "Payment.",
        "CLAIM": "Claim notification.",
        "ISSUE": "Issue.",
        "REPORT": "EOD run or report schedule."}),
    "DocumentStatus": ("Verification state of a document.", {
        "UPLOADED": "Uploaded, not yet checked.",
        "VERIFIED": "Accepted by a checker.",
        "REJECTED": "Rejected by a checker with remarks."}),
    "ApprovalType": ("Transaction types that run through maker-checker.", {
        "AGENT_REGISTRATION": "New agent or bank officer.",
        "AGENT_PROFILE_UPDATE": "Change to agent details or reporting line.",
        "AGENT_STATUS_CHANGE": "Activation, suspension, deactivation or termination.",
        "PARTICIPANT_UPDATE": "Change to participant details.",
        "POLICY_REFERRAL": "Referred application or quality check before issuance.",
        "POLICY_ENDORSEMENT": "Policy endorsement.",
        "POLICY_CANCELLATION": "Policy cancellation with refund.",
        "PAYMENT_VERIFICATION": "Verification of a payment and receipt issuance."}),
    "ApprovalStatus": ("State of an approval request.", {
        "PENDING": "Awaiting a decision at the current level.",
        "APPROVED": "All levels approved; the change has been applied.",
        "REJECTED": "Rejected at a level, with remarks.",
        "WITHDRAWN": "Withdrawn by the maker."}),
    "ApprovalActionType": ("Action recorded on an approval request.", {
        "SUBMIT": "Request raised.",
        "APPROVE": "Level approved.",
        "REJECT": "Request rejected.",
        "WITHDRAW": "Request withdrawn."}),
    "IssuePriority": ("Issue priority; selects SLA hours.", {
        "CRITICAL": "Service down or critical function unavailable.",
        "HIGH": "Major function impaired.",
        "MEDIUM": "Function impaired with a workaround.",
        "LOW": "Minor or cosmetic."}),
    "IssueStatus": ("State of an issue.", {
        "OPEN": "Reported, not assigned.",
        "ASSIGNED": "Assigned to a person or team.",
        "IN_PROGRESS": "Being worked on.",
        "RESOLVED": "Resolution provided.",
        "CLOSED": "Confirmed and closed."}),
    "NotificationChannel": ("Delivery channel.", {
        "IN_APP": "Bell icon in the portal or back-office.",
        "EMAIL": "E-mail through the SMTP relay.",
        "SMS": "SMS through the SMS gateway."}),
    "DeliveryStatus": ("Delivery state of a notification.", {
        "PENDING": "Waiting for delivery or retry.",
        "SENT": "Accepted by the gateway.",
        "FAILED": "Attempts exhausted."}),
    "IntegrationSystem": ("External system of an integration message or log entry.", {
        "CORE": "IITH core takaful system.",
        "FINANCE": "Financial system (FIN).",
        "AML": "External AML screening service.",
        "EMAIL": "SMTP relay.",
        "SMS": "SMS gateway.",
        "DIRECTORY": "Active Directory / LDAP."}),
    "OutboxStatus": ("Delivery state of an outbox message.", {
        "PENDING": "Waiting for first delivery.",
        "SENT": "Delivered.",
        "FAILED": "Failed; retry scheduled at next_attempt_at.",
        "DEAD": "Dead-letter: attempts exhausted or error not retryable; support alerted."}),
    "IntegrationDirection": ("Direction of an integration call.", {
        "OUTBOUND": "Portal calls the external system.",
        "INBOUND": "External system calls the portal."}),
    "JobStatus": ("State of an end-of-day run.", {
        "RUNNING": "In progress.",
        "COMPLETED": "Finished successfully.",
        "FAILED": "Finished with an error; can be re-run."}),
    "ReconciliationStatus": ("Outcome of a reconciliation run.", {
        "MATCHED": "Every receipt was found in the financial system.",
        "MISMATCH": "One or more receipts were not found."}),
    "ParameterType": ("Data type of a configuration parameter.", {
        "STRING": "Text.",
        "INTEGER": "Whole number.",
        "DECIMAL": "Decimal number.",
        "BOOLEAN": "true or false."}),
    "ReportFrequency": ("How often a scheduled report runs.", {
        "DAILY": "Every day at 07:00 Brunei time.",
        "WEEKLY": "Every Monday at 07:00.",
        "MONTHLY": "On the 1st of each month at 07:00."}),
    "ExportFormat": ("Report output format.", {
        "XLSX": "Excel workbook.",
        "CSV": "Comma-separated values.",
        "PDF": "PDF document."}),
    "CommissionStatus": ("Payment state of a commission accrual.", {
        "ACCRUED": "Accrued at issuance, not yet paid.",
        "PAID": "Payment confirmed by Finance."}),
}

SEQUENCES = {
    "seq_agent_code": ("Agent codes", "AG-000045 (agency) or BK-000012 (bank officer)", "agent.agent_code"),
    "seq_participant_no": ("Participant numbers", "PT/26/000123", "participant.participant_no"),
    "seq_quotation_no": ("Quotation numbers", "QT/26/000123", "policy.quotation_no"),
    "seq_policy_no": ("Policy numbers", "PRO/26/000045 (product code prefix)", "policy.policy_no"),
    "seq_payment_no": ("Payment references", "PY/26/000123", "payment.payment_no"),
    "seq_receipt_no": ("Receipt numbers", "RC/26/000123", "receipt.receipt_no"),
    "seq_claim_no": ("Claim notification numbers", "CL/26/000123", "claim.claim_no"),
    "seq_issue_no": ("Issue numbers", "IS/26/000123", "issue.issue_no"),
    "seq_request_no": ("Approval request numbers", "RQ/26/000123", "approval_request.request_no"),
}

CHECKS = {
    "policy_amounts_non_negative": "Contribution, sum covered and outstanding amount can never be negative.",
    "payment_amount_positive": "A payment must be for a positive amount.",
    "payment_allocation_amount_positive": "Each allocation of a payment to a policy must be positive.",
    "nominee_share_range": "A nominee's share is greater than 0 and at most 100 per cent.",
}

# Columns protected beyond normal access control.
PROTECTED = {
    "agent.id_number_enc": "Encrypted (AES-256-GCM, FIELD_ENCRYPTION_KEY)",
    "participant.id_number_enc": "Encrypted (AES-256-GCM, FIELD_ENCRYPTION_KEY)",
    "nominee.id_number_enc": "Encrypted (AES-256-GCM, FIELD_ENCRYPTION_KEY)",
    "agent.id_number_hash": "Blind index (HMAC-SHA256, FIELD_HASH_KEY)",
    "participant.id_number_hash": "Blind index (HMAC-SHA256, FIELD_HASH_KEY)",
    "app_user.password_hash": "One-way hash (Argon2id)",
    "password_history.password_hash": "One-way hash (Argon2id)",
    "signature_request.token_hash": "One-way hash (SHA-256 of one-time token)",
    "user_session.sess": "Holds the CSRF token; never exposed to the browser",
    "notification.body": "Removed after delivery when sensitive = true",
}
