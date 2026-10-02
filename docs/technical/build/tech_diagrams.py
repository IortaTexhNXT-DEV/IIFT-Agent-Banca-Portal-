"""Diagrams for the technical document pack, drawn with Pillow.

Canvases are 1400 px wide and are placed at 16.5 cm in the documents, so a
30 px font prints at about 10 pt and a 36 px font at about 12 pt. Drawing
primitives and colours come from the proposal's diagrams module so the pack
and the proposal share one visual language.
"""

from pathlib import Path

import tech_kit  # noqa: F401  (sets up the import path to the proposal build folder)
import diagrams as base
from diagrams import (MAGENTA, ORANGE, DARK, MUTED, WHITE, LIGHT_MAGENTA, LIGHT_ORANGE, LIGHT_GREY, MID_GREY,
                      GREEN, RED, font, new_canvas, wrap, save)

W = 1400
F = 30          # body label  ~10 pt
FS = 28         # small label ~9.5 pt
FT = 34         # titles      ~11.5 pt
PALE_GREEN = (232, 245, 236)
PALE_BLUE = (232, 240, 250)
BLUE = (60, 110, 170)


# --- primitives with print-sized defaults ----------------------------------------------------------
def text(draw, box, label, size=F, bold=False, fill=DARK, align="center", valign="center", line=1.18):
    x0, y0, x1, y1 = box
    fnt = font(size, bold)
    lines = wrap(draw, label, fnt, x1 - x0 - 20)
    height = int(size * line)
    total = height * len(lines)
    y = y0 + (y1 - y0 - total) / 2 if valign == "center" else y0 + 10
    for item in lines:
        width = draw.textlength(item, font=fnt)
        x = x0 + (x1 - x0 - width) / 2 if align == "center" else x0 + 14
        draw.text((x, y), item, font=fnt, fill=fill)
        y += height
    return y


def card(draw, xy, title, body="", fill=WHITE, outline=MAGENTA, title_fill=MAGENTA, size=F, title_size=None,
         width=3, radius=14, dashed=False):
    """Box with a bold title line and optional body text."""
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)
    if dashed:
        _dash_rect(draw, xy, outline)
    x0, y0, x1, y1 = xy
    title_size = title_size or size
    tf = font(title_size, True)
    bf = font(size)
    t_lines = wrap(draw, title, tf, x1 - x0 - 24) if title else []
    b_lines = wrap(draw, body, bf, x1 - x0 - 24) if body else []
    th, bh = int(title_size * 1.2), int(size * 1.18)
    total = th * len(t_lines) + (6 if b_lines and t_lines else 0) + bh * len(b_lines)
    y = y0 + (y1 - y0 - total) / 2
    for item in t_lines:
        draw.text((x0 + (x1 - x0 - draw.textlength(item, font=tf)) / 2, y), item, font=tf, fill=title_fill)
        y += th
    y += 6 if b_lines and t_lines else 0
    for item in b_lines:
        draw.text((x0 + (x1 - x0 - draw.textlength(item, font=bf)) / 2, y), item, font=bf, fill=DARK)
        y += bh


def _dash_rect(draw, xy, colour):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle(xy, radius=14, outline=WHITE, width=3)
    for a, b in (((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))):
        base._dashed_line(draw, a, b, colour, 3, dash=16, gap=10)


def zone(draw, xy, title, fill=LIGHT_GREY, outline=MID_GREY, title_fill=MUTED, size=FS, dashed=False):
    draw.rounded_rectangle(xy, radius=18, fill=fill, outline=outline, width=3)
    if dashed:
        _dash_rect(draw, xy, outline)
    draw.text((xy[0] + 18, xy[1] + 10), title, font=font(size, True), fill=title_fill)


def arrow(draw, start, end, colour=DARK, width=4, head=18, label=None, size=FS, both=False, dashed=False,
          label_pos=0.5, label_offset=(0, 0)):
    base.arrow(draw, start, end, colour=colour, width=width, head=head, both=both, dashed=dashed)
    if label:
        _label(draw, start, end, label, size, label_pos, label_offset)


def _label(draw, start, end, label, size, pos=0.5, offset=(0, 0)):
    (x0, y0), (x1, y1) = start, end
    mx, my = x0 + (x1 - x0) * pos + offset[0], y0 + (y1 - y0) * pos + offset[1]
    fnt = font(size)
    lines = label.split("\n")
    lh = int(size * 1.2)
    top = my - lh * len(lines) / 2
    for i, item in enumerate(lines):
        w = draw.textlength(item, font=fnt)
        ty = top + i * lh
        draw.rectangle([mx - w / 2 - 5, ty - 1, mx + w / 2 + 5, ty + lh - 1], fill=WHITE)
        draw.text((mx - w / 2, ty), item, font=fnt, fill=MUTED)


def poly(draw, points, colour=DARK, width=4, head=18, dashed=False, label=None, label_at=None, size=FS):
    """Orthogonal connector through `points`, arrow head on the last segment."""
    for a, b in zip(points, points[1:]):
        if dashed:
            base._dashed_line(draw, a, b, colour, width)
        else:
            draw.line([a, b], fill=colour, width=width)
    base._arrow_head(draw, points[-2], points[-1], colour, head)
    if label and label_at is not None:
        a, b = points[label_at], points[label_at + 1]
        _label(draw, a, b, label, size)


def band(draw, y, height, title, items, fill=LIGHT_GREY, item_fill=WHITE, item_outline=MAGENTA, size=F,
         label_w=230, left=20, right=W - 20, gap=16, item_size=None, title_size=FT - 2):
    draw.rounded_rectangle([left, y, right, y + height], radius=16, fill=fill, outline=MID_GREY, width=2)
    draw.rounded_rectangle([left, y, left + label_w, y + height], radius=16, fill=MAGENTA)
    text(draw, (left, y, left + label_w, y + height), title, size=title_size, bold=True, fill=WHITE)
    x0, x1 = left + label_w + 18, right - 16
    item_w = (x1 - x0 - gap * (len(items) - 1)) / len(items)
    boxes = []
    for i, item in enumerate(items):
        bx = x0 + i * (item_w + gap)
        xy = (bx, y + 12, bx + item_w, y + height - 12)
        if isinstance(item, tuple):
            card(draw, xy, item[0], item[1], fill=item_fill, outline=item_outline, size=item_size or FS,
                 title_size=item_size or size)
        else:
            draw.rounded_rectangle(xy, radius=12, fill=item_fill, outline=item_outline, width=3)
            text(draw, xy, item, size=item_size or size)
        boxes.append(xy)
    return boxes


def mid(xy, side):
    x0, y0, x1, y1 = xy
    return {"top": ((x0 + x1) / 2, y0), "bottom": ((x0 + x1) / 2, y1), "left": (x0, (y0 + y1) / 2),
            "right": (x1, (y0 + y1) / 2)}[side]


# --- 1. Context -------------------------------------------------------------------------------
def context(out):
    image, draw = new_canvas(W, 1120)
    centre = (470, 400, 930, 700)
    draw.rounded_rectangle(centre, radius=22, fill=MAGENTA)
    text(draw, (centre[0], centre[1] + 20, centre[2], centre[1] + 110), "SalesVerse 2.0", size=40, bold=True,
         fill=WHITE)
    text(draw, (centre[0], centre[1] + 100, centre[2], centre[3] - 20),
         "IIFT Agent/Banca Portal and Back-office\nPostgreSQL system of record", size=F, fill=WHITE)
    users = [("Agents", "Agency channel\n/portal"), ("Bank officers", "Banca channel\n/portal"),
             ("IIFT staff", "Back-office, internal\nnetwork /backoffice"),
             ("Participants", "One-time e-signature\nlink /esign")]
    for i, (title, body) in enumerate(users):
        y = 70 + i * 255
        xy = (20, y, 340, y + 190)
        card(draw, xy, title, body, fill=LIGHT_MAGENTA, size=FS, title_size=FT)
        target = (centre[0], centre[1] + 45 + i * 70)
        arrow(draw, mid(xy, "right"), target, colour=MAGENTA, width=4)
    draw.text((360, 1040), "Users: HTTPS through the reverse proxy / WAF", font=font(FS), fill=MUTED)
    systems = [("IITH core system", "REST/JSON both ways"), ("Financial system (FIN)", "REST/JSON + EOD file"),
               ("AML screening provider", "REST/JSON (optional)"), ("SMTP relay", "SMTP + STARTTLS"),
               ("SMS gateway", "HTTPS API"), ("Active Directory / LDAP", "LDAPS bind")]
    for i, (title, body) in enumerate(systems):
        y = 20 + i * 180
        xy = (1060, y, 1380, y + 150)
        card(draw, xy, title, body, fill=LIGHT_ORANGE, outline=ORANGE, title_fill=DARK, size=FS, title_size=F)
        source = (centre[2], centre[1] + 30 + i * 48)
        arrow(draw, source, mid(xy, "left"), colour=ORANGE, width=4, both=i in (0, 1))
    return save(image, out, "tech-context.png")


# --- 2. Module map ------------------------------------------------------------------------------
MODULE_BANDS = [
    ("Access and\ncontrol", [("Identity & access", "auth, access"), ("Configuration & master data", "settings"),
                             ("Audit", "audit")]),
    ("Distribution", [("Agency & agents", "agency"), ("Participants & AML", "participants, aml")]),
    ("Sales and\nservicing", [("Products & rating", "products"), ("Quotation & policy lifecycle", "policies"),
                              ("Documents & e-signature", "documents, esign"), ("Claims", "claims")]),
    ("Finance", [("Billing & receipts", "billing"), ("End-of-day", "eod")]),
    ("Control and\nsupport", [("Workflow / maker-checker", "workflow"), ("Issues", "issues"),
                              ("Notifications", "notifications")]),
    ("Insight", [("Reporting", "reports"), ("Dashboards", "dashboard")]),
    ("Integration", [("Integration & outbox", "integration"), ("Inbound system APIs", "integration-api"),
                     ("Health & metrics", "health")]),
]


def module_map(out):
    image, draw = new_canvas(W, 1220)
    y = 16
    for title, items in MODULE_BANDS:
        band(draw, y, 150, title, [(name, folder) for name, folder in items],
                     fill=LIGHT_GREY, item_fill=WHITE, size=F, item_size=None, title_size=F)
        y += 166
    draw.text((20, y + 6), "Grey text: source folder under apps/api/src/modules.", font=font(FS), fill=MUTED)
    return save(image, out, "tech-module-map.png")


# --- 3. Logical architecture --------------------------------------------------------------------
def logical(out):
    image, draw = new_canvas(W, 1150)
    y = 16
    band(draw, y, 140, "Clients", [("Agent/Banca Portal", "React 19 SPA, /portal"),
                                   ("Back-office", "React 19 SPA, /backoffice"),
                                   ("e-Signature page", "/esign/:token, no login")], item_fill=LIGHT_MAGENTA)
    y += 156
    band(draw, y, 120, "Edge", [("Reverse proxy / WAF", "TLS 1.2+, HSTS, static files"),
                                ("Routing", "/api to API; /backoffice internal only")])
    y += 136
    draw.rounded_rectangle([20, y, W - 20, y + 520], radius=16, fill=LIGHT_GREY, outline=MID_GREY, width=2)
    draw.rounded_rectangle([20, y, 250, y + 520], radius=16, fill=MAGENTA)
    text(draw, (20, y, 250, y + 520), "API\nNestJS 12\nNode.js 22\n/api/v1", size=F, bold=True, fill=WHITE)
    card(draw, (268, y + 14, W - 36, y + 124), "Request pipeline",
         "helmet, correlation id, session, throttling, authentication, CSRF, permissions, validation", size=FS)
    mods = ["auth / access", "agency", "participants / aml", "products", "policies", "billing", "claims",
            "documents / esign", "workflow", "issues", "notifications", "reports / dashboard", "audit / settings",
            "integration", "eod", "integration-api"]
    cols, gap = 4, 12
    cw = (W - 36 - 268 - gap * (cols - 1)) / cols
    for i, name in enumerate(mods):
        r, c = divmod(i, cols)
        x0 = 268 + c * (cw + gap)
        y0 = y + 138 + r * 62
        draw.rounded_rectangle((x0, y0, x0 + cw, y0 + 52), radius=10, fill=LIGHT_MAGENTA, outline=MAGENTA, width=2)
        text(draw, (x0, y0, x0 + cw, y0 + 52), name, size=FS)
    card(draw, (268, y + 396, 790, y + 506), "Common services", "Prisma, crypto, numbering, data scope",
         size=FS, fill=WHITE)
    card(draw, (806, y + 396, W - 36, y + 506), "Scheduled jobs", "@nestjs/schedule, advisory locks",
         size=FS, fill=LIGHT_ORANGE, outline=ORANGE, title_fill=DARK)
    y += 536
    band(draw, y, 140, "Data", [("PostgreSQL 16", "business data, sessions, audit, outbox"),
                                ("Document store", "AES-256-GCM encrypted files")],
         item_fill=PALE_BLUE, item_outline=BLUE)
    y += 156
    band(draw, y, 120, "External\nsystems", ["Core", "FIN", "AML", "SMTP", "SMS", "AD / LDAP"],
         item_fill=LIGHT_ORANGE, item_outline=ORANGE, size=F)
    return save(image, out, "tech-logical.png")


# --- 4. Request pipeline -------------------------------------------------------------------------
def flow(out, name, steps, cols=4, box_h=150, width=W, gap_x=56, gap_y=80, title=None, size=FS):
    """Left-to-right flow wrapping onto rows. Each step is (title, body, kind) where kind is
    'start', 'step', 'decision', 'end' or 'note'."""
    rows = (len(steps) + cols - 1) // cols
    top = 70 if title else 20
    height = top + rows * box_h + (rows - 1) * gap_y + 30
    image, draw = new_canvas(width, height)
    if title:
        draw.text((20, 14), title, font=font(FT, True), fill=MAGENTA)
    bw = (width - 40 - gap_x * (cols - 1)) / cols
    boxes = []
    for i, step in enumerate(steps):
        head, body, kind = (step + ("step",))[:3] if len(step) < 3 else step
        r, c = divmod(i, cols)
        x0 = 20 + c * (bw + gap_x)
        y0 = top + r * (box_h + gap_y)
        xy = (x0, y0, x0 + bw, y0 + box_h)
        style = {
            "start": dict(fill=MAGENTA, outline=MAGENTA, title_fill=WHITE),
            "end": dict(fill=GREEN, outline=GREEN, title_fill=WHITE),
            "decision": dict(fill=LIGHT_ORANGE, outline=ORANGE, title_fill=DARK),
            "note": dict(fill=LIGHT_GREY, outline=MID_GREY, title_fill=DARK),
            "step": dict(fill=WHITE, outline=MAGENTA, title_fill=MAGENTA),
        }[kind]
        card(draw, xy, head, body, size=size, title_size=size + 2, **style)
        if kind in ("start", "end") and body:
            # body text in white on dark fills
            draw.rounded_rectangle(xy, radius=14, fill=style["fill"], outline=style["outline"], width=3)
            text(draw, (xy[0], xy[1] + 8, xy[2], xy[1] + box_h * 0.42), head, size=size + 2, bold=True, fill=WHITE)
            text(draw, (xy[0], xy[1] + box_h * 0.38, xy[2], xy[3] - 6), body, size=size, fill=WHITE)
        boxes.append(xy)
    for i in range(len(boxes) - 1):
        a, b = boxes[i], boxes[i + 1]
        if a[1] == b[1]:
            arrow(draw, mid(a, "right"), mid(b, "left"), colour=DARK, width=4, head=16)
        else:
            sx, sy = mid(a, "bottom")
            tx, ty = mid(b, "top")
            ym = sy + gap_y / 2
            poly(draw, [(sx, sy), (sx, ym), (tx, ym), (tx, ty)], colour=DARK, width=4, head=16)
    return save(image, out, name)


def request_pipeline(out):
    steps = [
        ("Reverse proxy", "TLS termination, X-Request-Id, WAF rules", "start"),
        ("helmet", "security headers, x-powered-by off"),
        ("Correlation id", "X-Request-Id reused or new UUID"),
        ("Session", "express-session; row in user_session"),
        ("Request context", "user, IP, user agent in AsyncLocalStorage"),
        ("Throttler", "300 requests/min; login 10/min"),
        ("Authentication", "session, timeouts, audience"),
        ("CSRF guard", "X-CSRF-Token = session token"),
        ("Permissions guard", "@RequirePermissions codes"),
        ("Validation pipe", "DTO whitelist, unknown fields rejected"),
        ("Controller and service", "data scope, rules, one transaction"),
        ("Response or error", "AllExceptionsFilter: code, message, correlation id", "end"),
    ]
    return flow(out, "tech-request-pipeline.png", steps, cols=4, box_h=170, gap_y=70)


# --- 5. Entity overview --------------------------------------------------------------------------
def entities(out):
    image, draw = new_canvas(W, 1240)
    cw, ch, gx, gy = 240, 92, 39, 64
    def pos(c, r):
        x = 20 + c * (cw + gx)
        y = 20 + r * (ch + gy)
        return (x, y, x + cw, y + ch)
    groups = {
        "access": (LIGHT_MAGENTA, MAGENTA), "dist": (LIGHT_ORANGE, ORANGE), "policy": (WHITE, MAGENTA),
        "billing": (PALE_GREEN, GREEN), "flow": (PALE_BLUE, BLUE),
    }
    layout = {
        "role_permission": (0, 0, "access"), "role": (1, 0, "access"), "user_role": (2, 0, "access"),
        "app_user": (3, 0, "access"), "password_history": (4, 0, "access"),
        "agency": (1, 1, "dist"), "agent": (3, 1, "dist"), "notification": (4, 1, "flow"),
        "product": (0, 2, "policy"), "policy": (2, 2, "policy"), "participant": (4, 2, "dist"),
        "nominee": (0, 3, "policy"), "policy_event": (1, 3, "policy"), "signature_request": (2, 3, "policy"),
        "claim": (3, 3, "policy"), "commission": (4, 3, "billing"),
        "payment_allocation": (1, 4, "billing"), "payment": (2, 4, "billing"), "receipt": (3, 4, "billing"),
        "issue_comment": (4, 4, "flow"),
        "workflow_step": (0, 5, "flow"), "workflow_definition": (1, 5, "flow"), "approval_action": (2, 5, "flow"),
        "approval_request": (3, 5, "flow"), "issue": (4, 5, "flow"),
    }
    notes = {"agent": "parent_agent_id", "policy": "renewal_of_id"}
    boxes = {}
    tf = font(F, True)
    for name, (c, r, group) in layout.items():
        xy = pos(c, r)
        fill, outline = groups[group]
        draw.rounded_rectangle(xy, radius=12, fill=fill, outline=outline, width=3)
        if name in notes:
            text(draw, (xy[0], xy[1] + 4, xy[2], xy[1] + 52), name, size=F, bold=True)
            text(draw, (xy[0], xy[1] + 48, xy[2], xy[3] - 4), notes[name], size=24, fill=MUTED)
        elif draw.textlength(name, font=tf) > cw - 16:
            cut = name.index("_", len(name) // 2 - 3) + 1
            text(draw, xy, name[:cut] + "\n" + name[cut:], size=F, bold=True)
        else:
            text(draw, xy, name, size=F, bold=True)
        boxes[name] = xy
    L = lambda n, s: mid(boxes[n], s)  # noqa: E731
    c = DARK
    arrow(draw, L("role_permission", "right"), L("role", "left"), colour=c)
    arrow(draw, L("user_role", "left"), L("role", "right"), colour=c)
    arrow(draw, L("user_role", "right"), L("app_user", "left"), colour=c)
    arrow(draw, L("password_history", "left"), L("app_user", "right"), colour=c)
    arrow(draw, L("app_user", "bottom"), L("agent", "top"), colour=c, label="agent_id")
    arrow(draw, L("notification", "top"), (boxes["app_user"][2] - 30, boxes["app_user"][3]), colour=c)
    arrow(draw, L("agent", "left"), L("agency", "right"), colour=c, label="agency_id")
    ax0, ay0, ax1, ay1 = boxes["agent"]
    px0, py0, px1, py1 = boxes["policy"]
    arrow(draw, L("policy", "left"), L("product", "right"), colour=c)
    arrow(draw, L("policy", "right"), L("participant", "left"), colour=c)
    arrow(draw, (px0 + 60, py0), (boxes["agency"][0] + 160, boxes["agency"][3]), colour=c)
    arrow(draw, (px1 - 60, py0), (ax0 + 60, ay1), colour=c)
    for child in ("nominee", "policy_event", "claim"):
        x0, y0, x1, y1 = boxes[child]
        cx = (x0 + x1) / 2
        target_x = px0 + 40 if cx < px0 else px1 - 40
        poly(draw, [(cx, y0), (cx, y0 - 28), (target_x, y0 - 28), (target_x, py1)], colour=c, width=3, head=14)
    arrow(draw, L("signature_request", "top"), L("policy", "bottom"), colour=c)
    cx0, cy0, cx1, cy1 = boxes["commission"]
    ccx = (cx0 + cx1) / 2
    poly(draw, [(ccx - 40, cy0), (ccx - 40, cy0 - 28), (px1 - 20, cy0 - 28), (px1 - 20, py1)],
         colour=c, width=3, head=14)
    gap_y = (ay1 + py0) / 2
    poly(draw, [(ccx + 40, cy0), (ccx + 40, cy0 - 50), (cx0 - 18, cy0 - 50), (cx0 - 18, gap_y), (ax1 - 40, gap_y),
                (ax1 - 40, ay1)], colour=c, width=3, head=14)
    arrow(draw, L("payment_allocation", "right"), L("payment", "left"), colour=c)
    arrow(draw, L("receipt", "left"), L("payment", "right"), colour=c)
    sx0, sy0, sx1, sy1 = boxes["payment_allocation"]
    poly(draw, [(sx1 - 40, sy0), (sx1 - 40, sy0 - 26), (sx1 + 18, sy0 - 26), (sx1 + 18, py1 - 30), (px0, py1 - 30)],
         colour=GREEN, width=3, head=14)
    rx0, ry0, rx1, ry1 = boxes["receipt"]
    poly(draw, [(rx0 + 40, ry0), (rx0 + 40, ry0 - 26), (rx0 - 18, ry0 - 26), (rx0 - 18, py1 - 30), (px1, py1 - 30)],
         colour=GREEN, width=3, head=14)
    mx0, my0, mx1, my1 = boxes["payment"]
    gx0, gy0, gx1, gy1 = boxes["agency"]
    poly(draw, [((mx0 + mx1) / 2, my1), ((mx0 + mx1) / 2, my1 + 30), (8, my1 + 30), (8, (gy0 + gy1) / 2),
                (gx0, (gy0 + gy1) / 2)], colour=GREEN, width=3, head=14)
    arrow(draw, L("workflow_step", "right"), L("workflow_definition", "left"), colour=c)
    arrow(draw, L("approval_action", "right"), L("approval_request", "left"), colour=c)
    arrow(draw, L("issue_comment", "bottom"), L("issue", "top"), colour=c)
    y = pos(0, 6)[1] + 4
    zone(draw, (20, y, W - 20, y + 190), "Tables without foreign keys (polymorphic owner, logs or configuration)",
         size=FS)
    loose = ("document, audit_log, outbox_message, integration_log, reconciliation_run, eod_run, "
             "report_schedule, config_parameter, code_item, aml_screening, aml_watchlist_entry, user_session")
    text(draw, (30, y + 50, W - 30, y + 180), loose, size=F)
    draw.text((20, y + 204), "Arrow: child table points to its parent (foreign key). Grey text: self-reference.",
              font=font(FS), fill=MUTED)
    return save(image, out, "tech-entities.png")


# --- 6. Integration -------------------------------------------------------------------------------
def integration(out):
    image, draw = new_canvas(W, 1180)
    zone(draw, (20, 20, 460, 420), "One database transaction", fill=LIGHT_MAGENTA, outline=MAGENTA,
         title_fill=MAGENTA)
    labels = ["Business change\n(policy, receipt, agent)", "audit_log row", "outbox_message\nstatus PENDING"]
    for i, label in enumerate(labels):
        xy = (50, 80 + i * 112, 430, 170 + i * 112)
        draw.rounded_rectangle(xy, radius=12, fill=WHITE, outline=MAGENTA, width=3)
        text(draw, xy, label, size=FS)
    disp = (560, 60, 980, 250)
    card(draw, disp, "Outbox dispatcher", "every 20 s, batch of 25, advisory lock 'outbox-dispatch'", size=FS)
    arrow(draw, (460, 110), (disp[0], 110), colour=MAGENTA)
    gw = (560, 330, 980, 520)
    card(draw, gw, "Core / FIN gateway",
         "HTTPS JSON, x-api-key, Idempotency-Key = outbox id, 15 s timeout", size=FS)
    arrow(draw, mid(disp, "bottom"), mid(gw, "top"), colour=DARK)
    ext = (1080, 330, 1380, 520)
    card(draw, ext, "IITH Core / FIN", "operation paths, e.g. /policies, /receipts", fill=LIGHT_ORANGE,
         outline=ORANGE, title_fill=DARK, size=FS)
    arrow(draw, mid(gw, "right"), mid(ext, "left"), colour=ORANGE, both=True)
    ok = (1080, 60, 1380, 250)
    card(draw, ok, "Delivered", "status SENT, success logged", fill=PALE_GREEN, outline=GREEN,
         title_fill=GREEN, size=FS)
    arrow(draw, mid(ext, "top"), mid(ok, "bottom"), colour=GREEN, label="2xx", size=26)
    dec = (560, 610, 980, 800)
    card(draw, dec, "Retryable and attempts < 6?", "5xx, 408, 429, timeout: retryable; other 4xx: not",
         fill=LIGHT_ORANGE, outline=ORANGE, title_fill=DARK, size=FS)
    arrow(draw, mid(gw, "bottom"), mid(dec, "top"), colour=RED, label="error", size=26)
    retry = (60, 610, 460, 800)
    card(draw, retry, "FAILED, retry later", "back-off 1, 2, 4, 8 ... minutes, capped at 60", size=FS)
    arrow(draw, mid(dec, "left"), mid(retry, "right"), colour=DARK, label="yes", size=26)
    poly(draw, [mid(retry, "top"), (260, 560), (510, 560), (510, 200), (disp[0], 200)], colour=MUTED, dashed=True)
    dead = (1080, 610, 1380, 800)
    card(draw, dead, "DEAD (dead-letter)", "e-mail alert to integration support", fill=(253, 230, 230),
         outline=RED, title_fill=RED, size=FS)
    arrow(draw, mid(dec, "right"), mid(dead, "left"), colour=RED, label="no", size=26)
    mon = (1080, 890, 1380, 1080)
    card(draw, mon, "Integration monitor", "inspect; retry sets PENDING again", size=FS)
    arrow(draw, mid(dead, "bottom"), mid(mon, "top"), colour=DARK)
    eod = (60, 890, 520, 1080)
    card(draw, eod, "End-of-day 23:30", "EOD report, FIN file, EOD_POSTING message", fill=LIGHT_GREY,
         outline=MID_GREY, title_fill=DARK, size=FS)
    rec = (580, 890, 980, 1080)
    card(draw, rec, "Reconciliation", "receipts issued vs FIN posted: MATCHED or MISMATCH", fill=LIGHT_GREY,
         outline=MID_GREY, title_fill=DARK, size=FS)
    arrow(draw, mid(eod, "right"), mid(rec, "left"), colour=DARK)
    draw.text((20, 1120), "Inbound: Core and FIN call /api/v1/integration/* with an API key; every call is written "
                          "to integration_log.", font=font(26), fill=MUTED)
    return save(image, out, "tech-integration.png")


# --- 7. Security layers ------------------------------------------------------------------------------
def security_layers(out):
    image, draw = new_canvas(W, 1060)
    layers = [
        ("Network", ["WAF, TLS 1.2+", "DMZ / internal split", "IP allow-list for system APIs"]),
        ("HTTP", ["helmet headers, HSTS", "rate limiting", "2 MB JSON limit"]),
        ("Identity", ["Argon2id, lockout", "server-side sessions", "CSRF token, SameSite"]),
        ("Authorisation", ["audience + permissions", "data scope per agency", "maker-checker"]),
        ("Data", ["AES-256-GCM fields", "encrypted documents", "append-only audit"]),
        ("Operations", ["redacted JSON logs", "secrets outside code", "scans and VAPT"]),
    ]
    y = 16
    for i, (title, items) in enumerate(layers):
        shade = (255 - i * 4, 247 - i * 8, 251 - i * 6)
        band(draw, y, 150, title, items, fill=shade, item_fill=WHITE, size=F, title_size=F)
        y += 170
    return save(image, out, "tech-security-layers.png")


# --- 8. On-premise ------------------------------------------------------------------------------------
def on_prem(out):
    image, draw = new_canvas(W, 1420)
    zone(draw, (20, 20, 660, 190), "Internet", fill=WHITE)
    card(draw, (50, 70, 340, 175), "Agents, banks", "browser, HTTPS", fill=LIGHT_MAGENTA, size=FS)
    card(draw, (360, 70, 640, 175), "Participants", "e-sign link", fill=LIGHT_MAGENTA, size=FS)
    zone(draw, (700, 20, W - 20, 190), "IIFT internal network", fill=WHITE)
    card(draw, (730, 70, 1050, 175), "IIFT staff", "back-office", fill=LIGHT_MAGENTA, size=FS)
    card(draw, (1070, 70, 1360, 175), "IITH systems", "Core, FIN", fill=LIGHT_ORANGE,
         outline=ORANGE, title_fill=DARK, size=FS)
    zone(draw, (20, 220, W - 20, 400), "DMZ / edge", fill=LIGHT_GREY)
    lb1 = (60, 270, 660, 385)
    card(draw, lb1, "WAF + load balancer pair (external VIP)", "TLS 1.2+, HSTS, /portal, /esign, /api", size=FS)
    lb2 = (740, 270, W - 60, 385)
    card(draw, lb2, "Internal load balancer VIP", "/backoffice, /api, /api/v1/integration", size=FS)
    arrow(draw, (340, 190), (340, 270), colour=MAGENTA)
    arrow(draw, (890, 190), (890, 270), colour=MAGENTA)
    arrow(draw, (1210, 190), (1210, 270), colour=ORANGE)
    zone(draw, (20, 430, W - 20, 760), "Application zone", fill=LIGHT_GREY)
    apps = []
    for i in range(2):
        x0 = 60 + i * 660
        xy = (x0, 480, x0 + 600, 740)
        draw.rounded_rectangle(xy, radius=14, fill=WHITE, outline=MAGENTA, width=3)
        draw.text((x0 + 18, 490), f"App VM {i + 1}: 4 vCPU, 8 GB", font=font(F, True), fill=MAGENTA)
        for j, (name, body) in enumerate([("web", "nginx, SPA"), ("api", "NestJS :3000"), ("clamav", ":3310")]):
            bx = x0 + 18 + j * 192
            card(draw, (bx, 545, bx + 176, 720), name, body, fill=LIGHT_MAGENTA, size=26, title_size=F)
        apps.append(xy)
    for lb in (lb1, lb2):
        x = mid(lb, "bottom")[0]
        draw.line([(x, lb[3]), (x, 418)], fill=DARK, width=3)
    draw.line([(mid(apps[0], "top")[0], 418), (mid(apps[1], "top")[0], 418)], fill=DARK, width=3)
    for app in apps:
        arrow(draw, (mid(app, "top")[0], 418), mid(app, "top"), colour=DARK, width=3, head=14)
    zone(draw, (20, 790, W - 20, 1140), "Data zone", fill=LIGHT_GREY)
    db1 = (60, 845, 470, 1010)
    card(draw, db1, "PostgreSQL primary", "4 vCPU, 16 GB", fill=PALE_BLUE, outline=BLUE, title_fill=BLUE,
         size=FS)
    db2 = (560, 845, 970, 1010)
    card(draw, db2, "PostgreSQL standby", "4 vCPU, 16 GB, hot standby", fill=PALE_BLUE, outline=BLUE, title_fill=BLUE,
         size=FS)
    arrow(draw, mid(db1, "right"), mid(db2, "left"), colour=BLUE, label="WAL", size=26)
    nfs = (1040, 845, 1340, 1010)
    card(draw, nfs, "Document store", "NFS share, 500 GB, encrypted files", fill=PALE_BLUE, outline=BLUE,
         title_fill=BLUE, size=FS)
    bk = (60, 1030, 970, 1125)
    card(draw, bk, "Backup storage", "pgBackRest daily full + WAL archive; copy to DR site",
         fill=WHITE, outline=MID_GREY, title_fill=DARK, size=FS)
    arrow(draw, (360, 740), (265, 845), colour=BLUE, label="5432 TLS", size=26)
    arrow(draw, (1020, 740), (1190, 845), colour=BLUE, label="NFS", size=26)
    zone(draw, (20, 1170, W - 20, 1400), "Shared services and external", fill=WHITE)
    items = [("Monitoring", "Prometheus, Grafana, logs"), ("AD / LDAP", "636 LDAPS"), ("SMTP relay", "587"),
             ("SMS / AML", "443 via egress proxy")]
    for i, (name, body) in enumerate(items):
        x0 = 50 + i * 335
        card(draw, (x0, 1220, x0 + 305, 1380), name, body, fill=LIGHT_ORANGE if i else LIGHT_GREY,
             outline=ORANGE if i else MID_GREY, title_fill=DARK, size=FS)
    return save(image, out, "tech-on-prem.png")


# --- 9. Cloud --------------------------------------------------------------------------------------------
def cloud(out):
    image, draw = new_canvas(W, 1300)
    zone(draw, (20, 20, W - 20, 1170), "AWS Asia Pacific (Singapore) ap-southeast-1, one VPC", fill=WHITE,
         outline=ORANGE, title_fill=ORANGE)
    edge = (60, 80, W - 60, 190)
    card(draw, edge, "Application Load Balancer + AWS WAF (public subnets)", "ACM certificate, OWASP rule set",
         size=FS)
    for i, az in enumerate(["Availability zone a", "Availability zone b"]):
        x0 = 60 + i * 650
        zone(draw, (x0, 220, x0 + 610, 830), az, fill=LIGHT_GREY)
        card(draw, (x0 + 30, 280, x0 + 580, 430), "ECS Fargate task", "web (nginx) + api (NestJS), 1 vCPU, 2 GB",
             fill=LIGHT_MAGENTA, size=FS)
        name = "RDS PostgreSQL 16 primary" if i == 0 else "RDS synchronous standby"
        card(draw, (x0 + 30, 470, x0 + 580, 620), name, "db.t4g.large, 2 vCPU, 8 GB, gp3", fill=PALE_BLUE,
             outline=BLUE, title_fill=BLUE, size=FS)
        card(draw, (x0 + 30, 660, x0 + 580, 800), "EFS mount target", "documents, encrypted", fill=PALE_BLUE,
             outline=BLUE, title_fill=BLUE, size=FS)
        arrow(draw, (x0 + 305, 190), (x0 + 305, 280), colour=MAGENTA)
    arrow(draw, (640, 545), (720, 545), colour=BLUE, label="Multi-AZ", size=26)
    items = [("S3 + KMS", "backups, exports, cross-region copy"), ("Secrets Manager", "keys and credentials"),
             ("CloudWatch", "logs, metrics, alarms"), ("ECR", "signed images")]
    for i, (name, body) in enumerate(items):
        x0 = 60 + i * 325
        card(draw, (x0, 870, x0 + 300, 1020), name, body, fill=LIGHT_ORANGE, outline=ORANGE, title_fill=DARK,
             size=FS)
    card(draw, (60, 1050, W - 60, 1150), "Site-to-site VPN / Direct Connect to the IITH data centre",
         "Core, FIN, AD, SMTP relay and back-office users", fill=WHITE, outline=MID_GREY, title_fill=DARK, size=FS)
    draw.text((20, 1200), "Azure equivalent: Application Gateway + WAF, AKS or Container Apps, Azure Database for",
              font=font(26), fill=MUTED)
    draw.text((20, 1236), "PostgreSQL flexible server (zone-redundant HA), Azure Files, Blob Storage, Key Vault, "
                          "Azure Monitor.", font=font(26), fill=MUTED)
    return save(image, out, "tech-cloud.png")


# --- 10. Disaster recovery ----------------------------------------------------------------------------------
def dr(out):
    image, draw = new_canvas(W, 900)
    for i, title in enumerate(["Primary site (IITH data centre)", "DR site"]):
        x0 = 20 + i * 700
        zone(draw, (x0, 20, x0 + 660, 700), title, fill=LIGHT_GREY if i == 0 else WHITE, dashed=i == 1)
    card(draw, (60, 80, 640, 200), "App VMs 1 and 2 (active)", "web + api containers", fill=LIGHT_MAGENTA, size=FS)
    card(draw, (60, 240, 640, 380), "PostgreSQL primary + local standby", "streaming replication", fill=PALE_BLUE,
         outline=BLUE, title_fill=BLUE, size=FS)
    card(draw, (60, 420, 640, 540), "Document store (NFS)", "encrypted files", fill=PALE_BLUE, outline=BLUE,
         title_fill=BLUE, size=FS)
    card(draw, (60, 580, 640, 680), "Backup repository", "daily full + WAL archive", fill=WHITE, outline=MID_GREY,
         title_fill=DARK, size=FS)
    card(draw, (760, 80, 1340, 200), "App VM (cold)", "same images; started on invocation", fill=WHITE,
         outline=MAGENTA, size=FS, dashed=True)
    card(draw, (760, 240, 1340, 380), "PostgreSQL DR standby", "asynchronous replica, read-only", fill=PALE_BLUE,
         outline=BLUE, title_fill=BLUE, size=FS)
    card(draw, (760, 420, 1340, 540), "Document replica", "rsync every 15 min", fill=PALE_BLUE, outline=BLUE,
         title_fill=BLUE, size=FS)
    card(draw, (760, 580, 1340, 680), "Backup copy", "daily off-site copy", fill=WHITE, outline=MID_GREY,
         title_fill=DARK, size=FS)
    arrow(draw, (640, 310), (760, 310), colour=BLUE, label="WAL", size=26)
    arrow(draw, (640, 480), (760, 480), colour=BLUE, label="rsync", size=26)
    arrow(draw, (640, 630), (760, 630), colour=MUTED, label="copy", size=26)
    card(draw, (20, 740, 680, 880), "Targets", "RPO 15 minutes or better; RTO 4 hours", fill=LIGHT_ORANGE,
         outline=ORANGE, title_fill=DARK, size=F)
    card(draw, (720, 740, W - 20, 880), "Invocation", "promote standby, start app, switch DNS / VIP", fill=WHITE,
         outline=MAGENTA, size=F)
    return save(image, out, "tech-dr.png")


# --- 11. CI/CD -------------------------------------------------------------------------------------------------
def pipeline(out):
    steps = [
        ("Commit", "branch, pull request, peer review", "start"),
        ("Install", "npm ci (lockfile)"),
        ("Static checks", "oxlint, tsc --noEmit, prettier"),
        ("Unit tests", "Vitest, coverage"),
        ("API tests", "Vitest e2e against PostgreSQL 16"),
        ("Build", "prisma generate, nest build, vite build"),
        ("Security scans", "SAST, dependencies, secrets, image"),
        ("Package", "signed images, SBOM, release notes"),
        ("Deploy SIT", "db:migrate, smoke tests"),
        ("Deploy UAT", "same images, IIFT testing"),
        ("Change approval", "IIFT CAB, release window", "decision"),
        ("Deploy PROD", "db:migrate, rolling restart, checks", "end"),
    ]
    return flow(out, "tech-pipeline.png", steps, cols=4, box_h=150, gap_y=64)


# --- 12. Policy lifecycle ----------------------------------------------------------------------------------------
def lifecycle(out):
    image, draw = new_canvas(W, 900)
    s = {
        "DRAFT": (40, 330, 300, 440), "PENDING_APPROVAL": (440, 90, 820, 200),
        "PENDING_PAYMENT": (440, 330, 820, 440), "ACTIVE": (1040, 330, 1380, 440),
        "REJECTED": (40, 620, 300, 730), "EXPIRED": (1040, 620, 1380, 730), "CANCELLED": (1040, 90, 1380, 200),
    }
    colours = {"ACTIVE": (PALE_GREEN, GREEN), "REJECTED": ((253, 230, 230), RED), "EXPIRED": (LIGHT_GREY, MUTED),
               "CANCELLED": (LIGHT_GREY, MUTED), "DRAFT": (LIGHT_MAGENTA, MAGENTA)}
    for name, xy in s.items():
        fill, outline = colours.get(name, (LIGHT_ORANGE, ORANGE))
        draw.rounded_rectangle(xy, radius=40, fill=fill, outline=outline, width=4)
        text(draw, xy, name, size=F, bold=True)
    poly(draw, [(170, 330), (170, 145), (440, 145)], colour=DARK, label="referred", label_at=1, size=26)
    arrow(draw, (300, 385), (440, 385), colour=DARK, label="pay-first", size=26)
    poly(draw, [(240, 440), (240, 530), (1015, 530), (1015, 425), (1040, 425)], colour=DARK,
         label="issue-then-pay: issued now, 7-day grace", label_at=1, size=26)
    arrow(draw, (630, 200), (630, 330), colour=DARK, label="approved,\npay-first", size=26)
    poly(draw, [(820, 170), (1000, 170), (1000, 360), (1040, 360)], colour=DARK, label="approved,\nissue-then-pay",
         label_at=1, size=26)
    arrow(draw, (820, 400), (1040, 400), colour=GREEN, label="payment\nverified", size=26, label_pos=0.42)
    poly(draw, [(600, 90), (600, 40), (20, 40), (20, 675), (40, 675)], colour=RED, label="rejected (remarks)",
         label_at=1, size=26)
    arrow(draw, (170, 620), (170, 440), colour=MUTED, dashed=True, label="reopen", size=26)
    arrow(draw, (1210, 440), (1210, 620), colour=MUTED, label="end date passed\n(00:05 job)", size=26)
    arrow(draw, (1210, 330), (1210, 200), colour=MUTED, label="cancellation\napproved", size=26)
    draw.text((340, 640), "Submission without referral goes straight to", font=font(FS), fill=MUTED)
    draw.text((340, 676), "PENDING_PAYMENT or ACTIVE, by product setting.", font=font(FS), fill=MUTED)
    draw.text((40, 790), "Payment status runs alongside: UNPAID, PENDING_VERIFICATION, PAID.", font=font(FS),
              fill=MUTED)
    draw.text((40, 834), "An ACTIVE policy UNPAID after payment_due_date blocks new business for its agency.",
              font=font(FS), fill=MUTED)
    return save(image, out, "tech-lifecycle.png")


# --- Handover diagrams -----------------------------------------------------------------------------------------------
def support_model(out):
    image, draw = new_canvas(W, 960)
    users = (20, 40, 360, 240)
    card(draw, users, "Users", "agents, bank officers, IIFT staff: Issues module, e-mail, phone",
         fill=LIGHT_MAGENTA, size=FS, title_size=FT)
    tiers = [
        ("L1  IIFT helpdesk", "logs ticket, triage, password reset and unlock, known fixes"),
        ("L2  iorta application support", "diagnosis, configuration, data fixes, runbooks"),
        ("L3  iorta engineering", "code fixes, root cause, releases"),
    ]
    boxes = []
    for i, (title, body) in enumerate(tiers):
        xy = (450, 40 + i * 290, 1000, 240 + i * 290)
        card(draw, xy, title, body, fill=WHITE if i else LIGHT_ORANGE, outline=MAGENTA if i else ORANGE,
             title_fill=MAGENTA if i else DARK, size=F, title_size=FT)
        boxes.append(xy)
    arrow(draw, mid(users, "right"), mid(boxes[0], "left"), colour=DARK)
    for a, b in zip(boxes, boxes[1:]):
        arrow(draw, mid(a, "bottom"), mid(b, "top"), colour=DARK, label="escalate", size=26)
    infra = (20, 330, 360, 530)
    card(draw, infra, "Infrastructure owner", "IITH IT: servers, network, backup, DR site", fill=LIGHT_GREY,
         outline=MID_GREY, title_fill=DARK, size=FS, title_size=F)
    arrow(draw, mid(infra, "right"), mid(boxes[1], "left"), colour=MUTED, both=True)
    vendors = (1090, 330, 1380, 530)
    card(draw, vendors, "Third parties", "SMS, AML data, SMTP relay, certificates", fill=LIGHT_GREY,
         outline=MID_GREY, title_fill=DARK, size=FS, title_size=F)
    arrow(draw, mid(vendors, "left"), mid(boxes[1], "right"), colour=MUTED, both=True)
    draw.text((20, 900), "P1 incidents: telephone the on-call L2 engineer at any hour, and log a ticket.",
              font=font(FS), fill=MUTED)
    return save(image, out, "tech-support-model.png")


def incident_flow(out):
    steps = [
        ("Detect", "alert, user call or ticket", "start"),
        ("Log", "ticket in Issues module, correlation id"),
        ("Classify", "P1 to P4 by impact and urgency", "decision"),
        ("Respond", "acknowledge within SLA; P1 bridge call"),
        ("Diagnose", "logs, metrics, runbooks"),
        ("Workaround?", "yes: restore service, then root cause", "decision"),
        ("Resolve", "fix, configuration or release"),
        ("Verify", "user confirms; monitoring normal"),
        ("Close", "IIFT confirms; P1/P2 raise a problem", "end"),
    ]
    return flow(out, "tech-incident.png", steps, cols=3, box_h=150, gap_y=60)


def problem_flow(out):
    steps = [
        ("Identify", "every P1/P2, recurring incidents, trends", "start"),
        ("Record", "problem record linked to incidents"),
        ("Investigate", "timeline, logs, code, data"),
        ("Root cause", "5 whys; known error published", "decision"),
        ("Corrective action", "change request, test, release"),
        ("Close", "RCA report within 5 business days", "end"),
    ]
    return flow(out, "tech-problem.png", steps, cols=3, box_h=150, gap_y=60)


def change_flow(out):
    steps = [
        ("Request", "IIFT or iorta raises change request", "start"),
        ("Assess", "impact, risk, effort, rollback"),
        ("Quote", "within 60 h pool or rate card", "decision"),
        ("Approve", "IIFT CAB; emergency path for P1"),
        ("Build and test", "branch, review, SIT"),
        ("UAT", "IIFT sign-off"),
        ("Schedule", "release window agreed"),
        ("Implement", "release procedure"),
        ("Review", "post-implementation check", "end"),
    ]
    return flow(out, "tech-change.png", steps, cols=3, box_h=150, gap_y=60)


def release_flow(out):
    steps = [
        ("Freeze", "scope tagged, release notes", "start"),
        ("Package", "signed images, migration list"),
        ("Rehearse", "deploy to UAT with prod-like data"),
        ("Back up", "fresh backup, recovery point"),
        ("Migrate", "npm run db:migrate (one-off job)"),
        ("Roll out", "app VM 1 then VM 2, health checks"),
        ("Smoke test", "login, quote, EOD screen, integration"),
        ("Go / no-go", "keep or roll back within window", "decision"),
        ("Close", "notes published, CMDB updated", "end"),
    ]
    return flow(out, "tech-release.png", steps, cols=3, box_h=150, gap_y=60)


def cover_band(out):
    return base.cover_band(out)


ALL = {
    "context": context, "module_map": module_map, "logical": logical, "pipeline_req": request_pipeline,
    "entities": entities, "integration": integration, "security": security_layers, "on_prem": on_prem,
    "cloud": cloud, "dr": dr, "cicd": pipeline, "lifecycle": lifecycle,
}

HANDOVER = {
    "support": support_model, "incident": incident_flow, "problem": problem_flow, "change": change_flow,
    "release": release_flow, "dr": dr,
}


def render(names, out: Path) -> dict:
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    registry = {**ALL, **HANDOVER}
    figures = {name: registry[name](out) for name in names}
    figures["cover_band"] = cover_band(out)
    return figures


if __name__ == "__main__":
    import sys
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("figures")
    print(render(list({**ALL, **HANDOVER}), target))
