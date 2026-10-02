"""Commercial chapters (commercials, validity, supporting information,
terms and conditions) and Annexes A–D."""

import brand
import compliance_matrix as cm
import pricing_data as price
from docx_kit import ProposalWriter
from numbering import sec

# =============================================================================
# 14. Commercial proposal
# =============================================================================
PRICING_PRINCIPLES = [
    ("Currency", "Brunei Dollars. USD figures are indicative at USD 1 = B$1.30, rounded to the nearest dollar; the "
                 "B$ amounts are binding."),
    ("Fixed price", "The one-time fee covers the full scope of this proposal. It is not time and materials."),
    ("Software licence", f"{brand.PRODUCT} licence bundled at B$0: perpetual, royalty-free and enterprise-wide for "
                         "IIFT and IITH group companies, unlimited named and concurrent users, no renewal fee. The "
                         f"{brand.PRODUCT} core platform remains iorta TechNXT's intellectual property."),
    ("Source code", "Source code of the deployed solution is delivered for maintenance and enhancement; escrow is "
                    "available as an option."),
    ("Subscriptions", "None (COM-03). Maintenance and support is the only recurring iorta charge."),
    ("WHT", "Inclusive. Fees are quoted gross; any Brunei withholding tax deducted by IIFT is borne by iorta, and "
            "IIFT pays the invoice net of WHT without grossing up."),
    ("OPE", f"Included for the {price.PLANNED_ONSITE_VISITS} planned onsite visits (kick-off, design workshop, "
            "UAT and training, go-live). Unplanned visits requested by IIFT follow the rate card, travel at cost."),
    ("Third-party charges", f"Excluded. Listed in section {sec('commercials')}.8; paid by IIFT directly or passed through at cost "
                            "without mark-up."),
    ("Infrastructure", "Under the recommended on-premise option IIFT/IITH provides hardware and OS and iorta "
                       "charges no hosting fee. PostgreSQL carries no licence fee."),
]

PRICING_BASIS = [
    "The price is sized to IIFT's scope as stated in the RFP: 26 named users, about 600 policies a year and seven "
    "products. It does not include per-user, per-policy or subscription charges, so it does not rise as IIFT adds "
    "agents, bank branches or group companies.",
    f"Most of the functionality already exists in {brand.PRODUCT}. IIFT pays for configuring, integrating, testing "
    "and supporting it for IIFT, not for building a platform. That is why the price is lower than a bespoke build "
    "of the same scope, and why delivery takes 24 weeks.",
    "Day rates and the maintenance fee reflect Brunei market levels for application support, and the five-year "
    "cost is spread so that the annual fee stays affordable for a business of IIFT's volume. Maintenance is flat "
    "for five years. [Bid owner to confirm the market comparison statement.]",
]


def _client_format_rows(portal_amount, backoffice_amount, total_label):
    def fee(amount):
        return f"B$ {amount:,} / USD {price.usd(amount):,}"
    return [
        ["Agent/Banca Portal", fee(portal_amount), "Inclusive", "Included", fee(portal_amount)],
        ["Back-office solution", fee(backoffice_amount), "Inclusive", "Included", fee(backoffice_amount)],
        [total_label, fee(portal_amount + backoffice_amount), "Inclusive", "Included",
         fee(portal_amount + backoffice_amount)],
    ]


def _amount(value):
    return "–" if value is None else (f"{value:,}" if value else "0")


def commercials(w: ProposalWriter):
    w.h1("Commercial Proposal")
    w.para("Fees are shown first in the format IIFT requested, then in the RFP section 10 breakdown. The pricing "
           "workbook (IIFT-Commercial-Pricing-iorta-TechNXT.xlsx) holds the same figures with live formulas.")

    w.h2("Fee summary in IIFT's requested format")
    widths = [3.6, 4.4, 2.0, 2.0, 5.0]
    w.table(["Description", "Fee", "WHT", "OPE", "Total"],
            _client_format_rows(price.one_time_portal(), price.one_time_backoffice(), "Total one-time fee"),
            widths=widths, total_rows=1, center_cols=(2, 3), bold_first_col=True,
            caption="One-time implementation fee (fixed price)")
    w.table(["Description", "Fee", "WHT", "OPE", "Total"],
            _client_format_rows(price.MAINTENANCE_ANNUAL_PORTAL, price.MAINTENANCE_ANNUAL_BACKOFFICE,
                                "Total per year (Years 1–5, flat)"),
            widths=widths, total_rows=1, center_cols=(2, 3), bold_first_col=True,
            caption="Annual maintenance and support fee, Years 1 to 5 (0% escalation)")
    w.callout("Notes", [
        f"Both lines are modules of {brand.PRODUCT}: Agent/Banca Portal ({brand.PRODUCT}) and Back-office solution "
        f"({brand.PRODUCT}). The {brand.PRODUCT} licence is bundled at B$0.",
        "**WHT, inclusive:** fees are quoted gross; withholding tax deducted under Brunei law is borne by iorta.",
        f"**OPE, included:** travel and subsistence for the {price.PLANNED_ONSITE_VISITS} planned onsite visits; no "
        "separate OPE is invoiced.",
        "**Third-party charges, excluded:** SMS messages, AML data subscription, SSL certificates, e-mail relay and "
        f"infrastructure, at cost (section {sec('commercials')}.8).",
        f"USD amounts are indicative (USD 1 = B$ {price.FX_BND_PER_USD:.2f}), each rounded to the nearest dollar.",
    ])

    w.h2("Pricing basis")
    w.paras(PRICING_BASIS)

    w.h2("Pricing principles")
    w.table(["Item", "Basis"], [[k, v] for k, v in PRICING_PRINCIPLES], widths=[3.4, 13.6], font_size=8,
            bold_first_col=True)

    w.h2("Commercial pricing breakdown (RFP section 10)")
    rows, highlight = [], []
    for row in price.rfp_section10_rows():
        total = (row["portal"] + row["backoffice"]) if row["portal"] is not None else None
        if row["no"] == 11:
            amounts = ["Included", "Included", "Included"]
        elif total is None:
            amounts = ["–", "–", row["text"]]
        else:
            amounts = [_amount(row["portal"]), _amount(row["backoffice"]), _amount(total)]
        rows.append([str(row["no"]), row["component"], row["basis"], *amounts, row["remark"]])
        if row["no"] == 11:
            highlight.append(len(rows))
            rows.append(["", "Subtotal one-time (items 1–11)", "One-off", f"{price.one_time_portal():,}",
                         f"{price.one_time_backoffice():,}", f"{price.one_time_total():,}",
                         "Fixed price; WHT inclusive; planned OPE included"])
        if row["no"] == 16:
            highlight.append(len(rows))
            rows.append(["", "Subtotal maintenance Years 1–5 (items 12–16)", "Annual",
                         f"{price.MAINTENANCE_ANNUAL_PORTAL * 5:,}", f"{price.MAINTENANCE_ANNUAL_BACKOFFICE * 5:,}",
                         f"{price.maintenance_total():,}", "Flat, 0% escalation"])
    w.table(["No", "Component", "Basis", "Portal (B$)", "Back-office (B$)", "Total (B$) / rate", "Remarks"], rows,
            widths=[0.8, 3.6, 1.7, 1.7, 1.8, 3.0, 4.4], font_size=7.5, align_right_cols=(3, 4),
            center_cols=(0,), highlight_rows=highlight, caption="RFP section 10 commercial pricing breakdown")

    w.h2("Integration cost per interface")
    rows = [[name, scope, f"{portal:,}", f"{backoffice:,}", f"{portal + backoffice:,}"]
            for name, scope, portal, backoffice in price.INTERFACES]
    rows.append(["Total integration (item 3)", "", f"{price.integration_portal():,}",
                 f"{price.integration_backoffice():,}", f"{price.integration_portal() + price.integration_backoffice():,}"])
    w.table(["Interface", "Scope", "Portal (B$)", "Back-office (B$)", "Total (B$)"], rows,
            widths=[3.4, 7.0, 2.1, 2.4, 2.1], font_size=8, align_right_cols=(2, 3, 4), total_rows=1,
            bold_first_col=True, caption="Integration cost per interface (COM-05)")

    w.h2("Five-year maintenance and support")
    rows = [[f"Year {year}", focus, f"{price.MAINTENANCE_ANNUAL_PORTAL:,}", f"{price.MAINTENANCE_ANNUAL_BACKOFFICE:,}",
             f"{price.maintenance_annual():,}"] for _, year, focus, _ in price.MAINTENANCE_PLAN]
    rows.append(["Total", "Five years", f"{price.MAINTENANCE_ANNUAL_PORTAL * 5:,}",
                 f"{price.MAINTENANCE_ANNUAL_BACKOFFICE * 5:,}", f"{price.maintenance_total():,}"])
    w.table(["Year", "Focus (RFP section 9)", "Portal (B$)", "Back-office (B$)", "Total (B$)"], rows,
            widths=[2.0, 6.6, 2.7, 3.0, 2.7], align_right_cols=(2, 3, 4), total_rows=1, bold_first_col=True,
            caption="Maintenance fees by year")
    w.para(f"Maintenance is billed {price.MAINTENANCE_BILLING.lower()} "
           f"({price.bnd(price.maintenance_annual() / 4)} per quarter). Section {sec('maintenance')} describes the "
           "services.")

    w.h2("Infrastructure, hosting and database")
    cloud_total = price.cloud_annual() + price.CLOUD_MANAGED_OPERATIONS_ANNUAL
    w.table(["Item", "Basis", "Option A: on-premise", "Option B: cloud (optional)"], [
        ["Hosting / cloud infrastructure (item 5)", "Annual", "B$ 0 (IIFT/IITH-provided)",
         f"≈ {price.bnd(price.cloud_annual())} pass-through ({price.bnd(price.cloud_monthly())}/month)"],
        ["Managed cloud operations", "Annual", "Not applicable", price.bnd(price.CLOUD_MANAGED_OPERATIONS_ANNUAL)],
        ["Database licence (item 6)", "Annual", "B$ 0 (PostgreSQL)", "Included in managed service above"],
        ["Total per year", "", "B$ 0", f"≈ {price.bnd(cloud_total)}"],
    ], widths=[5.0, 1.8, 4.4, 5.8], total_rows=1, bold_first_col=True, caption="Infrastructure and database costs")

    w.h2("Third-party charges (excluded, at cost)")
    w.para("Third-party charges are excluded from iorta's fees and payable at cost. Amounts are indicative and are "
           "confirmed by each provider.")
    w.table(["Item", "Basis", "Provider / note", "Indicative amount"], [list(t) for t in price.THIRD_PARTY_CHARGES],
            widths=[4.4, 2.6, 4.6, 5.4], font_size=8, caption="Third-party dependencies and charges (COM-17, item 20)")
    w.para(f"Third-party components inside {brand.PRODUCT} are open source (MIT, Apache 2.0, BSD or PostgreSQL "
           "licence) and carry no fees. A software bill of materials comes with the technical manual.")

    w.h2("Rate card")
    w.table(["Item", "Rate", "Notes"], [
        ["Enhancements / change requests (item 17)",
         f"B$ {price.ENHANCEMENT_DAY_RATE:,} per man-day; B$ {price.ENHANCEMENT_HOUR_RATE} per hour",
         f"{price.ENHANCEMENT_HOURS_PER_YEAR} hours per year included in maintenance"],
        ["Onsite support, unplanned (item 18)", f"B$ {price.ONSITE_DAY_RATE:,} per day + travel at cost",
         f"{price.PLANNED_ONSITE_VISITS} planned visits included in the fixed price"],
        ["After-hours support (item 19)", f"P1: included. Other: B$ {price.AFTER_HOURS_HOUR_RATE} per hour",
         "Other after-hours work only at IIFT's request"],
        ["Exit / transition (item 21)", "Included in Year 5 maintenance", f"See Section {sec('maintenance')}"],
    ], widths=[5.4, 6.0, 5.6], bold_first_col=True, caption="Rate card (COM-16)")

    w.h2("Payment milestones")
    rows = [[code, trigger, f"{share:.0%}", f"{round(price.one_time_total() * share):,}"]
            for code, trigger, share in price.PAYMENT_MILESTONES]
    rows.append(["Total", "", "100%", f"{price.one_time_total():,}"])
    w.table(["Milestone", "Payment trigger", "Share", "Amount (B$)"], rows, widths=[2.2, 9.6, 2.0, 3.2],
            center_cols=(0, 2), align_right_cols=(3,), total_rows=1, caption="One-time fee payment schedule")
    w.para("Invoices are payable within 30 days. Maintenance is invoiced quarterly in advance from go-live.")

    w.h2("Five-year total cost of ownership")
    cloud_5y = price.MAINTENANCE_YEARS * price.cloud_annual()
    ops_5y = price.MAINTENANCE_YEARS * price.CLOUD_MANAGED_OPERATIONS_ANNUAL
    w.table(["Cost element", "Option A: on-premise (B$)", "Option B: cloud (B$)"], [
        ["One-time implementation", f"{price.one_time_total():,}", f"{price.one_time_total():,}"],
        ["Software licence (5 years)", "0", "0"],
        ["Maintenance & support (5 years)", f"{price.maintenance_total():,}", f"{price.maintenance_total():,}"],
        ["Cloud infrastructure pass-through (5 years, indicative)", "0", f"{cloud_5y:,}"],
        ["Managed cloud operations (5 years)", "0", f"{ops_5y:,}"],
        ["Five-year TCO (B$)", f"{price.tco_on_prem():,}", f"{price.tco_cloud():,}"],
        ["Five-year TCO (USD, indicative)", f"{price.usd(price.tco_on_prem()):,}", f"{price.usd(price.tco_cloud()):,}"],
    ], widths=[8.2, 4.4, 4.4], align_right_cols=(1, 2), total_rows=2, bold_first_col=True,
        caption="Five-year TCO (excluding IIFT-provided infrastructure and third-party charges)")


# =============================================================================
# 19. Validity
# =============================================================================
def validity(w: ProposalWriter):
    w.h1("Quotation Validity", new_page=False)
    w.paras([
        f"This proposal and the prices quoted are valid for **{price.QUOTATION_VALIDITY_DAYS} days from the date of "
        "submission** ([submission date] to [expiry date]).",
        "On award, the one-time fee is fixed for the implementation and the maintenance fee is fixed for five years. "
        "Indicative cloud charges (Option B) and third-party charges follow the providers' prices at the time of "
        "order.",
    ])


# =============================================================================
# 20. Supporting information
# =============================================================================
VALUE_ADDS = [
    ["Requirements compliance matrix", "All 234 requirement IDs answered line by line, with fitment (Annex A)."],
    ["Working application before contract", f"IIFT can test {brand.PRODUCT} with its own products before signing."],
    ["Multi-factor authentication", "E-mail OTP or authenticator app for back-office users, delivered during implementation."],
    ["Remote participant e-signature", "Single-use e-mail link, so participants can sign without visiting a branch."],
    ["Integration monitor", "One screen for outbox messages, retries, dead-letters and reconciliation results."],
    ["End-of-day run screen", "Run, check and sign off EOD, the FIN file and reconciliation, with run history."],
    ["Retention and archival policy", "Retention period per data class, with archival of audit records and documents."],
    ["PDPO 2025 and AMBD alignment", f"Controls mapped to Brunei data protection law and AMBD expectations (Section {sec('security')})."],
    ["Shariah-appropriate terminology", "Contribution, participant, Takaful operator, wakalah and tabarru' throughout."],
    ["Accessibility", "WCAG 2.1 AA target."],
    ["Source code escrow option", "Independent escrow in addition to source code delivery, if IIFT wants it."],
    ["Exit plan", f"Transition, data extraction and knowledge transfer defined now (Section {sec('maintenance')})."],
    ["Hardware sizing", f"Sizing for every environment for the on-premise option (Section {sec('infrastructure')})."],
    ["Unlimited users", "More banks, agents and group companies at no licence cost."],
]

def supporting_information(w: ProposalWriter):
    w.h1("Supporting Information")
    w.h2("Value-added items beyond the RFP")
    w.table(["Item", "Benefit to IIFT"], VALUE_ADDS, widths=[5.4, 11.6], font_size=8, bold_first_col=True,
            caption="Value-added items included at no extra cost")
    w.para(f"Further supporting material: the technical document pack (Section {sec('techdocs')}), the screen "
           f"catalogue with sample screens (Section {sec('screens')}) and the pricing workbook.")


# =============================================================================
# 21. Terms and conditions
# =============================================================================
TERMS = [
    ("Basis of contract", "This proposal, the RFP and agreed clarifications form the basis for a definitive agreement to "
     "be negotiated in good faith. In case of conflict, the signed agreement prevails."),
    ("Prices and taxes", f"Prices are in Brunei Dollars, fixed as set out in Section {sec('commercials')}. Fees are inclusive of withholding "
     "tax, which is borne by iorta TechNXT. Planned out-of-pocket expenses are included. Third-party charges are "
     "excluded and payable at cost. Should new taxes be introduced by law after submission, the parties will agree "
     "their treatment."),
    ("Payment terms", f"One-time fees are invoiced on achievement of the payment milestones in Section {sec('commercials')}.10 and are "
     "payable within 30 days of invoice. Maintenance fees are invoiced quarterly in advance from go-live."),
    ("Acceptance", "Deliverables and milestones are accepted by written sign-off against agreed acceptance criteria. "
     "IIFT will review within ten business days; a deliverable is deemed accepted if no material non-conformity is "
     "notified within that period or if it is used in production."),
    ("Intellectual property", f"The {brand.PRODUCT} core platform remains the intellectual property of iorta "
     f"TechNXT. IIFT receives a perpetual, royalty-free, enterprise-wide licence to use {brand.PRODUCT} for unlimited "
     "users, covering IIFT and IITH group companies; the licence fee is B$0 and is bundled in this proposal. "
     "Configurations, reports, documentation and other work products produced specifically for IIFT belong to IIFT. "
     "Open-source components remain under their own licences."),
    ("Source code and escrow", "The full source code of the deployed solution, with build scripts, database "
     "migrations and deployment configuration, is delivered at go-live and with every later release, so that IIFT or "
     "a provider it appoints can maintain and enhance the solution under the licence above. Deposit with an "
     "independent escrow agent is available as an option; escrow fees are payable by IIFT."),
    ("Data ownership and protection", "All business data, including participant, agent and transaction data and "
     "documents, always remains the property of IITH/IIGT/IIFT. iorta TechNXT processes personal data only on IIFT's "
     f"instructions and for the purpose of the contract, applies the security controls in Section {sec('security')}, supports IIFT's "
     "obligations under the Personal Data Protection Order 2025 and returns or securely deletes data at contract end."),
    ("Confidentiality", "Each party keeps the other's confidential information confidential, uses it only for the "
     "contract and discloses it only to personnel and approved subcontractors bound by equivalent obligations. These "
     "obligations survive termination for [five] years, and indefinitely for personal data."),
    ("Warranty", f"iorta TechNXT warrants that the solution will perform materially in accordance with the approved "
     f"specifications for {price.WARRANTY_MONTHS} months from production go-live and will correct reported defects "
     "at no charge within the SLA. The warranty does not cover issues caused by changes made by others, misuse, "
     "infrastructure or third-party products outside iorta's scope."),
    ("Service levels and service credits", f"Service levels are as defined in Section {sec('maintenance')}. Where a P1 restoration "
     "target is missed, service credits apply: [e.g. 5% of the quarterly maintenance fee per breach, capped at 20% "
     "of the quarterly fee]. Service credits are IIFT's financial remedy for SLA failure without prejudice to "
     "termination rights for persistent failure."),
    ("Limitation of liability", "Each party's total aggregate liability under the contract is limited to [the total "
     "contract value (fees paid and payable for implementation and the current maintenance year)]. Neither party is "
     "liable for indirect or consequential loss. The limitation does not apply to liability for fraud, wilful "
     "misconduct, breach of confidentiality or infringement of intellectual property."),
    ("Change requests", "Changes to scope follow the change request process: written request, impact assessment "
     "(scope, cost, schedule, risk) within five business days, quotation using the rate card, written approval before "
     "work starts."),
    ("Price protection", "Maintenance fees are fixed for five years with 0% escalation. [Confirm: rate card held "
     "without escalation for the five-year term.]"),
    ("Personnel and subcontracting", "Key personnel are not replaced without IIFT's consent. The independent VAPT is "
     "performed by a qualified third-party tester engaged by iorta with IIFT's approval; iorta remains responsible "
     "for its subcontractors."),
    ("Term and termination", "Either party may terminate for material breach not remedied within 30 days of notice. "
     "IIFT may terminate for convenience on [90] days' notice, paying for work performed and accepted up to the "
     f"termination date. On any termination, iorta provides the exit assistance in Section {sec('maintenance')} and hands over work in "
     "progress and the source code of the deployed solution."),
    ("Force majeure", "Neither party is liable for delay or failure caused by events beyond its reasonable control "
     "(including natural disasters, pandemics, war, government action or widespread utility or network failure), "
     "provided it notifies the other party promptly and uses reasonable efforts to mitigate. If force majeure "
     "continues for more than 60 days, either party may terminate the affected services."),
    ("Governing law and disputes", "The contract is governed by the laws of Brunei Darussalam. Disputes are first "
     "escalated through the governance structure; unresolved disputes are referred to [mediation / arbitration in "
     "Brunei Darussalam] and, failing that, to the courts of Brunei Darussalam."),
    ("Validity", f"This proposal is valid for {price.QUOTATION_VALIDITY_DAYS} days from the submission date."),
]


def terms_and_conditions(w: ProposalWriter):
    w.h1("Terms & Conditions")
    w.para("We propose the key terms below and are willing to work from IIFT's standard contract in negotiation.")
    for number, (title, text) in enumerate(TERMS, start=1):
        w.para(f"**{w.chapter}.{number} {title}.** {text}", align="justify")


# =============================================================================
# Annexes
# =============================================================================
CV_ROLES = ["Project Manager", "Solution Architect", "Business Analyst (Takaful)", "Technical Lead",
            "QA Lead", "DevOps & Security Engineer"]
CV_COLUMNS = ["Proposed role", "Name", "Qualifications", "Years of experience (insurance/Takaful)",
              "Relevant projects (project, client, role, year)"]


SOFTWARE = [
    ["Operating system", "Linux: RHEL 9 or Ubuntu Server 24.04 LTS (64-bit)", "IIFT/IITH"],
    ["Container runtime", "Docker Engine 27+ with Compose (or Kubernetes 1.30+)", "Open source"],
    ["Reverse proxy", "Nginx 1.26+ (or existing F5 / WAF)", "Open source / existing"],
    ["Application runtime", "Node.js 22 LTS (inside container images)", "Open source"],
    ["Database", "PostgreSQL 16+ with streaming replication; pgBackRest or equivalent for backup/PITR", "Open source"],
    ["Object storage (optional)", "MinIO (S3-compatible) or NFS share", "Open source / existing"],
    ["Monitoring", "Prometheus, Grafana, Loki (or existing IITH tooling)", "Open source / existing"],
    ["Antivirus (optional)", "ClamAV for document uploads", "Open source"],
]

PORTS = [
    ["Internet / bank network", "WAF / load balancer", "443 (HTTPS)", "Portal and e-sign"],
    ["IIFT LAN", "Internal reverse proxy", "443 (HTTPS)", "Back-office"],
    ["Load balancer / proxy", "Application VMs", "8080 (HTTP, internal only) or 443", "Application traffic"],
    ["Application VMs", "PostgreSQL", "5432 (TLS)", "Database"],
    ["Application VMs", "Active Directory", "636 (LDAPS)", "Back-office SSO"],
    ["Application VMs", "SMTP relay", "587 (STARTTLS)", "E-mail"],
    ["Application VMs", "Core / FIN / AML / SMS", "443 (HTTPS) or 22 (SFTP)", "Integrations"],
    ["Monitoring server", "Application VMs", "9100 / 9464 (metrics)", "Monitoring"],
    ["PostgreSQL primary", "Standby / DR replica", "5432 (TLS)", "Replication"],
]

GLOSSARY = [
    ["Takaful", "Islamic insurance based on mutual co-operation and shared responsibility, in which participants "
                "contribute to a common fund to help one another against defined risks."],
    ["Takaful operator", "The company (here IIFT) that manages the Takaful fund on behalf of participants."],
    ["Participant", "The person or entity that joins a Takaful plan and makes contributions (the Takaful equivalent "
                    "of a policyholder)."],
    ["Contribution", "The amount paid by the participant for Takaful cover (the Takaful equivalent of a premium)."],
    ["Tabarru'", "The portion of the contribution donated to the participants' risk fund to help fellow participants "
                 "who suffer a covered loss."],
    ["Wakalah", "An agency contract under which the Takaful operator manages the fund for a fee (wakalah fee)."],
    ["Participants' risk fund", "The fund made up of tabarru' contributions from which claims are paid."],
    ["Nominee / beneficiary / executor", "Persons designated to receive Takaful benefits or administer them on the "
                                         "participant's behalf."],
    ["Mortgage Takaful", "Decreasing-term Takaful protecting a financing facility (hire purchase or property)."],
    ["Banca / bancassurance", "Distribution of Takaful products through bank partners and bank officers."],
    ["Main agent / sub-agent", "Hierarchical agency relationship in which a main agent supervises sub-agents."],
    ["e-Policy / e-Receipt", "Electronic policy document and receipt issued to the participant."],
    ["Grace period", "Period (seven days) within which payment for an issued policy must be submitted before the "
                     "agency's issuance is blocked."],
    ["Maker-checker", "Control in which a transaction prepared by one user (maker) must be approved by another "
                      "(checker) before it takes effect."],
    ["Quality check (QC)", "Review of an application by IIFT before contract issuance."],
    ["End-of-day (EOD)", "Daily batch that produces issuance reports, interfaces postings to FIN and reconciles with BRR."],
    ["Transactional outbox", "Integration pattern in which outbound messages are stored in the same database "
                             "transaction as the business change and delivered asynchronously, guaranteeing no loss."],
    ["Dead-letter", "Holding area for messages that could not be delivered after the maximum number of retries."],
    ["Blind index", "Keyed hash of an encrypted value that allows exact-match search without decrypting data."],
    ["Modular monolith", "Single deployable application internally divided into independent modules with clear "
                         "boundaries."],
    ["Hypercare", "Period of intensified support immediately after go-live."],
    ["Point-in-time recovery", "Ability to restore the database to any moment using base backups and transaction logs."],
]


def annexes(w: ProposalWriter):
    w.landscape_section()
    w.h1("Annex A – Requirements Compliance and Fitment Matrix", numbered=False, new_page=False)
    w.para("Every requirement ID in the RFP is listed. **Compliance**: Fully Compliant is a standard capability of the "
           "delivered solution; Compliant – configuration is met by setting rules, parameters or master data; "
           "Compliant – custom is met by IIFT-specific work inside the fixed price. **Fitment** uses the four "
           f"categories in Section {sec('fitment')}. Priority follows RFP Appendix 4. The RFP uses the prefix COM for "
           "both shared platform (section 4.4) and commercial (section 6) requirements; each set is listed under its "
           "section, and commercial items carry no fitment.")
    rows = []
    for group_index, (group, items) in enumerate(cm.MATRIX):
        rows.append(("GROUP", group))
        for rid, requirement, priority, compliance, how in items:
            code = cm.fitment(group_index, rid)
            rows.append([rid, requirement, cm.PRIORITY_LABELS[priority], cm.COMPLIANCE_LABELS[compliance],
                         cm.FITMENT_LABELS[code] if code else "Commercial", how])
    w.table(["ID", "Requirement", "Priority", "Compliance", "Fitment", "How addressed"], rows,
            widths=[1.6, 4.8, 1.4, 3.1, 3.4, 11.4], font_size=7.5, center_cols=(2,), bold_first_col=True,
            padding=20, caption="Requirements compliance and fitment matrix")

    w.portrait_section()
    w.h1("Annex B – Curricula Vitae of Key Personnel", numbered=False, new_page=False)
    w.para(f"Key personnel from Section {sec('team')} are summarised below; full CVs are attached. [Complete the "
           "table and attach one CV per person.]")
    w.table(CV_COLUMNS, [[role, "[Full name]", "[Degrees, certifications]", "[Years]", "[3 to 5 projects]"]
                         for role in CV_ROLES], widths=[3.4, 2.8, 3.4, 2.8, 4.6], font_size=8, bold_first_col=True,
            caption="Key personnel summary")

    w.h1("Annex C – Software Components and Network Flows", numbered=False)
    w.para(f"Server sizing per environment is in Section {sec('infrastructure')}. This annex lists the software "
           "stack, network flows and expected storage growth for the on-premise option.")
    w.table(["Layer", "Software", "Licence / source"], SOFTWARE, widths=[3.8, 9.4, 3.8], font_size=8,
            caption="Software components")
    w.table(["From", "To", "Port / protocol", "Purpose"], PORTS, widths=[4.0, 4.4, 4.4, 4.2], font_size=8,
            caption="Network flows")
    w.table(["Data", "Year 1", "Year 5", "Notes"], [
        ["Structured data (PostgreSQL)", "< 1 GB", "< 5 GB", "Policies, participants, payments, audit"],
        ["Documents", "10–20 GB", "50–100 GB", "Uploads and system-produced PDFs"],
        ["Logs (online)", "About 20 GB", "About 20 GB", "Rolling retention; archived to backup"],
        ["Backups", "About 150 GB", "About 600 GB", "35 days online plus monthly copies"],
    ], widths=[4.6, 2.6, 2.6, 7.2], font_size=8, caption="Storage growth estimate")

    w.h1("Annex D – Glossary", numbered=False, new_page=False)
    w.table(["Term", "Meaning"], GLOSSARY, widths=[4.4, 12.6], font_size=8, bold_first_col=True)
