import { Button } from 'antd';
import { useState } from 'react';
import { useParams } from 'react-router';
import { useApiQuery } from '../../api/hooks';
import type { PolicyDetail } from '../../api/types';
import { QueryState } from '../../components/QueryState';
import { EmailDocumentsModal, hasIssuedDocuments } from '../../components/sales/EmailDocumentsModal';
import { PolicyPageHeader } from '../../components/sales/PolicyPageHeader';
import { type PolicyTabKey, PolicyTabs } from '../../components/sales/PolicyTabs';

function PolicyView({ policy }: { policy: PolicyDetail }) {
  const [tab, setTab] = useState<PolicyTabKey>('overview');
  const [emailing, setEmailing] = useState(false);

  return (
    <>
      <PolicyPageHeader policy={policy} actions={hasIssuedDocuments(policy) && <Button onClick={() => setEmailing(true)}>E-mail documents</Button>} />
      <PolicyTabs policy={policy} activeKey={tab} onChange={setTab} />
      {emailing && <EmailDocumentsModal policy={policy} onClose={() => setEmailing(false)} />}
    </>
  );
}

/** BO: read-only view of a quotation or policy with its documents, payments, history and approvals (AP-45). */
export default function PolicyDetailPage() {
  const { id } = useParams();
  const policy = useApiQuery<PolicyDetail>(`/backoffice/policies/${id}`);
  return <QueryState query={policy}>{(data) => <PolicyView policy={data} />}</QueryState>;
}
