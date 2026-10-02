"""Architecture, lifecycle and timeline diagrams drawn with Pillow.

Every public function takes an output directory, draws one diagram in the
brand colours and returns the path of the PNG it wrote. Coordinates are in
pixels on a canvas roughly 1800 px wide, which prints sharply at 16-17 cm.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

import brand
import pricing_data as price

MAGENTA = brand.rgb(brand.MAGENTA)
ORANGE = brand.rgb(brand.ORANGE)
DARK = brand.rgb(brand.TEXT_DARK)
MUTED = brand.rgb(brand.TEXT_MUTED)
WHITE = (255, 255, 255)
LIGHT_MAGENTA = (253, 236, 245)
MID_MAGENTA = (246, 190, 222)
LIGHT_ORANGE = (254, 238, 224)
LIGHT_GREY = (244, 244, 244)
MID_GREY = (200, 200, 200)
GREEN = (46, 139, 87)
RED = (200, 50, 50)


# --- Drawing primitives -------------------------------------------------------
def font(size, bold=False):
    path = brand.DIAGRAM_FONT_BOLD if bold else brand.DIAGRAM_FONT_REGULAR
    return ImageFont.truetype(str(path), size)


def new_canvas(width, height):
    image = Image.new("RGB", (width, height), WHITE)
    return image, ImageDraw.Draw(image)


def wrap(draw, text, fnt, max_width):
    """Greedy word wrap; explicit '\n' forces a break."""
    lines = []
    for paragraph in text.split("\n"):
        words, current = paragraph.split(), ""
        for word in words:
            candidate = f"{current} {word}".strip()
            if draw.textlength(candidate, font=fnt) <= max_width or not current:
                current = candidate
            else:
                lines.append(current)
                current = word
        lines.append(current)
    return lines


def text_block(draw, box, text, size=26, bold=False, fill=DARK, align="center", valign="center"):
    x0, y0, x1, y1 = box
    fnt = font(size, bold)
    lines = wrap(draw, text, fnt, x1 - x0 - 16)
    line_height = int(size * 1.22)
    total = line_height * len(lines)
    y = y0 + (y1 - y0 - total) / 2 if valign == "center" else y0 + 8
    for line in lines:
        width = draw.textlength(line, font=fnt)
        x = x0 + (x1 - x0 - width) / 2 if align == "center" else x0 + 12
        draw.text((x, y), line, font=fnt, fill=fill)
        y += line_height


def box(draw, xy, text="", fill=LIGHT_MAGENTA, outline=MAGENTA, text_fill=DARK,
        size=24, bold=False, radius=12, width=3):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)
    if text:
        text_block(draw, xy, text, size=size, bold=bold, fill=text_fill)


def zone(draw, xy, title, fill=LIGHT_GREY, outline=MID_GREY, title_fill=MUTED, size=24):
    draw.rounded_rectangle(xy, radius=16, fill=fill, outline=outline, width=3)
    draw.text((xy[0] + 16, xy[1] + 10), title, font=font(size, True), fill=title_fill)


def arrow(draw, start, end, colour=DARK, width=4, head=16, label=None, label_size=20,
          both=False, dashed=False):
    (x0, y0), (x1, y1) = start, end
    if dashed:
        _dashed_line(draw, start, end, colour, width)
    else:
        draw.line([start, end], fill=colour, width=width)
    _arrow_head(draw, start, end, colour, head)
    if both:
        _arrow_head(draw, end, start, colour, head)
    if label:
        fnt = font(label_size)
        lines = label.split("\n")
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        line_h = int(label_size * 1.2)
        top = my - line_h * len(lines) / 2
        for i, line in enumerate(lines):
            w = draw.textlength(line, font=fnt)
            ty = top + i * line_h
            draw.rectangle([mx - w / 2 - 4, ty - 1, mx + w / 2 + 4, ty + line_h - 2], fill=WHITE)
            draw.text((mx - w / 2, ty), line, font=fnt, fill=MUTED)


def _arrow_head(draw, start, end, colour, head):
    (x0, y0), (x1, y1) = start, end
    length = max(((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5, 1)
    ux, uy = (x1 - x0) / length, (y1 - y0) / length
    left = (x1 - head * ux + head * 0.55 * uy, y1 - head * uy - head * 0.55 * ux)
    right = (x1 - head * ux - head * 0.55 * uy, y1 - head * uy + head * 0.55 * ux)
    draw.polygon([end, left, right], fill=colour)


def _dashed_line(draw, start, end, colour, width, dash=14, gap=10):
    (x0, y0), (x1, y1) = start, end
    length = max(((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5, 1)
    ux, uy = (x1 - x0) / length, (y1 - y0) / length
    position = 0.0
    while position < length:
        segment_end = min(position + dash, length)
        draw.line([(x0 + ux * position, y0 + uy * position),
                   (x0 + ux * segment_end, y0 + uy * segment_end)], fill=colour, width=width)
        position += dash + gap


def elbow(draw, points, colour=DARK, width=4, head=16):
    """Poly-line connector with an arrow head on the last segment."""
    draw.line(points, fill=colour, width=width, joint="curve")
    _arrow_head(draw, points[-2], points[-1], colour, head)


def save(image, out_dir: Path, name: str) -> Path:
    path = Path(out_dir) / name
    image.save(path, dpi=(220, 220))
    return path


# --- Diagrams ---------------------------------------------------------------------
def logical_architecture(out_dir):
    width, height = 1800, 1200
    image, draw = new_canvas(width, height)
    label_w, left, right = 230, 30, width - 30
    layers = [
        ("Users &\nchannels", 120, ["Agents & Banca officers\n(web browser)",
                                     "IIFT back-office users\n(internal network)",
                                     "Participants\n(e-signature link)",
                                     "Management\n(dashboards & reports)"]),
        ("Edge &\nsecurity", 110, ["Reverse proxy / WAF – TLS 1.2+, HSTS, rate limiting",
                                    "Network segmentation: portal in DMZ, back-office internal only"]),
        ("Presentation", 110, ["Agent/Banca Portal\nReact 19 SPA  ·  /portal",
                               "Back-office\nReact 19 SPA  ·  /backoffice",
                               "Participant e-sign page\n/esign (one-time link)"]),
        ("Application\nservices", 330, None),
        ("Integration\nlayer", 120, ["Transactional outbox", "Dispatcher – retry,\nback-off, dead-letter",
                                      "Adapters (mapping,\nvalidation, auth)",
                                      "Integration log &\nreconciliation"]),
        ("External\nsystems", 110, ["Core system", "FIN", "AML screening", "Email / SMTP", "SMS gateway",
                                     "LDAP / AD"]),
        ("Data &\noperations", 120, ["PostgreSQL 16\nprimary + standby", "Document store\n(encrypted)",
                                      "Logs, metrics, alerts\n(pino, Prometheus)", "Backups & PITR"]),
    ]
    modules = ["Authentication & MFA", "Users, roles & permissions", "Agencies, banks & agents",
               "Participants", "AML / KYC", "Products & rating",
               "Quotations & policies", "Billing, payments & receipts", "Claims notification",
               "Documents & e-Policy", "Workflow & maker-checker", "Issues & SLA",
               "Notifications", "Reports & dashboards", "Audit trail",
               "Configuration & master data", "Jobs: EOD, grace period, expiry", "e-Signature"]
    y = 24
    for title, layer_h, items in layers:
        draw.rounded_rectangle([left, y, right, y + layer_h], radius=14, fill=LIGHT_GREY, outline=MID_GREY, width=2)
        draw.rounded_rectangle([left, y, left + label_w, y + layer_h], radius=14, fill=MAGENTA)
        text_block(draw, (left, y, left + label_w, y + layer_h), title, size=25, bold=True, fill=WHITE)
        inner_x0, inner_x1 = left + label_w + 20, right - 20
        if items:
            gap = 16
            item_w = (inner_x1 - inner_x0 - gap * (len(items) - 1)) / len(items)
            for i, item in enumerate(items):
                x0 = inner_x0 + i * (item_w + gap)
                is_external = title.startswith("External")
                box(draw, (x0, y + 14, x0 + item_w, y + layer_h - 14), item,
                    fill=LIGHT_ORANGE if is_external else WHITE,
                    outline=ORANGE if is_external else MAGENTA, size=22)
        else:
            draw.text((inner_x0, y + 10), "NestJS modular monolith (Node.js 22 LTS)  ·  REST API /api/v1  ·  "
                      "RBAC + data scoping on every request", font=font(22, True), fill=MAGENTA)
            cols, rows, gap = 6, 3, 14
            grid_top = y + 50
            cell_w = (inner_x1 - inner_x0 - gap * (cols - 1)) / cols
            cell_h = (layer_h - 64 - gap * (rows - 1)) / rows
            for index, module in enumerate(modules):
                r, c = divmod(index, cols)
                x0 = inner_x0 + c * (cell_w + gap)
                y0 = grid_top + r * (cell_h + gap)
                box(draw, (x0, y0, x0 + cell_w, y0 + cell_h), module, fill=LIGHT_MAGENTA, size=21, radius=10, width=2)
        y += layer_h + 22
    return save(image, out_dir, "fig-logical-architecture.png")


def on_prem_deployment(out_dir):
    width, height = 1800, 1210
    image, draw = new_canvas(width, height)
    draw.text((20, 14), "Option A – Primary data centre (IIFT / IITH)", font=font(28, True), fill=DARK)
    zone(draw, (20, 100, 330, 800), "Users")
    zone(draw, (360, 100, 640, 800), "DMZ", fill=LIGHT_ORANGE, outline=ORANGE, title_fill=ORANGE)
    zone(draw, (670, 100, 1090, 800), "Application zone", fill=LIGHT_MAGENTA, outline=MAGENTA, title_fill=MAGENTA)
    zone(draw, (1120, 100, 1450, 800), "Data zone", fill=LIGHT_MAGENTA, outline=MAGENTA, title_fill=MAGENTA)
    zone(draw, (1480, 100, 1780, 800), "IITH enterprise systems", size=22)

    box(draw, (45, 170, 305, 290), "Agents & Banca officers\n(internet / bank network)", fill=WHITE, size=21)
    box(draw, (45, 340, 305, 460), "Participants\n(e-signature link)", fill=WHITE, size=21)
    box(draw, (45, 540, 305, 660), "Back-office users\n(IIFT internal LAN)", fill=WHITE, size=21)

    box(draw, (385, 190, 615, 370), "WAF / load balancer pair\n(or existing F5)\nTLS termination", fill=WHITE, outline=ORANGE, size=21)
    box(draw, (385, 510, 615, 680), "Internal reverse proxy\n(back-office only)", fill=WHITE, outline=ORANGE, size=21)

    for i, y0 in enumerate((170, 450)):
        box(draw, (700, y0, 1060, y0 + 250), "", fill=WHITE)
        draw.text((716, y0 + 10), f"App VM {i + 1}  (4 vCPU / 8 GB)", font=font(22, True), fill=MAGENTA)
        for j, label in enumerate(["web (static SPA)", "api (NestJS)", "worker (jobs, outbox)"]):
            box(draw, (722, y0 + 52 + j * 62, 1038, y0 + 104 + j * 62), label, fill=LIGHT_MAGENTA, size=20, width=2)
    box(draw, (700, 720, 1060, 785), "Monitoring: Prometheus, Grafana, central logs", fill=WHITE, outline=ORANGE, size=19)

    box(draw, (1145, 160, 1425, 300), "PostgreSQL 16 primary\n(4 vCPU / 16 GB)", fill=WHITE, size=21)
    box(draw, (1145, 380, 1425, 520), "PostgreSQL standby\n(streaming replica)", fill=WHITE, size=21)
    arrow(draw, (1285, 300), (1285, 380), colour=MAGENTA, label="streaming\nreplication", label_size=18)
    box(draw, (1145, 570, 1425, 660), "Document store 500 GB\n(NFS / MinIO, encrypted)", fill=WHITE, size=20)
    box(draw, (1145, 690, 1425, 775), "Backup (PITR, daily full)", fill=WHITE, size=20)

    for k, label in enumerate(["Core system", "FIN", "AML screening", "LDAP / AD", "SMTP relay", "SMS gateway"]):
        y0 = 160 + k * 102
        box(draw, (1505, y0, 1755, y0 + 80), label, fill=LIGHT_ORANGE, outline=ORANGE, size=21)
        arrow(draw, (1465, y0 + 40), (1505, y0 + 40), colour=ORANGE, head=12)
    # integration bus from the worker to every enterprise system
    draw.line([(1000, 170), (1000, 70), (1465, 70), (1465, 200 + 5 * 102)], fill=ORANGE, width=4, joint="curve")
    draw.text((1030, 40), "integration adapters (outbox, retry, TLS)", font=font(19), fill=ORANGE)

    arrow(draw, (305, 230), (385, 260))
    arrow(draw, (305, 400), (385, 320))
    arrow(draw, (305, 600), (385, 595))
    arrow(draw, (615, 280), (700, 295))
    arrow(draw, (615, 280), (700, 580))
    arrow(draw, (615, 595), (700, 585))
    arrow(draw, (1060, 295), (1145, 230))
    arrow(draw, (1060, 585), (1145, 250))
    arrow(draw, (1060, 640), (1145, 615))

    zone(draw, (20, 850, 1780, 1120), "Disaster recovery site (warm standby)", fill=LIGHT_GREY)
    box(draw, (60, 910, 640, 1090), "Annual DR test with IIFT (MNT-20)\nFail-over runbook · DNS / load-balancer switch\n"
        "Target: RPO ≤ 15 min · RTO ≤ 4 h", fill=WHITE, outline=ORANGE, size=21)
    box(draw, (700, 910, 1060, 1090), "DR App VM\n(4 vCPU / 8 GB)\ncontainers pre-deployed", fill=WHITE, size=21)
    box(draw, (1145, 905, 1425, 995), "PostgreSQL DR replica\n(WAL log shipping)", fill=WHITE, size=20)
    box(draw, (1145, 1010, 1425, 1095), "Replicated documents\n& backups", fill=WHITE, size=20)
    arrow(draw, (1285, 775), (1285, 905), colour=MAGENTA, dashed=True)
    draw.text((1295, 815), "WAL shipping", font=font(18), fill=MUTED)
    draw.text((30, 1150), "Sizing per environment is in the infrastructure chapter. Hardware, OS and network are IIFT/IITH-provided; "
              "iorta installs, configures and operates the application stack.", font=font(20), fill=MUTED)
    return save(image, out_dir, "fig-deployment-on-prem.png")


def cloud_deployment(out_dir):
    width, height = 1800, 1120
    image, draw = new_canvas(width, height)
    draw.text((20, 14), "Option B – iorta-hosted cloud (AWS Asia Pacific – Malaysia; Azure Malaysia West equivalent)", font=font(28, True), fill=DARK)
    box(draw, (30, 140, 300, 280), "Agents & Banca officers\n(internet)", fill=WHITE, size=21)
    box(draw, (30, 420, 300, 560), "Participants\n(e-signature link)", fill=WHITE, size=21)

    zone(draw, (340, 70, 1450, 900), "Region ap-southeast-5 (Malaysia)  ·  VPC dedicated to IIFT", fill=LIGHT_GREY)
    zone(draw, (370, 120, 1420, 260), "Public subnets (2 AZ)", fill=LIGHT_ORANGE, outline=ORANGE, title_fill=ORANGE, size=21)
    box(draw, (560, 160, 1230, 245), "AWS WAF  +  Application Load Balancer (TLS, ACM certificate)", fill=WHITE, outline=ORANGE, size=22)

    for i, label in enumerate(("Availability zone A", "Availability zone B")):
        x0 = 370 + i * 530
        zone(draw, (x0, 290, x0 + 520, 880), label, fill=WHITE, outline=MAGENTA, title_fill=MAGENTA, size=21)
        box(draw, (x0 + 25, 340, x0 + 495, 520), "Private app subnet\nECS Fargate task: web + api + worker\n(non-root containers)", fill=LIGHT_MAGENTA, size=21)
        db_label = "RDS PostgreSQL 16\nprimary (Multi-AZ)" if i == 0 else "RDS PostgreSQL 16\nsynchronous standby"
        box(draw, (x0 + 25, 580, x0 + 495, 740), "Private data subnet\n" + db_label, fill=LIGHT_MAGENTA, size=21)
        arrow(draw, (x0 + 260, 245), (x0 + 260, 340))
        arrow(draw, (x0 + 260, 520), (x0 + 260, 580))
    arrow(draw, (865, 660), (925, 660), colour=MAGENTA, both=True)
    box(draw, (395, 775, 1395, 860), "Secrets Manager · KMS (encryption keys) · VPC endpoints · security groups (least privilege)", fill=WHITE, size=20)

    for k, label in enumerate(["S3 documents & backups\n(SSE-KMS, versioning)", "CloudWatch logs,\nmetrics & alarms",
                               "DR pilot light in a\nsecond region"]):
        y0 = 120 + k * 170
        box(draw, (1490, y0, 1770, y0 + 130), label, fill=WHITE, size=21)
    arrow(draw, (1420, 450), (1490, 185))
    arrow(draw, (1420, 450), (1490, 355))
    arrow(draw, (1420, 700), (1490, 525))

    zone(draw, (1490, 600, 1770, 900), "IITH data centre", fill=LIGHT_ORANGE, outline=ORANGE, title_fill=ORANGE, size=21)
    for k, label in enumerate(["Back-office users", "Core · FIN · AML", "AD · SMTP · SMS"]):
        box(draw, (1510, 650 + k * 78, 1750, 715 + k * 78), label, fill=WHITE, outline=ORANGE, size=20)
    arrow(draw, (1420, 820), (1490, 820), colour=ORANGE, both=True, label=None)
    draw.text((1300, 905), "Site-to-site VPN (IPsec) / private link", font=font(19), fill=MUTED)

    arrow(draw, (300, 210), (560, 205))
    elbow(draw, [(300, 490), (330, 490), (330, 205), (560, 205)])
    draw.text((330, 940), "Back-office traffic enters over the site-to-site VPN; the back-office path is not published to the internet.",
              font=font(20), fill=MUTED)
    draw.text((30, 990), f"Cloud infrastructure at cost, indicative B$ {price.cloud_monthly():,} per month, plus iorta "
              "managed services. Subject to AMBD outsourcing / cloud notification and IIFT approval.",
              font=font(20, True), fill=MAGENTA)
    draw.text((30, 1035), "RPO ≤ 15 min (PITR) · RTO ≤ 4 h (restore in secondary AZ or region)", font=font(20), fill=MUTED)
    return save(image, out_dir, "fig-deployment-cloud.png")


def titled_box(draw, xy, title, text, fill=LIGHT_MAGENTA, outline=MAGENTA, title_size=23, size=21):
    box(draw, xy, "", fill=fill, outline=outline)
    x0, y0, x1, y1 = xy
    text_block(draw, (x0, y0 + 8, x1, y0 + 58), title, size=title_size, bold=True, fill=MAGENTA)
    text_block(draw, (x0, y0 + 58, x1, y1 - 8), text, size=size)


def integration_flow(out_dir):
    width, height = 1800, 860
    image, draw = new_canvas(width, height)
    top_y0, top_y1 = 70, 250
    steps = [
        ("1. Business transaction", "e.g. policy issued,\nreceipt approved"),
        ("2. Database commit", "business rows + audit +\noutbox event (atomic)"),
        ("3. Outbox dispatcher", "scheduled worker,\nadvisory lock, idempotency key"),
        ("4. Adapter", "mapping, validation,\nauthentication, TLS"),
        ("5. Target system", "Core · FIN · AML ·\nSMTP · SMS · AD"),
    ]
    step_w, gap = 312, 40
    for i, (title, text) in enumerate(steps):
        x0 = 30 + i * (step_w + gap)
        is_target = i == len(steps) - 1
        titled_box(draw, (x0, top_y0, x0 + step_w, top_y1), title, text,
                   fill=LIGHT_ORANGE if is_target else LIGHT_MAGENTA, outline=ORANGE if is_target else MAGENTA)
        if i:
            arrow(draw, (x0 - gap, (top_y0 + top_y1) / 2), (x0, (top_y0 + top_y1) / 2))
    draw.text((30, 22), "Happy path", font=font(24, True), fill=DARK)

    draw.text((30, 300), "Failure handling", font=font(24, True), fill=DARK)
    dispatcher_x = 30 + 2 * (step_w + gap)
    adapter_cx = 30 + 3 * (step_w + gap) + step_w / 2
    titled_box(draw, (30, 350, 342, 510), "Integration monitor", "view, re-submit,\nresolve, export",
               fill=WHITE, outline=MAGENTA)
    titled_box(draw, (382, 350, 694, 510), "Dead-letter", "after max attempts;\nalert to support team",
               fill=WHITE, outline=RED)
    titled_box(draw, (dispatcher_x, 350, dispatcher_x + step_w, 510), "Retry with back-off",
               "1 min · 5 min · 15 min ·\n1 h · 4 h", fill=WHITE, outline=ORANGE)
    titled_box(draw, (1290, 350, 1770, 510), "Idempotent delivery",
               "an idempotency key per event prevents\nduplicate postings after a timeout", fill=WHITE, outline=MID_GREY)
    elbow(draw, [(adapter_cx - 60, top_y1), (adapter_cx - 60, 430), (dispatcher_x + step_w, 430)], colour=ORANGE)
    draw.text((adapter_cx - 50, 270), "error /\ntimeout", font=font(19), fill=ORANGE)
    arrow(draw, (dispatcher_x + step_w / 2, 350), (dispatcher_x + step_w / 2, top_y1), colour=ORANGE)
    draw.text((dispatcher_x + step_w / 2 + 10, 280), "re-queue", font=font(19), fill=ORANGE)
    arrow(draw, (dispatcher_x, 430), (694, 430), colour=RED)
    arrow(draw, (382, 430), (342, 430), colour=RED)

    draw.text((30, 560), "Logging and reconciliation", font=font(24, True), fill=DARK)
    titled_box(draw, (30, 610, 860, 780), "Integration log (every attempt)",
               "correlation id · interface · direction · payload hash · status ·\nHTTP code · duration · retry count · user / job",
               fill=WHITE)
    titled_box(draw, (940, 610, 1770, 780), "Daily reconciliation job",
               "counts and control totals vs Core / FIN / BRR ·\nexception report · sign-off by Finance in back-office",
               fill=WHITE)
    arrow(draw, (860, 695), (940, 695))
    draw.text((30, 815), "Integration credentials are held in the secrets store; payloads are validated against the "
              "interface specification (DEL-09) in both directions.", font=font(20), fill=MUTED)
    return save(image, out_dir, "fig-integration-flow.png")

def policy_lifecycle(out_dir):
    width, height = 1800, 900
    image, draw = new_canvas(width, height)
    state_w, state_h = 270, 100

    def state(centre, label, fill=LIGHT_MAGENTA, outline=MAGENTA):
        cx, cy = centre
        xy = (cx - state_w / 2, cy - state_h / 2, cx + state_w / 2, cy + state_h / 2)
        box(draw, xy, label, fill=fill, outline=outline, size=24, bold=True, radius=40)

    def note(xy, text, colour=MUTED, size=19):
        draw.multiline_text(xy, text, font=font(size), fill=colour, spacing=4)

    draft, decision = (180, 420), (520, 420)
    rejected, pending_approval = (520, 110), (880, 220)
    approved, pending_payment = (1200, 420), (1200, 690)
    active, expired, cancelled = (1620, 420), (1620, 250), (1620, 90)
    half = state_w / 2

    state(draft, "DRAFT\n(quotation)")
    cx, cy = decision
    draw.polygon([(cx, cy - 95), (cx + 150, cy), (cx, cy + 95), (cx - 150, cy)], fill=LIGHT_ORANGE, outline=ORANGE)
    text_block(draw, (cx - 120, cy - 60, cx + 120, cy + 60), "Validation\nrules", size=22, bold=True)
    state(rejected, "REJECTED", fill=(250, 228, 228), outline=RED)
    state(pending_approval, "PENDING\nAPPROVAL")
    state(approved, "APPROVED", fill=WHITE)
    state(pending_payment, "PENDING\nPAYMENT")
    state(active, "ACTIVE", fill=(224, 243, 232), outline=GREEN)
    state(expired, "EXPIRED", fill=LIGHT_GREY, outline=MID_GREY)
    state(cancelled, "CANCELLED", fill=LIGHT_GREY, outline=MID_GREY)

    arrow(draw, (draft[0] + half, cy), (cx - 150, cy), label="submit")
    elbow(draw, [(cx, cy - 95), (cx, pending_approval[1]), (pending_approval[0] - half, pending_approval[1])])
    note((cx + 14, 280), "referral (> B$150,000),\nQC or authority limit")
    arrow(draw, (cx + 150, cy), (approved[0] - half, cy), label="no referral\nrequired")
    elbow(draw, [(pending_approval[0] + half, pending_approval[1]), (approved[0], pending_approval[1]),
                 (approved[0], approved[1] - 50)], colour=GREEN)
    note((1030, 180), "checker approves")
    elbow(draw, [(pending_approval[0], pending_approval[1] - 50), (pending_approval[0], rejected[1]),
                 (rejected[0] + half, rejected[1])], colour=RED)
    note((670, 40), "checker rejects\n(mandatory remarks)", colour=RED)
    elbow(draw, [(rejected[0] - half, rejected[1]), (draft[0], rejected[1]), (draft[0], draft[1] - 50)], colour=MUTED)
    note((40, 200), "amend &\nresubmit")
    arrow(draw, (approved[0], approved[1] + 50), (pending_payment[0], pending_payment[1] - 50))
    note((approved[0] + 14, 540), "pay-first\nproducts")
    arrow(draw, (approved[0] + half, cy), (active[0] - half, cy))
    note((1342, 340), "issue-then-pay\n(7-day grace)")
    elbow(draw, [(pending_payment[0] + half, pending_payment[1]), (1540, pending_payment[1]),
                 (1540, active[1] + 50)], colour=GREEN)
    note((1350, 650), "payment verified")
    arrow(draw, (1700, active[1] - 50), (1700, expired[1] + 50), colour=MUTED)
    note((1712, 312), "term\nends")
    elbow(draw, [(active[0] + half, active[1]), (1785, active[1]), (1785, cancelled[1]),
                 (cancelled[0] + half, cancelled[1])], colour=MUTED)
    note((1230, 60), "approved cancellation\n(maker-checker)")

    notes = [
        "Validation: product eligibility, mandatory documents, AML result, agency payment block (AP-42), authority limit (AP-60).",
        "Payment status runs alongside: UNPAID → PENDING VERIFICATION → PAID. Renewal creates a new term linked to the expiring policy.",
        "Endorsement, cancellation and participant updates are separate maker-checker requests against an ACTIVE policy.",
    ]
    for i, text in enumerate(notes):
        draw.text((30, 780 + i * 36), "•  " + text, font=font(19), fill=MUTED)
    return save(image, out_dir, "fig-policy-lifecycle.png")

def governance_structure(out_dir):
    width, height = 1800, 720
    image, draw = new_canvas(width, height)
    box(draw, (480, 30, 1320, 150), "Project Steering Committee\nIIFT sponsor (chair) · IITH IT · iorta Engagement Director",
        fill=MAGENTA, outline=MAGENTA, text_fill=WHITE, size=23, bold=True)
    box(draw, (600, 230, 1200, 350), "Project Working Committee\nIIFT Project Manager · iorta Project Manager",
        fill=LIGHT_MAGENTA, size=23, bold=True)
    box(draw, (1290, 230, 1770, 350), "Design Authority\nIITH IT architecture & security · iorta Solution Architect",
        fill=WHITE, outline=ORANGE, size=20)
    box(draw, (30, 230, 510, 350), "Change Control Board\nscope, cost and schedule changes",
        fill=WHITE, outline=ORANGE, size=20)
    arrow(draw, (900, 150), (900, 230))
    arrow(draw, (1200, 290), (1290, 290), both=True)
    arrow(draw, (510, 290), (600, 290), both=True)
    streams = ["Business &\nrequirements", "Solution build\n(portal & back-office)", "Integration",
               "Testing &\nsecurity", "Data migration", "Training &\nchange"]
    stream_w, gap = 265, 30
    centres = [30 + i * (stream_w + gap) + stream_w / 2 for i in range(len(streams))]
    for centre, stream in zip(centres, streams):
        box(draw, (centre - stream_w / 2, 470, centre + stream_w / 2, 590), stream,
            fill=LIGHT_ORANGE, outline=ORANGE, size=22)
        arrow(draw, (centre, 420), (centre, 470))
    draw.line([(centres[0], 420), (centres[-1], 420)], fill=DARK, width=4)
    draw.line([(900, 350), (900, 420)], fill=DARK, width=4)
    draw.text((30, 630), "Steering Committee: monthly and at each milestone gate  ·  Working Committee: weekly  ·  "
              "Sprint review: every two weeks", font=font(21), fill=MUTED)
    return save(image, out_dir, "fig-governance.png")


def gantt_chart(out_dir, phases, milestones, total_weeks=28):
    """phases: (label, start_week, end_week, colour_key); milestones: (code, week, label)."""
    label_w, week_w, row_h = 520, 44, 58
    top = 120
    width = label_w + total_weeks * week_w + 40
    height = top + row_h * len(phases) + 250
    image, draw = new_canvas(width, height)
    colours = {"build": MAGENTA, "support": ORANGE, "gate": (150, 30, 100)}

    draw.text((20, 20), "Delivery plan – 24 weeks to go-live, 4 weeks hypercare", font=font(28, True), fill=DARK)
    for week in range(1, total_weeks + 1):
        x0 = label_w + (week - 1) * week_w
        fill = LIGHT_MAGENTA if week % 2 else WHITE
        draw.rectangle([x0, top - 40, x0 + week_w, top + row_h * len(phases)], fill=fill)
        text_block(draw, (x0, top - 40, x0 + week_w, top), str(week), size=19, bold=True)
    draw.text((20, top - 36), "Phase / week", font=font(21, True), fill=MUTED)
    base = top + row_h * len(phases) + 30
    for _, week, _ in milestones:
        cx = label_w + week * week_w - week_w / 2
        draw.line([(cx, top), (cx, base)], fill=ORANGE, width=2)
    for i, (label, start, end, colour_key) in enumerate(phases):
        y0 = top + i * row_h
        draw.line([(20, y0 + row_h), (width - 20, y0 + row_h)], fill=MID_GREY, width=1)
        text_block(draw, (20, y0, label_w - 10, y0 + row_h), label, size=20, align="left")
        x0 = label_w + (start - 1) * week_w + 3
        x1 = label_w + end * week_w - 3
        draw.rounded_rectangle([x0, y0 + 13, x1, y0 + row_h - 13], radius=8, fill=colours[colour_key])
    for code, week, label in milestones:
        cx = label_w + week * week_w - week_w / 2
        draw.polygon([(cx, base), (cx + 13, base + 13), (cx, base + 26), (cx - 13, base + 13)], fill=ORANGE)
        draw.text((cx - 14, base + 30), code, font=font(19, True), fill=DARK)
    legend_y = base + 80
    for i, (code, week, label) in enumerate(milestones):
        col, row = divmod(i, 4)
        draw.text((20 + col * 720, legend_y + row * 32), f"{code}  (week {week})  {label}", font=font(22), fill=DARK)
    return save(image, out_dir, "fig-gantt.png")


def screenshot_placeholder(out_dir, filename, caption):
    """Neutral grey box used until the real screenshot is available."""
    width, height = 1600, 1000
    image, draw = new_canvas(width, height)
    draw.rectangle([0, 0, width - 1, height - 1], fill=brand.rgb(brand.PLACEHOLDER_GREY), outline=MID_GREY, width=6)
    draw.rectangle([0, 0, width - 1, 70], fill=MID_GREY)
    for i, colour in enumerate(((236, 106, 94), (244, 191, 79), (97, 197, 84))):
        draw.ellipse([24 + i * 40, 22, 50 + i * 40, 48], fill=colour)
    text_block(draw, (100, 380, width - 100, 520), caption, size=56, bold=True, fill=MUTED)
    text_block(draw, (100, 540, width - 100, 610), f"Screen image: {filename}", size=34, fill=MUTED)
    return save(image, out_dir, f"placeholder-{filename}")


def cover_band(out_dir, width=2000, height=70):
    """Horizontal magenta-to-orange gradient used on the cover page."""
    image = Image.new("RGB", (width, height), WHITE)
    draw = ImageDraw.Draw(image)
    for x in range(width):
        t = x / (width - 1)
        colour = tuple(int(MAGENTA[c] + (ORANGE[c] - MAGENTA[c]) * t) for c in range(3))
        draw.line([(x, 0), (x, height)], fill=colour)
    return save(image, out_dir, "cover-band.png")


def swimlane(out_dir, name, lanes, steps):
    """Swim-lane flow: `lanes` are actor names, `steps` are (lane_index, label).

    Steps are placed left to right in order, each in its actor's lane, and
    joined by arrows; the step number is prefixed automatically.
    """
    label_w, lane_h, top, gap = 230, 140, 10, 20
    width = 1800
    height = top + lane_h * len(lanes) + 10
    image, draw = new_canvas(width, height)
    step_w = (width - label_w - 20 - gap * (len(steps) - 1)) / len(steps)
    for index, lane in enumerate(lanes):
        y0 = top + index * lane_h
        draw.rectangle([10, y0, width - 10, y0 + lane_h], fill=LIGHT_GREY if index % 2 else WHITE,
                       outline=MID_GREY, width=2)
        draw.rectangle([10, y0, label_w, y0 + lane_h], fill=MAGENTA if index % 2 == 0 else (196, 4, 122))
        text_block(draw, (14, y0, label_w - 4, y0 + lane_h), lane, size=25, bold=True, fill=WHITE)
    centres = []
    for number, (lane, label) in enumerate(steps, start=1):
        x0 = label_w + 10 + (number - 1) * (step_w + gap)
        y0 = top + lane * lane_h + 12
        xy = (x0, y0, x0 + step_w, y0 + lane_h - 24)
        draw.rounded_rectangle(xy, radius=12, fill=LIGHT_ORANGE if lanes[lane].startswith("System") or
                               lanes[lane].startswith("IITH") or lanes[lane].startswith("FIN") else LIGHT_MAGENTA,
                               outline=MAGENTA, width=3)
        draw.ellipse([x0 - 6, y0 - 6, x0 + 30, y0 + 30], fill=ORANGE)
        text_block(draw, (x0 - 6, y0 - 6, x0 + 30, y0 + 30), str(number), size=20, bold=True, fill=WHITE)
        text_block(draw, (x0 + 2, y0 + 16, x0 + step_w - 2, y0 + lane_h - 26), label, size=27)
        centres.append(((x0, x0 + step_w), (y0, y0 + lane_h - 24)))
    for (xa, ya), (xb, yb) in zip(centres, centres[1:]):
        start_y = (ya[0] + ya[1]) / 2
        end_y = (yb[0] + yb[1]) / 2
        if abs(start_y - end_y) < 1:
            arrow(draw, (xa[1], start_y), (xb[0], end_y), head=14, width=3)
        else:
            mid_x = xa[1] + gap / 2
            elbow(draw, [(xa[1], start_y), (mid_x, start_y), (mid_x, end_y), (xb[0], end_y)], width=3, head=14)
    return save(image, out_dir, f"fig-journey-{name}.png")
