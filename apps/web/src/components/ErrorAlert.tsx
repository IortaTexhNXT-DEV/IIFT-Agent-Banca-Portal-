import { Alert } from 'antd';
import { ApiError } from '../api/client';

/** Short outcome shown as the alert title; the server's message is the description. */
function outcomeFor(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Request failed';
  if (error.status === 401) return 'Session ended';
  if (error.status === 403) return 'Not permitted';
  if (error.status === 404) return 'Record not found';
  if (error.status === 409) return 'Record has changed';
  if (error.status >= 500) return 'Request failed';
  return 'Not accepted';
}

/**
 * In-context API error: a short outcome ("Nominees not saved"), the server's message,
 * field-level details and, for server faults, the reference to quote to support.
 */
export function ErrorAlert({
  error,
  className,
  title,
}: {
  error: unknown;
  className?: string;
  /** Outcome of the action that failed, e.g. "Documents not sent". */
  title?: string;
}) {
  if (!error) return null;
  const apiError = error instanceof ApiError ? error : undefined;
  const message = apiError?.message ?? 'Something went wrong. Please try again.';
  const reference = apiError?.correlationId && apiError.status >= 500 && apiError.correlationId;
  return (
    <Alert
      className={`error-alert${className ? ` ${className}` : ''}`}
      type="error"
      showIcon
      title={title ?? outcomeFor(error)}
      description={
        <>
          <div>{message}</div>
          {apiError && apiError.details.length > 0 && (
            <ul className="error-details">
              {apiError.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
          {reference && <div className="error-alert__ref">Reference: {reference}</div>}
        </>
      }
    />
  );
}
