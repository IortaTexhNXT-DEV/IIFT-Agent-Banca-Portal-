import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'ldapts';
import { AppConfig } from '../../config/app-config.js';

/**
 * Verifies back-office credentials against the enterprise directory (Active Directory /
 * LDAP, INT-06). The service account looks the user up, then the user's own DN is
 * bound with the supplied password. LDAPS should be used in production.
 */
@Injectable()
export class DirectoryAuthenticator {
  private readonly logger = new Logger(DirectoryAuthenticator.name);

  constructor(private readonly config: AppConfig) {}

  get isConfigured(): boolean {
    return this.config.directory !== undefined;
  }

  async verify(username: string, password: string): Promise<boolean> {
    const directory = this.config.directory;
    if (!directory || password.length === 0) {
      return false;
    }
    const client = new Client({ url: directory.url, timeout: 10_000, connectTimeout: 10_000 });
    try {
      await client.bind(directory.bindDn, directory.bindPassword);
      const filter = directory.userFilter.replace('{{username}}', escapeFilterValue(username));
      const { searchEntries } = await client.search(directory.baseDn, {
        scope: 'sub',
        filter,
        attributes: ['dn'],
        sizeLimit: 2,
      });
      if (searchEntries.length !== 1) {
        return false;
      }
      await client.bind(searchEntries[0].dn, password);
      return true;
    } catch (error) {
      this.logger.warn(
        `Directory authentication failed for ${username}: ${(error as Error).message}`,
      );
      return false;
    } finally {
      await client.unbind().catch(() => undefined);
    }
  }
}

/** RFC 4515 escaping so a username cannot alter the LDAP search filter. */
function escapeFilterValue(value: string): string {
  return value.replace(
    /[\\*()\0]/g,
    (char) => `\\${char.charCodeAt(0).toString(16).padStart(2, '0')}`,
  );
}
