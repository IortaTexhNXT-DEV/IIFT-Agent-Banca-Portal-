import { App, Button, Card, Flex } from 'antd';
import { useNavigate } from 'react-router';
import type { Participant } from '../../api/types';
import { PageHeader } from '../../components/PageHeader';
import { ParticipantRegistrationForm } from '../../components/sales/ParticipantRegistrationForm';
import '../../styles/sales.css';

/** AP-13/16: register an individual or corporate participant; AML screening runs on save. */
export default function ParticipantFormPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();

  const created = (participant: Participant) => {
    if (participant.amlStatus === 'FLAGGED') {
      message.warning(
        `${participant.participantNo} registered and referred to Compliance for AML review`,
      );
    } else {
      message.success(`${participant.participantNo} registered`);
    }
    navigate(`/portal/participants/${participant.id}`);
  };

  return (
    <>
      <PageHeader
        title="Register participant"
        subtitle="Each participant has one profile shared across agencies, identified by IC, passport or business registration number"
        breadcrumb={[
          { title: 'Home', to: '/portal' },
          { title: 'Participants', to: '/portal/participants' },
          { title: 'Register' },
        ]}
      />
      <Card className="content-card">
        <ParticipantRegistrationForm
          submitLabel="Register participant"
          onCreated={created}
          onCancel={() => navigate('/portal/participants')}
          renderDuplicateAction={(match) => (
            <Flex gap={8} wrap>
              <Button size="small" onClick={() => navigate(`/portal/participants/${match.id}`)}>
                Open record
              </Button>
              <Button
                size="small"
                type="primary"
                onClick={() =>
                  navigate('/portal/quotations/new', { state: { participant: match } })
                }
              >
                New quotation
              </Button>
            </Flex>
          )}
        />
      </Card>
    </>
  );
}
