#!/usr/bin/env node
/**
 * Captures the proposal screenshots listed in docs/proposal/build/screen_manifest.py.
 *
 *   node tools/screenshots/capture.mjs [--only 25,26,70] [--persona finance] [--out DIR] [--list] [--dry-run]
 *
 * Environment
 *   BASE_URL           web application, default http://localhost:5173
 *   DEMO_PASSWORD      password of the demo users (required unless --list / --dry-run)
 *   PASSWORD_<USER>    password for one user, e.g. PASSWORD_ADMIN (dots in the user name become _)
 *   CHANGE_PASSWORD_TO when a user must change the password at first sign-in, set it to this value
 *   CHROMIUM_PATH      default /opt/pw-browsers/chromium-1194/chrome-linux/chrome
 *   PLAYWRIGHT_CORE    path of the playwright-core package when it is not resolvable from here
 *   MANIFEST_JSON      a pre-exported manifest (default: `python3 screen_manifest.py --json` is run)
 *   OUT_DIR            default docs/proposal/screenshots
 *   <NAME>             any ${NAME} placeholder in a route, e.g. ESIGN_TOKEN
 *
 * Captures are 1440 x 900 CSS pixels at device scale factor 1.5 (2160 x 1350 px), taken after the
 * network is idle. Console errors raised on a page are reported with the entry. The manifest is the
 * single source of truth: edit docs/proposal/build/screen_manifest.py, not this file, to change what
 * is captured.
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const require = createRequire(import.meta.url);

function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_CORE,
    'playwright-core',
    '/opt/node-tools/node_modules/playwright-core',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // try the next location
    }
  }
  throw new Error('playwright-core not found; set PLAYWRIGHT_CORE to its package directory');
}

function parseArgs(argv) {
  const args = { only: null, persona: null, out: null, list: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--only') args.only = argv[++i].split(',').map((s) => s.trim());
    else if (arg === '--persona') args.persona = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--list') args.list = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else throw new Error(`Unknown argument ${arg}`);
  }
  return args;
}

function loadManifest() {
  if (process.env.MANIFEST_JSON) return JSON.parse(readFileSync(process.env.MANIFEST_JSON, 'utf8'));
  const script = resolve(repo, 'docs/proposal/build/screen_manifest.py');
  return JSON.parse(execFileSync('python3', [script, '--json'], { encoding: 'utf8' }));
}

/** Fills ${NAME} placeholders from the environment; returns null when one is missing. */
function resolveRoute(route) {
  let missing = null;
  const resolved = route.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name) => {
    if (!process.env[name]) missing = name;
    return process.env[name] ?? '';
  });
  return missing ? { missing } : { route: resolved };
}

function passwordFor(user) {
  const key = `PASSWORD_${user.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  return process.env[key] ?? process.env.DEMO_PASSWORD;
}

/** "/^RQ\//" style strings become regular expressions; everything else is an exact name. */
function nameMatcher(value) {
  if (typeof value === 'string' && value.length > 2 && value.startsWith('/') && value.lastIndexOf('/') > 0) {
    const end = value.lastIndexOf('/');
    return new RegExp(value.slice(1, end), value.slice(end + 1));
  }
  return value;
}

async function selectOption(page, label, option) {
  // Ant Design selects render a virtual list, so an option may not be in the DOM until it is
  // reached; walk the list with the keyboard and confirm the active option by its label.
  const combobox = page.getByRole('combobox', { name: label }).first();
  await combobox.click();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(80);
    const activeId = await combobox.getAttribute('aria-activedescendant');
    if (!activeId) continue;
    const active = page.locator(`[id="${activeId}"]`);
    const name = (await active.getAttribute('aria-label')) ?? (await active.textContent());
    if (name && name.trim() === option) {
      await page.keyboard.press('Enter');
      return;
    }
  }
  throw new Error(`Option "${option}" not found in "${label}"`);
}

async function runAction(page, action) {
  if (action.click) {
    const { role, name, first, exact, nth } = action.click;
    let locator = page.getByRole(role, { name: nameMatcher(name), exact: exact ?? false });
    if (nth !== undefined) locator = locator.nth(nth);
    else if (first || role === 'link') locator = locator.first();
    await locator.click();
  } else if (action.clickText) {
    await page.getByText(action.clickText, { exact: true }).first().click();
  } else if (action.fill) {
    await page.getByLabel(action.fill.label).fill(action.fill.value);
  } else if (action.select) {
    await selectOption(page, action.select.label, action.select.option);
  } else if (action.press) {
    await page.keyboard.press(action.press);
  } else if (action.type) {
    await page.keyboard.type(action.type, { delay: 40 });
  } else if (action.wait) {
    await page.waitForTimeout(action.wait);
  } else if (action.checkFirstRow) {
    // row checkboxes are labelled "Select <reference>"; the header box is "Select all"
    await page.getByRole('checkbox', { name: /^Select (?!all)/i, disabled: false }).first().check();
  } else if (action.checkAllRows) {
    await page.getByRole('checkbox', { name: /select all/i }).first().check();
  } else {
    throw new Error(`Unknown action ${JSON.stringify(action)}`);
  }
  await settle(page);
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(400);
}

async function signIn(page, baseUrl, user) {
  const password = passwordFor(user);
  if (!password) throw new Error(`No password for ${user}: set DEMO_PASSWORD or PASSWORD_${user.toUpperCase()}`);
  // The API allows a limited number of sign-ins per minute per address; wait out the window
  // when an attempt is refused for that reason.
  for (let attempt = 1; ; attempt++) {
    await page.goto(`${baseUrl}/login`);
    await page.getByLabel('Username').fill(user);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    try {
      await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
      break;
    } catch {
      const alert = (await page.getByRole('alert').first().textContent().catch(() => '')) ?? '';
      if (attempt < 3 && /too many|rate|try again/i.test(alert)) {
        console.log(`sign-in of ${user} throttled; waiting 65 s before attempt ${attempt + 1}`);
        await page.waitForTimeout(65_000);
        continue;
      }
      throw new Error(`sign-in of ${user} did not complete${alert ? `: ${alert.trim()}` : ''}`);
    }
  }
  if (new URL(page.url()).pathname.startsWith('/change-password')) {
    const next = process.env.CHANGE_PASSWORD_TO;
    if (!next) throw new Error(`${user} must change the password at first sign-in; set CHANGE_PASSWORD_TO`);
    await page.getByLabel('Current password').fill(password);
    await page.getByLabel('New password', { exact: true }).fill(next);
    await page.getByLabel('Confirm new password').fill(next);
    await page.getByRole('button', { name: /change password|save/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/change-password'), { timeout: 15_000 });
  }
  await settle(page);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = (process.env.BASE_URL ?? 'http://localhost:5173').replace(/\/$/, '');
  const outDir = resolve(repo, args.out ?? process.env.OUT_DIR ?? 'docs/proposal/screenshots');
  let entries = loadManifest().filter((entry) => !entry.manual);
  if (args.only) entries = entries.filter((entry) => args.only.some((id) => entry.file.startsWith(id)));
  if (args.persona) entries = entries.filter((entry) => entry.persona === args.persona);

  if (args.list) {
    for (const entry of entries) console.log(`${entry.file.padEnd(40)} ${(entry.user ?? '-').padEnd(12)} ${entry.route}`);
    return;
  }
  if (args.dryRun) {
    for (const entry of entries) {
      const { missing } = resolveRoute(entry.route);
      console.log(`${entry.file.padEnd(40)} ${missing ? `skipped: ${missing} not set` : 'ready'}`);
    }
    return;
  }

  const { chromium } = loadPlaywright();
  const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  if (!existsSync(executablePath)) throw new Error(`Chromium not found at ${executablePath}; set CHROMIUM_PATH`);
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath, headless: true });
  const results = [];

  // One browser context per user keeps the sign-in; public pages use an anonymous context.
  const byUser = new Map();
  for (const entry of entries) {
    const key = entry.user ?? '';
    if (!byUser.has(key)) byUser.set(key, []);
    byUser.get(key).push(entry);
  }

  for (const [user, userEntries] of byUser) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1.5,
      locale: 'en-GB',
      timezoneId: 'Asia/Brunei',
    });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    try {
      if (user) await signIn(page, baseUrl, user);
    } catch (error) {
      for (const entry of userEntries) results.push({ file: entry.file, status: 'failed', detail: `sign-in: ${error.message}` });
      await context.close();
      continue;
    }

    for (const entry of userEntries) {
      consoleErrors.length = 0;
      const { route, missing } = resolveRoute(entry.route);
      if (missing) {
        results.push({ file: entry.file, status: 'skipped', detail: `${missing} not set` });
        continue;
      }
      try {
        await page.goto(`${baseUrl}${route}`);
        await settle(page);
        for (const action of entry.actions) await runAction(page, action);
        await page.screenshot({ path: resolve(outDir, entry.file) });
        results.push({
          file: entry.file,
          status: 'captured',
          detail: consoleErrors.length ? `console errors: ${consoleErrors.join(' | ').slice(0, 300)}` : '',
        });
      } catch (error) {
        results.push({ file: entry.file, status: 'failed', detail: error.message.split('\n')[0].slice(0, 300) });
      }
    }
    await context.close();
  }
  await browser.close();

  let failed = 0;
  for (const result of results) {
    if (result.status === 'failed') failed++;
    console.log(`${result.status.padEnd(9)} ${result.file.padEnd(40)} ${result.detail}`);
  }
  console.log(`\n${results.filter((r) => r.status === 'captured').length} captured, ` +
    `${results.filter((r) => r.status === 'skipped').length} skipped, ${failed} failed -> ${outDir}`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
