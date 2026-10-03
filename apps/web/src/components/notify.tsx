/**
 * Notices for completed actions. Success and background-error notices are shown top-right
 * as a titled notification ("Documents sent" / "Sent to name@example.com") that closes
 * after four seconds. Errors of the action the user is looking at belong in an `ErrorAlert`
 * next to the form instead; `error` here is for actions without a form on screen.
 *
 * Titles are short, past-tense outcomes ("Payment submitted for verification"), never
 * sentences; the description carries one line of data (a reference, an address, a date).
 */
import {
  CheckCircleFilled,
  CloseCircleFilled,
  ExclamationCircleFilled,
  InfoCircleFilled,
} from '@ant-design/icons';
import { App } from 'antd';
import type { ArgsProps } from 'antd/es/notification';
import { useMemo } from 'react';

export interface Notice {
  title: string;
  description?: string;
}

export type NoticeInput = string | Notice;

export function toNotice(input: NoticeInput): Notice {
  return typeof input === 'string' ? { title: input } : input;
}

const ICONS = {
  success: <CheckCircleFilled className="app-notice__icon app-notice__icon--success" />,
  error: <CloseCircleFilled className="app-notice__icon app-notice__icon--error" />,
  warning: <ExclamationCircleFilled className="app-notice__icon app-notice__icon--warning" />,
  info: <InfoCircleFilled className="app-notice__icon app-notice__icon--info" />,
} as const;

type Kind = keyof typeof ICONS;

export function useNotify() {
  const { notification } = App.useApp();
  return useMemo(() => {
    const show = (kind: Kind, input: NoticeInput) => {
      const notice = toNotice(input);
      const args: ArgsProps = {
        title: notice.title,
        description: notice.description,
        icon: ICONS[kind],
        placement: 'topRight',
        duration: kind === 'error' ? 6 : 4,
        className: `app-notice app-notice--${kind}`,
        role: kind === 'error' ? 'alert' : 'status',
      };
      notification.open(args);
    };
    return {
      success: (input: NoticeInput) => show('success', input),
      error: (input: NoticeInput) => show('error', input),
      warning: (input: NoticeInput) => show('warning', input),
      info: (input: NoticeInput) => show('info', input),
    };
  }, [notification]);
}
