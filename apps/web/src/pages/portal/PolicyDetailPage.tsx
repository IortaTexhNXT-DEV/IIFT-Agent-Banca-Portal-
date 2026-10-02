import { Alert, App, Button, Popconfirm } from 'antd';
import { type ReactNode, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { PolicyDetail, PolicySummary, RequiredDocument } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { ErrorAlert } from '../../components/ErrorAlert';
import { QueryState } from '../../components/QueryState';
import { CancellationModal } from '../../components/sales/CancellationModal';
import { CompletionChecklist, type DraftAction } from '../../components/sales/CompletionChecklist';
import { CoverageDrawer } from '../../components/sales/CoverageDrawer';
import { EmailDocumentsModal, hasIssuedDocuments } from '../../components/sales/EmailDocumentsModal';
import { EndorsementModal } from '../../components/sales/EndorsementModal';
import { NomineesModal } from '../../components/sales/NomineesModal';
import { PolicyPageHeader } from '../../components/sales/PolicyPageHeader';
import { type PolicyTabKey, PolicyTabs } from '../../components/sales/PolicyTabs';
import { QuestionnaireModal } from '../../components/sales/QuestionnaireModal';
import { SignatureLinkModal } from '../../components/sales/SignatureLinkModal';
import { SignatureModal } from '../../components/sales/SignatureModal';
import { formatDate, formatMoney } from '../../utils/format';
import { P } from '../../utils/permissions';
import '../../styles/sales.css';

type Dialog = Exclude<DraftAction, 'documents'> | 'endorse' | 'cancel' | 'email';

/** Signed proposal forms and scanned signatures are accepted in place of on-screen signing. */
const SIGNATURE_UPLOADS: RequiredDocument[] = [
  { docType: 'SIGNED_PROPOSAL_FORM', label: 'Signed proposal form', mandatory: false },
  { docType: 'SIGNATURE_PARTICIPANT', label: 'Participant signature', mandatory: false },
  { docType: 'SIGNATURE_AGENT', label: 'Agent signature', mandatory: false },
];

const SUBMIT_OUTCOMES: Partial<Record<PolicySummary['status'], string>> = {
  PENDING_APPROVAL: 'Submitted and referred to IIFT for approval',
  PENDING_PAYMENT: 'Accepted – the e-Policy is issued once the contribution is paid',
  ACTIVE: 'Policy issued',
};

function DialogFor({ dialog, policy, onClose }: { dialog: Dialog | null; policy: PolicyDetail; onClose(): void }) {
  switch (dialog) {
    case 'coverage':
      return <CoverageDrawer policy={policy} onClose={onClose} />;
    case 'questionnaire':
      return <QuestionnaireModal policy={policy} onClose={onClose} />;
    case 'nominees':
      return <NomineesModal policy={policy} onClose={onClose} />;
    case 'sign-participant':
      return <SignatureModal policy={policy} signer="PARTICIPANT" onClose={onClose} />;
    case 'sign-agent':
      return <SignatureModal policy={policy} signer="AGENT" onClose={onClose} />;
    case 'link':
      return <SignatureLinkModal policy={policy} onClose={onClose} />;
    case 'endorse':
      return <EndorsementModal policy={policy} onClose={onClose} />;
    case 'cancel':
      return <CancellationModal policy={policy} onClose={onClose} />;
    case 'email':
      return <EmailDocumentsModal policy={policy} onClose={onClose} />;
    default:
      return null;
  }
}

function PolicyView({ policy }: { policy: PolicyDetail }) {
  const { can } = useAuth();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<PolicyTabKey>('overview');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const path = `/portal/policies/${policy.id}`;
  const invalidate = ['/portal/policies', '/portal/dashboard'];

  const submit = useApiMutation(() => api.post<PolicySummary>(`${path}/submit`), {
    invalidate,
    onSuccess: (result) => message.success(SUBMIT_OUTCOMES[result.status] ?? 'Application submitted'),
  });
  const discard = useApiMutation(() => api.post(`${path}/discard`), { success: 'Quotation discarded', invalidate });
  const reopen = useApiMutation(() => api.post(`${path}/reopen`), { success: 'Quotation reopened for revision', invalidate });
  const renew = useApiMutation(() => api.post<{ id: string }>(`${path}/renew`), {
    success: 'Renewal quotation created',
    invalidate,
    onSuccess: (created) => navigate(`/portal/policies/${created.id}`),
  });

  const { status, paymentStatus, product } = policy;
  const canQuote = can(P.portalPoliciesQuote);
  const canService = can(P.portalPoliciesService);
  const draft = status === 'DRAFT';
  const discardable = ['DRAFT', 'PENDING_PAYMENT', 'REJECTED'].includes(status) && paymentStatus === 'UNPAID';
  const blocked = draft && policy.agency.issuanceBlocked;
  const awaitingPayment = ['PENDING_PAYMENT', 'ACTIVE'].includes(status) && paymentStatus === 'UNPAID' && Number(policy.outstandingAmount) > 0;
  const claimable = ['ACTIVE', 'EXPIRED'].includes(status) && policy.policyNo !== null && can(P.portalClaimsSubmit);

  const actions: ReactNode[] = [];
  if (awaitingPayment && can(P.portalBillingSubmit)) {
    actions.push(
      <Button key="pay" type="primary" onClick={() => navigate('/portal/billing')}>
        Submit payment
      </Button>,
    );
  }
  if (status === 'REJECTED' && canQuote) {
    actions.push(
      <Button key="reopen" type="primary" loading={reopen.isPending} onClick={() => reopen.mutate(undefined)}>
        Reopen for revision
      </Button>,
    );
  }
  if (['ACTIVE', 'EXPIRED'].includes(status) && product.allowRenewal && canService) {
    actions.push(
      <Popconfirm key="renew" title="Create a renewal quotation?" description="The cover, nominees and risk details are copied to a new quotation." okText="Create" onConfirm={() => renew.mutate(undefined)}>
        <Button loading={renew.isPending}>Renew</Button>
      </Popconfirm>,
    );
  }
  if (status === 'ACTIVE' && canService) {
    actions.push(
      <Button key="endorse" onClick={() => setDialog('endorse')}>
        Request endorsement
      </Button>,
      <Button key="cancel" danger onClick={() => setDialog('cancel')}>
        Request cancellation
      </Button>,
    );
  }
  if (hasIssuedDocuments(policy)) {
    actions.push(
      <Button key="email" onClick={() => setDialog('email')}>
        E-mail documents
      </Button>,
    );
  }
  if (discardable && canQuote) {
    actions.push(
      <Popconfirm key="discard" title="Discard this quotation?" description="It is cancelled and cannot be submitted again." okText="Discard" okButtonProps={{ danger: true }} onConfirm={() => discard.mutate(undefined)}>
        <Button danger loading={discard.isPending}>
          Discard
        </Button>
      </Popconfirm>,
    );
  }

  const handleDraftAction = (action: DraftAction) => {
    if (action === 'documents') {
      setTab('documents');
    } else {
      setDialog(action);
    }
  };

  return (
    <>
      <PolicyPageHeader policy={policy} actions={actions.length > 0 ? actions : undefined} />
      <ErrorAlert error={reopen.error ?? discard.error ?? renew.error} className="mb-16" />

      {status === 'REJECTED' && <Alert className="mb-16" type="error" showIcon title="Rejected by IIFT" description={policy.rejectedReason ?? 'No reason was recorded.'} />}
      {status === 'PENDING_APPROVAL' && (
        <Alert className="mb-16" type="info" showIcon title="Awaiting IIFT approval" description="The application was referred for underwriting. You are notified when a decision is made." />
      )}
      {awaitingPayment && (
        <Alert
          className="mb-16"
          type="warning"
          showIcon
          title={`Contribution of ${formatMoney(policy.outstandingAmount)} outstanding`}
          description={
            status === 'PENDING_PAYMENT'
              ? 'The e-Policy is issued once the payment is verified.'
              : `Payment is due by ${formatDate(policy.paymentDueDate)}. Overdue contributions block new business for the agency.`
          }
        />
      )}
      {blocked && (
        <Alert
          className="mb-16"
          type="error"
          showIcon
          title="New business is blocked for your agency"
          description={
            <>
              Submission is not possible until overdue contributions are paid. <Link to="/portal/billing">Go to billing</Link>
            </>
          }
        />
      )}

      {draft && (
        <>
          <CompletionChecklist
            policy={policy}
            canEdit={canQuote}
            onAction={handleDraftAction}
            submit={
              can(P.portalPoliciesSubmit) && (
                <Button type="primary" disabled={blocked} loading={submit.isPending} onClick={() => submit.mutate(undefined)}>
                  Submit application
                </Button>
              )
            }
          />
          <ErrorAlert error={submit.error} className="mb-16" />
        </>
      )}

      <PolicyTabs
        policy={policy}
        activeKey={tab}
        onChange={setTab}
        uploadTypes={draft && canQuote ? [...product.requiredDocuments, ...SIGNATURE_UPLOADS] : undefined}
        claimsAction={claimable && <Button onClick={() => navigate(`/portal/claims/new?policyNo=${encodeURIComponent(policy.policyNo ?? '')}`)}>Notify claim</Button>}
      />

      <DialogFor dialog={dialog} policy={policy} onClose={() => setDialog(null)} />
    </>
  );
}

/** AP-24..36, AP-44..47, AP-62: complete, submit and service a quotation or policy. */
export default function PolicyDetailPage() {
  const { id } = useParams();
  const policy = useApiQuery<PolicyDetail>(`/portal/policies/${id}`);
  return <QueryState query={policy}>{(data) => <PolicyView policy={data} />}</QueryState>;
}
