import { CheckCircleFilled, ClockCircleOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Progress, Typography } from 'antd';
import type { ReactNode } from 'react';
import type { PolicyDetail } from '../../api/types';
import { formatDateTime, formatMoney } from '../../utils/format';
import { formatTerm } from './options';
import type { Signer } from './SignatureModal';

export type DraftAction =
  'coverage' | 'questionnaire' | 'nominees' | 'documents' | 'link' | `sign-${Lowercase<Signer>}`;

interface Item {
  key: string;
  title: string;
  done: boolean;
  optional?: boolean;
  detail: string;
  actions: { action: DraftAction; label: string }[];
}

const PARTICIPANT_SIGNATURE_TYPES = ['SIGNATURE_PARTICIPANT', 'SIGNED_PROPOSAL_FORM'];

function hasDocument(policy: PolicyDetail, types: string[]): boolean {
  return policy.documents.some((doc) => types.includes(doc.docType));
}

function checklist(policy: PolicyDetail): Item[] {
  const { product } = policy;
  const items: Item[] = [
    {
      key: 'coverage',
      title: 'Coverage and contribution',
      done: true,
      detail: `${formatTerm(policy.termMonths)} · ${formatMoney(policy.sumCovered)} covered · ${formatMoney(policy.contribution)}`,
      actions: [{ action: 'coverage', label: 'Edit coverage' }],
    },
  ];

  if (product.questionnaire.length > 0) {
    const answered = product.questionnaire.every((question) => {
      const answer = policy.questionnaire?.find((candidate) => candidate.code === question.code);
      return answer && (!answer.answer || Boolean(answer.details?.trim()));
    });
    items.push({
      key: 'questionnaire',
      title: 'Declarations',
      done: answered,
      detail: answered ? 'Answered' : `${product.questionnaire.length} questions`,
      actions: [{ action: 'questionnaire', label: answered ? 'Review answers' : 'Answer' }],
    });
  }

  if (product.config.requiresNominee === true) {
    items.push({
      key: 'nominees',
      title: 'Nominees',
      done: policy.nominees.length > 0,
      detail:
        policy.nominees.length > 0
          ? policy.nominees
              .map((nominee) => `${nominee.fullName} (${Number(nominee.sharePercent)}%)`)
              .join(', ')
          : 'None added',
      actions: [
        {
          action: 'nominees',
          label: policy.nominees.length > 0 ? 'Edit nominees' : 'Add nominees',
        },
      ],
    });
  }

  const mandatory = product.requiredDocuments.filter((doc) => doc.mandatory);
  if (mandatory.length > 0) {
    const missing = mandatory.filter((doc) => policy.missingDocuments.includes(doc.docType));
    items.push({
      key: 'documents',
      title: 'Mandatory documents',
      done: missing.length === 0,
      detail:
        missing.length === 0
          ? `${mandatory.length} of ${mandatory.length} uploaded`
          : `Missing: ${missing.map((doc) => doc.label).join(', ')}`,
      actions: [{ action: 'documents', label: 'Upload documents' }],
    });
  }

  const participantSigned = hasDocument(policy, PARTICIPANT_SIGNATURE_TYPES);
  const pendingLink = policy.signatures.find(
    (link) => !link.signedAt && new Date(link.expiresAt) > new Date(),
  );
  items.push({
    key: 'participant-signature',
    title: 'Participant signature',
    done: participantSigned,
    detail: participantSigned
      ? 'Signed'
      : pendingLink
        ? `Link sent to ${pendingLink.recipientEmail} · expires ${formatDateTime(pendingLink.expiresAt)}`
        : 'Not signed',
    actions: participantSigned
      ? []
      : [
          { action: 'sign-participant', label: 'Sign on screen' },
          { action: 'link', label: pendingLink ? 'Resend link' : 'Send link' },
        ],
  });

  const agentSigned = hasDocument(policy, ['SIGNATURE_AGENT']);
  items.push({
    key: 'agent-signature',
    title: 'Agent signature',
    done: agentSigned,
    optional: true,
    detail: agentSigned ? 'Signed' : 'Not signed',
    actions: agentSigned ? [] : [{ action: 'sign-agent', label: 'Sign on screen' }],
  });
  return items;
}

interface Props {
  policy: PolicyDetail;
  canEdit: boolean;
  onAction(action: DraftAction): void;
  submit: ReactNode;
}

/** AP-19/25/62: what remains before a draft application can be submitted, with an action per item. */
export function CompletionChecklist({ policy, canEdit, onAction, submit }: Props) {
  const items = checklist(policy);
  const required = items.filter((item) => !item.optional);
  const complete = required.filter((item) => item.done).length;

  return (
    <Card
      className="content-card content-card--flush"
      title="Application checklist"
      extra={
        <Flex align="center" gap={12}>
          <Progress
            percent={Math.round((complete / required.length) * 100)}
            steps={required.length}
            size="small"
            showInfo={false}
            aria-label="Required steps complete"
          />
          <Typography.Text type="secondary">
            {complete} of {required.length} required
          </Typography.Text>
          {submit}
        </Flex>
      }
    >
      <ul className="checklist">
        {items.map((item) => (
          <li
            key={item.key}
            className={`checklist__item${item.done ? ' checklist__item--done' : ''}`}
            aria-label={item.title}
          >
            <span className="checklist__icon">
              {item.done ? (
                <CheckCircleFilled aria-label="Complete" />
              ) : (
                <ClockCircleOutlined aria-label="To do" />
              )}
            </span>
            <span className="checklist__title">
              {item.title}
              {item.optional && <span className="muted"> (recommended)</span>}
            </span>
            <span
              className="checklist__detail"
              title={typeof item.detail === 'string' ? item.detail : undefined}
            >
              {item.detail}
            </span>
            <span className="checklist__actions">
              {canEdit &&
                item.actions.map(({ action, label }) => (
                  <Button key={action} size="small" onClick={() => onAction(action)}>
                    {label}
                  </Button>
                ))}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
