/** Vendor credit and release label, shown in the shell footer and on the sign-in page. */
import iortaLogo from '../assets/iorta-technxt-logo.png';
import { APP_ENVIRONMENT, APP_VERSION } from '../config/app';

export function PoweredBy() {
  return (
    <span className="powered-by">
      Powered by
      <img src={iortaLogo} alt="iorta TechNXT" />
    </span>
  );
}

export function ReleaseLabel() {
  return (
    <span className="env-label">
      v{APP_VERSION}
      {APP_ENVIRONMENT && <span className="env-label__env">{APP_ENVIRONMENT}</span>}
    </span>
  );
}
