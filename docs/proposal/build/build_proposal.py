"""Build the IIFT Agent/Banca Portal & Back-office tender proposal (.docx).

Usage:
    python docs/proposal/build/build_proposal.py

The document is assembled from section functions. Each section keeps its
wording in plain Python lists/tuples so the text can be edited without
touching the layout helpers in docx_kit.py. All prices come from
pricing_data.py. Diagrams are drawn fresh on every run (diagrams.py), and
screenshots are picked up from docs/proposal/screenshots/ when present.
"""

import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import brand                      # noqa: E402
import diagrams                   # noqa: E402
import pricing_data as price      # noqa: E402
from docx_kit import ProposalWriter, add_rich_text   # noqa: E402
from docx.shared import Pt, Cm    # noqa: E402
from docx.enum.text import WD_ALIGN_PARAGRAPH        # noqa: E402
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT  # noqa: E402

import sections_commercial        # noqa: E402
import sections_delivery          # noqa: E402
import sections_people            # noqa: E402
import sections_scope             # noqa: E402
import sections_solution          # noqa: E402
from numbering import CHAPTERS, sec   # noqa: E402

GANTT_PHASES = [
    ("0  Mobilisation", 1, 2, "build"),
    ("1  Discovery and fit-gap confirmation", 2, 6, "build"),
    ("2  Configuration sprints 1–5", 6, 16, "build"),
    ("3  Integration with IIFT systems", 8, 17, "build"),
    ("4  SIT, performance, VAPT", 16, 19, "build"),
    ("5  UAT, migration rehearsals, training", 19, 23, "build"),
    ("6  Cut-over and go-live", 24, 24, "gate"),
    ("7  Hypercare and closure", 25, 28, "support"),
]
MILESTONES = [
    ("M1", 2, "Project charter & plan approved"),
    ("M2", 6, "Design sign-off"),
    ("M3", 16, "Configuration complete"),
    ("M4", 19, "SIT exit & security clearance"),
    ("M5", 22, "UAT sign-off"),
    ("M6", 24, "Production go-live"),
    ("M7", 28, "Hypercare exit & closure"),
]


# --- Figures ----------------------------------------------------------------------
def render_figures(out_dir: Path) -> dict:
    return {
        "logical": diagrams.logical_architecture(out_dir),
        "on_prem": diagrams.on_prem_deployment(out_dir),
        "cloud": diagrams.cloud_deployment(out_dir),
        "integration": diagrams.integration_flow(out_dir),
        "lifecycle": diagrams.policy_lifecycle(out_dir),
        "governance": diagrams.governance_structure(out_dir),
        "gantt": diagrams.gantt_chart(out_dir, GANTT_PHASES, MILESTONES),
        "cover_band": diagrams.cover_band(out_dir),
        "out_dir": out_dir,
    }


# --- Cover page -----------------------------------------------------------------------
def _wordmark(paragraph, size=26):
    """Text wordmark used when no iorta logo image is supplied."""
    add_rich_text(paragraph, "iorta", size=size, colour=brand.MAGENTA, bold=True)
    add_rich_text(paragraph, " TechNXT", size=size, colour=brand.TEXT_DARK, bold=False)


def cover_page(w: ProposalWriter, figs: dict):
    doc = w.doc
    top = doc.add_paragraph()
    top.paragraph_format.space_after = Pt(30)
    if brand.IORTA_LOGO.exists():
        top.add_run().add_picture(str(brand.IORTA_LOGO), height=Cm(1.6))
    else:
        _wordmark(top)

    w.image(figs["cover_band"], width_cm=17.0)
    w.spacer(18)
    w.para(brand.PROPOSAL_TITLE, size=27, colour=brand.MAGENTA, bold=True, space_after=10)
    w.para(f"{brand.PRODUCT}, configured for IIFT as the {brand.SOLUTION_NAME}", size=14,
           colour=brand.ORANGE, bold=True, space_after=6)
    w.para("Technical and commercial proposal in response to IIFT's Request for Proposal", size=12,
           colour=brand.TEXT_MUTED, space_after=36)

    table = doc.add_table(rows=2, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    logo_cell, client_cell = table.rows[0].cells
    logo_cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    logo_cell.paragraphs[0].add_run().add_picture(str(brand.CLIENT_LOGO), height=Cm(3.6))
    client_cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    for text, size, colour, bold in (
        ("PREPARED FOR", 9, brand.ORANGE, True),
        (brand.CLIENT, 15, brand.TEXT_DARK, True),
        ("Insurans Islam TAIB Holding (IITH) group", 10, brand.TEXT_MUTED, False),
        ("Bandar Seri Begawan, Brunei Darussalam", 10, brand.TEXT_MUTED, False),
    ):
        paragraph = client_cell.add_paragraph() if client_cell.paragraphs[0].text or text != "PREPARED FOR" else client_cell.paragraphs[0]
        paragraph.paragraph_format.space_after = Pt(3)
        add_rich_text(paragraph, text, size=size, colour=colour, bold=bold)

    spacer_cell, bidder_cell = table.rows[1].cells
    spacer_cell.paragraphs[0].paragraph_format.space_before = Pt(24)
    first = bidder_cell.paragraphs[0]
    first.paragraph_format.space_before = Pt(24)
    for index, (text, size, colour, bold) in enumerate((
        ("SUBMITTED BY", 9, brand.ORANGE, True),
        (brand.BIDDER, 15, brand.TEXT_DARK, True),
        (brand.BIDDER_WEBSITE, 10, brand.TEXT_MUTED, False),
    )):
        paragraph = first if index == 0 else bidder_cell.add_paragraph()
        paragraph.paragraph_format.space_after = Pt(3)
        add_rich_text(paragraph, text, size=size, colour=colour, bold=bold)
    from docx_kit import set_column_widths
    set_column_widths(table, [3.4, 13.6])

    w.spacer(30)
    w.key_value_table([
        ("Submission date", brand.SUBMISSION_DATE),
        ("Proposal reference no.", "[Proposal reference no.]"),
        ("RFP reference", "[IIFT RFP / tender reference no.]"),
        ("Document version", brand.DOCUMENT_VERSION),
        ("Classification", brand.CLASSIFICATION),
    ], widths=(5.0, 12.0))
    w.spacer(16)
    w.para(f"{brand.CLASSIFICATION}. This proposal contains confidential commercial information of "
           f"{brand.BIDDER} and is submitted solely for the evaluation of the above RFP by "
           f"{brand.CLIENT}. It may not be disclosed to third parties without prior written consent.",
           size=8, colour=brand.TEXT_MUTED, italic=True)


# --- Front matter ----------------------------------------------------------------------
def document_control(w: ProposalWriter):
    w.h1("Document Control", numbered=False)
    w.h3("Version history")
    w.table(["Version", "Date", "Author", "Description"],
            [["0.9", "[Date]", brand.BIDDER, "Internal review draft"],
             [brand.DOCUMENT_VERSION, brand.SUBMISSION_DATE, brand.BIDDER, "Submission version"]],
            widths=[2.2, 3.3, 4.0, 7.5])
    w.h3("Review and approval")
    w.table(["Role", "Name", "Signature / date"],
            [["Prepared by (Bid Manager)", "[Name]", ""],
             ["Reviewed by (Solution Architect)", "[Name]", ""],
             ["Approved by (Authorised Signatory)", "[Name, designation]", ""]],
            widths=[6.0, 6.0, 5.0])
    w.h3("Distribution")
    w.table(["Recipient", "Organisation", "Format"],
            [["Tender / Evaluation Committee", brand.CLIENT, "Signed PDF and editable DOCX; pricing workbook (XLSX)"],
             ["Bid file", brand.BIDDER, "Archive copy"]],
            widths=[6.0, 6.0, 5.0])
    w.h3("Companion documents")
    w.bullets([
        "IIFT-Commercial-Pricing-iorta-TechNXT.xlsx: the commercial workbook (summary in the format "
        "requested by IIFT, RFP section 10 breakdown, integration per interface, five-year maintenance, "
        "rate card, payment milestones, third-party charges and assumptions).",
        "Enclosure B: corporate profile and relevant experience (attached separately).",
        "Enclosure C: business registration certificate (attached separately).",
        "Technical document pack in docs/technical: solution architecture, data dictionary, code standards and "
        "quality report, security assessment report, production support handover.",
    ])


def response_map(w: ProposalWriter):
    w.h1("How this Proposal Responds to the Invitation", numbered=False)
    w.para("The invitation asked for items (a) to (i). The table shows where each is answered and lists the "
           "additional chapters we included.")
    w.table(["Invitation item", "Where addressed"], [
        ["(a) Cover letter", "Cover Letter, directly after the cover page"],
        ["(b) Corporate profile and relevant experience", f"Enclosure B, attached separately (Section {sec('enclosure_b')})"],
        ["(c) Business registration certificate", f"Enclosure C, attached separately (Section {sec('enclosure_c')})"],
        ["(d) Detailed scope of work and methodology",
         f"Sections {sec('scope')} (scope of work), {sec('fitment')} (fitment) and {sec('methodology')} (methodology)"],
        ["(e) Detailed fee and pricing structure (WHT, OPE, third-party charges)",
         f"Section {sec('commercials')}: Commercial Proposal; pricing workbook"],
        ["(f) Delivery and implementation timeline with key milestones", f"Section {sec('timeline')}"],
        ["(g) Quotation validity period", f"Section {sec('validity')}"],
        ["(h) Other supporting information",
         f"Section {sec('supporting')}, plus personas, journeys, screens and the technical document pack"],
        ["(i) Terms and conditions", f"Section {sec('terms')}"],
        ("GROUP", "Additional chapters"),
        ["Personas and user journeys", f"Sections {sec('personas')} and {sec('journeys')}"],
        ["Functional rules, products and screen catalogue",
         f"Sections {sec('functional')}, {sec('products')} and {sec('screens')}"],
        ["Architecture, security, deployment, infrastructure",
         f"Sections {sec('architecture')} to {sec('infrastructure')}"],
        ["Technical document pack", f"Section {sec('techdocs')}"],
        ["Five-year maintenance and support, SLA", f"Section {sec('maintenance')}"],
        ["Team, assumptions and risks", f"Sections {sec('team')} to {sec('risks')}"],
        ["Compliance and fitment matrix (every RFP requirement ID)", "Annex A"],
    ], widths=[7.4, 9.6], font_size=8, bold_first_col=True)


def table_of_contents(w: ProposalWriter):
    w.h1("Table of Contents", numbered=False)
    w.toc()


ABBREVIATIONS = [
    ("AD / LDAP", "Active Directory / Lightweight Directory Access Protocol, used for single sign-on"),
    ("AMBD", "Autoriti Monetari Brunei Darussalam, the central bank and financial regulator of Brunei Darussalam"),
    ("AML / KYC", "Anti-Money Laundering / Know Your Customer screening and due diligence"),
    ("API", "Application Programming Interface"),
    ("ASVS", "OWASP Application Security Verification Standard"),
    ("BRR", "The issuance register / report referenced in RFP Appendix 3 against which daily issuance and FIN postings are tallied"),
    ("BRS / FRS", "Business Requirement Specification / Functional Requirement Specification"),
    ("B$ / BND", "Brunei Dollar"),
    ("CI/CD", "Continuous Integration / Continuous Delivery"),
    ("CR", "Change Request"),
    ("DR", "Disaster Recovery"),
    ("EOD", "End-of-Day processing"),
    ("FIN", "IIFT financial / accounting system referenced in the RFP"),
    ("FFR", "Functional Flow and Requirements (RFP Appendix 3)"),
    ("HA", "High Availability"),
    ("IC", "Identity Card (Brunei national identity card)"),
    ("IIFT", "Insurans Islam Family Takaful Sendirian Berhad"),
    ("IIGT", "Insurans Islam General Takaful, the sister company that operates the IIGT Agent Portal"),
    ("IITH", "Insurans Islam TAIB Holding, the group holding company"),
    ("MFA / OTP / TOTP", "Multi-Factor Authentication / One-Time Password / Time-based One-Time Password"),
    ("OPE", "Out-of-Pocket Expenses (travel, accommodation, subsistence)"),
    ("OWASP", "Open Worldwide Application Security Project"),
    ("PDPO", "Personal Data Protection Order 2025 (Brunei Darussalam)"),
    ("PITR", "Point-in-Time Recovery"),
    ("PMO", "Project Management Office"),
    ("QC", "Quality Check"),
    ("RACI", "Responsible, Accountable, Consulted, Informed"),
    ("RBAC", "Role-Based Access Control"),
    ("RPO / RTO", "Recovery Point Objective (maximum data loss) / Recovery Time Objective (maximum downtime)"),
    ("RTM", "Requirements Traceability Matrix"),
    ("SAD / TDD", "Solution Architecture Document / Technical Design Document"),
    ("SAST / SCA", "Static Application Security Testing / Software Composition Analysis"),
    ("SIT / UAT", "System Integration Testing / User Acceptance Testing"),
    ("SLA", "Service Level Agreement"),
    ("SSO", "Single Sign-On"),
    ("TCO", "Total Cost of Ownership"),
    ("VAPT", "Vulnerability Assessment and Penetration Testing"),
    ("WAF", "Web Application Firewall"),
    ("WHT", "Withholding Tax"),
]


def abbreviations(w: ProposalWriter):
    w.h1("Abbreviations", numbered=False)
    w.para("Takaful and technical terms are explained in the glossary in Annex D.")
    w.table(["Abbreviation", "Meaning"], [list(a) for a in ABBREVIATIONS], widths=[3.6, 13.4],
            bold_first_col=True, font_size=8, padding=30)


# --- (a) Cover letter --------------------------------------------------------------------
COVER_LETTER_BODY = [
    "**Re: Proposal for Agent/Banca Portal & Back-office Solution**",
    f"{brand.BIDDER} is pleased to submit its proposal for the Agent/Banca Portal and Back-office Solution. We "
    "offer to configure, integrate, test, deploy and support the solution, with training, documentation, a "
    "six-month warranty and five years of maintenance and support.",
    f"The solution is {brand.PRODUCT}, iorta TechNXT's distribution platform for Takaful and insurance, configured "
    f"for IIFT as the {brand.SOLUTION_NAME}. A working version already runs the seven products in Appendix 3 of the "
    "RFP, the B$150,000 referral rule, the seven-day grace-period agency block, maker-checker approvals, AML "
    "watch-list screening, e-signature, e-Policy and e-Receipt issuance and the end-of-day FIN interface file. The "
    "remaining work (integration with IIFT's systems, IIFT's rates and templates, testing, migration and "
    "training) is set out in this proposal at a fixed fee. Our offer in summary:",
]
COVER_LETTER_BULLETS = [
    f"Fixed implementation price of **{price.bnd(price.one_time_total())}** (Agent/Banca Portal "
    f"{price.bnd(price.one_time_portal())}; Back-office solution {price.bnd(price.one_time_backoffice())}), "
    "inclusive of withholding tax and planned out-of-pocket expenses.",
    f"Licence fee of **B$0**: a perpetual, royalty-free, enterprise-wide licence to {brand.PRODUCT} for unlimited "
    "users, with the source code of the deployed solution.",
    f"Maintenance and support at **{price.bnd(price.maintenance_annual())} a year**, fixed for five years.",
    "Go-live in **week 24**, then four weeks of hypercare.",
]
ENCLOSURES = [
    ("(a)", "Cover letter", "This letter"),
    ("(b)", "Corporate profile and relevant experience", "Enclosure B, attached separately"),
    ("(c)", "Business registration certificate", "Enclosure C, attached separately"),
    ("(d)", "Detailed scope of work and methodology", f"Sections {sec('scope')}, {sec('fitment')} and {sec('methodology')}"),
    ("(e)", "Detailed fee and pricing structure, stating WHT, OPE and third-party charges",
     f"Section {sec('commercials')} and the pricing workbook"),
    ("(f)", "Delivery and implementation timeline with key milestones", f"Section {sec('timeline')}"),
    ("(g)", "Quotation validity period", f"Section {sec('validity')}: {price.QUOTATION_VALIDITY_DAYS} days"),
    ("(h)", "Other supporting information",
     f"Sections {sec('personas')} to {sec('screens')}, {sec('techdocs')} and {sec('supporting')}; technical documents"),
    ("(i)", "Terms and conditions", f"Section {sec('terms')}"),
]
COVER_LETTER_CLOSING = [
    "We confirm that this proposal follows the RFP and would welcome the opportunity to demonstrate the working "
    "application. For clarification, please contact [Name of contact person], [Designation], at [e-mail address] "
    "or [telephone number].",
    "Yours faithfully,",
]



def cover_letter(w: ProposalWriter):
    w.h1("Cover Letter", numbered=False)
    w.para(f"[Day] {brand.SUBMISSION_DATE}", space_after=0)
    w.para("Our ref: [Proposal reference no.]", space_after=0)
    w.para("Your ref: [IIFT RFP / tender reference no.]", space_after=6)
    for line in ("The Management", f"**{brand.CLIENT}**", "[Street address]",
                 "Bandar Seri Begawan [Postcode]", "Brunei Darussalam"):
        w.para(line, space_after=0)
    w.spacer(4)
    w.para("Dear Sir/Madam,")
    w.paras(COVER_LETTER_BODY)
    w.bullets(COVER_LETTER_BULLETS)
    w.para("The proposal contains the items requested in your invitation, in the order requested:", keep_with_next=True)
    w.table(["Item", "Content", "Where"], [list(e) for e in ENCLOSURES], widths=[1.2, 8.4, 7.4], font_size=7.5,
            padding=15)
    w.paras(COVER_LETTER_CLOSING)
    w.spacer(2)
    for line in ("______________________________", "[Name of authorised signatory]", "[Designation]",
                 f"For and on behalf of **{brand.BIDDER}**", "[Company stamp]"):
        w.para(line, space_after=0)


# --- Executive summary ---------------------------------------------------------------------
def what_iift_receives():
    return [
        ("Solution", f"{brand.PRODUCT}, configured as the {brand.SOLUTION_NAME}: a portal for agents and bank "
                     "officers and a back-office for IIFT and IITH staff."),
        ("Scope", "All 29 in-scope components of RFP section 3.1, the seven Appendix 3 products, and integration "
                  "with IIFT's core system, FIN, AML provider, Active Directory, SMS gateway and e-mail."),
        ("Timeline", "Go-live in week 24. Hypercare in weeks 25 to 28. Warranty for six months from go-live."),
        ("One-time price", f"{price.bnd_usd(price.one_time_total())}, fixed. WHT inclusive; planned OPE included."),
        ("Support", f"{price.bnd(price.maintenance_annual())} a year, flat for five years "
                    f"({price.bnd(price.maintenance_total())} in total)."),
        ("Licence", "B$0. Perpetual, royalty-free, enterprise-wide, unlimited users."),
        ("Source code", "Source code of the deployed solution at go-live and with every release; escrow optional."),
        ("Five-year cost", f"{price.bnd_usd(price.tco_on_prem())} with on-premise hosting."),
        ("Compliance", f"234 of 234 RFP requirement IDs addressed (Annex A); fitment in Section {sec('fitment')}."),
    ]


WHY_IORTA = [
    "**The platform already works.** IIFT's seven products, the B$150,000 referral, the seven-day agency block, "
    "maker-checker with amount thresholds, watch-list screening, e-signature, e-Policy and e-Receipt PDFs, the EOD "
    "report and FIN interface file all run today. Discovery workshops start from working screens, which is why "
    "requirements and design take five weeks.",
    "**The price follows IIFT's scale.** The RFP describes 26 named users and about 600 policies a year. There is no "
    "per-user or per-policy fee, so more bank branches, agents or other IITH companies do not change the licence "
    "cost.",
    "**Controls sit in the data layer.** The API enforces maker-checker, a database trigger makes the audit table "
    "append-only, and IC and passport numbers are encrypted field by field with AES-256-GCM. These controls cannot "
    "be bypassed from a screen.",
    "**Delivery risk is shared.** The price is fixed, 95% of it is paid against signed milestones, and maintenance "
    "carries no escalation for five years.",
]


def executive_summary(w: ProposalWriter):
    w.h1("Executive Summary")
    w.para(f"IIFT will receive {brand.PRODUCT}, configured as the {brand.SOLUTION_NAME}, live in 24 weeks for a "
           f"fixed {price.bnd(price.one_time_total())}. Banca submissions, approvals, payments and reporting move from "
           "paper and e-mail to one controlled system.")
    w.key_value_table(what_iift_receives(), widths=(3.6, 13.4), caption="What IIFT receives")
    w.h2("Why iorta TechNXT")
    w.paras(WHY_IORTA)
    w.h2(f"About iorta TechNXT and {brand.PRODUCT}")
    w.para(f"{brand.BIDDER} builds and supports software for insurance and Takaful distribution. {brand.PRODUCT} is "
           "its platform for agency and bancassurance portals, back-office administration and the integrations that "
           "connect them to core, finance and compliance systems. The corporate profile and relevant experience are "
           f"in Enclosure B.")


# --- Enclosures (b) and (c) -------------------------------------------------------------------
def enclosure_b(w: ProposalWriter):
    w.h1("Enclosure B – Corporate Profile and Relevant Experience")
    w.para("**Attached separately.** iorta TechNXT's latest corporate profile and relevant experience (invitation "
           "item b) are submitted as a separate document with this proposal.")
    w.key_value_table([
        ("Document", "[File name of the corporate profile]"),
        ("Contents", "Company overview, leadership, delivery capability and relevant reference projects"),
        ("Contact", "[Name, designation, e-mail, telephone]"),
    ], caption="Enclosure B")


def enclosure_c(w: ProposalWriter):
    w.h1("Enclosure C – Business Registration Certificate", new_page=False)
    w.para("**Attached separately.** A certified copy of iorta TechNXT's business registration certificate "
           "(invitation item c) is submitted with this proposal.")
    w.key_value_table([
        ("Document", "[File name of the certificate]"),
        ("Business registration no.", "[Business registration no.]"),
    ], caption="Enclosure C")


# --- Assembly ----------------------------------------------------------------------------
def chapter_builders(figs: dict) -> dict:
    """Chapter key -> callable, in the order defined by numbering.CHAPTERS."""
    return {
        "executive_summary": lambda w: executive_summary(w),
        "understanding": sections_solution.understanding,
        "enclosure_b": enclosure_b,
        "enclosure_c": enclosure_c,
        "scope": sections_scope.scope_of_work,
        "fitment": sections_scope.fitment_chapter,
        "personas": sections_people.personas,
        "journeys": lambda w: sections_people.journeys(w, figs),
        "functional": lambda w: sections_solution.functional_solution(w, figs),
        "products": sections_solution.product_flows,
        "screens": lambda w: sections_people.screen_catalogue(w, figs),
        "architecture": lambda w: sections_solution.architecture(w, figs),
        "security": sections_solution.security,
        "deployment": sections_solution.deployment,
        "infrastructure": lambda w: sections_solution.infrastructure(w, figs),
        "techdocs": sections_delivery.technical_documents,
        "methodology": lambda w: sections_delivery.methodology(w, figs),
        "timeline": lambda w: sections_delivery.timeline(w, figs, GANTT_PHASES, MILESTONES),
        "commercials": sections_commercial.commercials,
        "maintenance": sections_delivery.maintenance,
        "team": sections_delivery.team,
        "assumptions": sections_delivery.assumptions,
        "risks": sections_delivery.risks,
        "validity": sections_commercial.validity,
        "supporting": sections_commercial.supporting_information,
        "terms": sections_commercial.terms_and_conditions,
    }


def build(output: Path = brand.DOCX_OUTPUT) -> Path:
    price.verify()
    w = ProposalWriter()
    w.set_properties(
        title=brand.PROPOSAL_TITLE,
        subject=f"{brand.PRODUCT} proposal to {brand.CLIENT}",
        keywords=f"IIFT; Takaful; {brand.PRODUCT}; Agent Portal; Bancassurance; Back-office; Proposal",
    )
    w.header_footer()
    with tempfile.TemporaryDirectory() as tmp:
        figs = render_figures(Path(tmp))
        cover_page(w, figs)
        cover_letter(w)
        document_control(w)
        table_of_contents(w)
        response_map(w)
        abbreviations(w)
        builders = chapter_builders(figs)
        for key in CHAPTERS:
            builders[key](w)
            assert w.chapter == int(sec(key)), f"Chapter numbering out of step at '{key}'"
        sections_commercial.annexes(w)
        w.save(output)
    return output


if __name__ == "__main__":
    path = build()
    print(f"Wrote {path}")
