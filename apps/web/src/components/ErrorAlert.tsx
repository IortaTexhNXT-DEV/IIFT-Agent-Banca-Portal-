import { Alert } from 'antd';
import { ApiError } from '../api/client';

/** Shows an API error with its field-level details and the support reference. */
export function ErrorAlert({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null;
  const apiError = error instanceof ApiError ? error : undefined;
  const description =
    apiError && (apiError.details.length > 0 || apiError.correlationId) ? (
      <>
        {apiError.details.length > 0 && (
          <ul className="error-details">
            {apiError.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        )}
        {apiError.correlationId && apiError.status >= 500 && <span className="muted">Reference: {apiError.correlationId}</span>}
      </>
    ) : undefined;
  return <Alert className={className} type="error" showIcon title={apiError?.message ?? 'Something went wrong. Please try again.'} description={description} />;
}
