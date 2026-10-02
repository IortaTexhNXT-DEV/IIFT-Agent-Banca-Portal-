import { Alert, Button, Card, Descriptions, Flex, Input, Segmented, Select, Space, Table } from 'antd';
import { useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { ParticipantLookup, ParticipantMatch } from '../../api/sales-types';
import type { Page, Participant } from '../../api/types';
import { formatDate } from '../../utils/format';
import { ErrorAlert } from '../ErrorAlert';
import { StatusTag } from '../StatusTag';
import { ID_TYPE_LABELS } from './options';
import type { ParticipantFormValues } from './ParticipantFields';
import { ParticipantRegistrationForm } from './ParticipantRegistrationForm';

type Mode = 'search' | 'lookup' | 'register';
type IdType = Participant['idType'];

interface Props {
  onSelect(participant: ParticipantMatch): void;
}

function SelectButton({ participant, onSelect }: { participant: ParticipantMatch; onSelect(participant: ParticipantMatch): void }) {
  const rejected = participant.amlStatus === 'REJECTED';
  return (
    <Button size="small" type="primary" ghost disabled={rejected} title={rejected ? 'Not accepted by Compliance' : undefined} onClick={() => onSelect(participant)}>
      Select
    </Button>
  );
}

function ParticipantSearch({ onSelect }: Props) {
  const [search, setSearch] = useState('');
  const results = useApiQuery<Page<Participant>>('/portal/participants', { search: search || undefined, pageSize: 8 });
  return (
    <>
      <Input.Search
        placeholder="Name, participant no. or mobile"
        aria-label="Search participants"
        allowClear
        enterButton="Search"
        onSearch={(value) => setSearch(value.trim())}
        className="mb-16"
      />
      <Table<Participant>
        size="small"
        rowKey="id"
        loading={results.isFetching}
        dataSource={results.data?.items ?? []}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: search ? 'No participants found. Try the ID lookup or register a new participant.' : 'No participants registered by your agency yet' }}
        columns={[
          { title: 'Participant no.', dataIndex: 'participantNo' },
          { title: 'Name', dataIndex: 'fullName' },
          { title: 'ID', dataIndex: 'idNumberMasked' },
          { title: 'Date of birth', dataIndex: 'dateOfBirth', render: formatDate },
          { title: 'AML', dataIndex: 'amlStatus', render: (status: string) => <StatusTag status={status} /> },
          { key: 'select', align: 'right', render: (_, participant) => <SelectButton participant={participant} onSelect={onSelect} /> },
        ]}
      />
    </>
  );
}

function ParticipantIdLookup({ onSelect, onRegister }: Props & { onRegister(values: ParticipantFormValues): void }) {
  const [idType, setIdType] = useState<IdType>('NRIC');
  const [idNumber, setIdNumber] = useState('');
  const lookup = useApiMutation((query: { idType: IdType; idNumber: string }) => api.get<ParticipantLookup>('/portal/participants/lookup', query));
  const result = lookup.data;
  const validNumber = /^[A-Za-z0-9-/ ]{5,30}$/.test(idNumber.trim());
  const search = () => {
    if (validNumber) lookup.mutate({ idType, idNumber: idNumber.trim() });
  };

  return (
    <>
      <Space.Compact className="lookup-bar mb-16">
        <Select<IdType>
          aria-label="ID type"
          value={idType}
          onChange={setIdType}
          options={(['NRIC', 'PASSPORT', 'BUSINESS_REG'] as const).map((value) => ({ value, label: ID_TYPE_LABELS[value] }))}
          className="lookup-bar__type"
        />
        <Input aria-label="ID number" placeholder="Exact ID number" value={idNumber} onChange={(event) => setIdNumber(event.target.value)} onPressEnter={search} />
        <Button type="primary" disabled={!validNumber} loading={lookup.isPending} onClick={search}>
          Look up
        </Button>
      </Space.Compact>
      <ErrorAlert error={lookup.error} />
      {result?.found && (
        <Card size="small">
          <Flex justify="space-between" align="center" gap={16} wrap>
            <Descriptions
              size="small"
              column={{ xs: 1, md: 4 }}
              items={[
                { key: 'name', label: 'Name', children: result.participant.fullName },
                { key: 'no', label: 'Participant no.', children: result.participant.participantNo },
                { key: 'id', label: 'ID', children: result.participant.idNumberMasked },
                { key: 'aml', label: 'AML', children: <StatusTag status={result.participant.amlStatus} /> },
              ]}
            />
            <SelectButton participant={result.participant} onSelect={onSelect} />
          </Flex>
        </Card>
      )}
      {result && !result.found && (
        <Alert
          type="info"
          showIcon
          title="No participant is registered with this ID"
          action={
            <Button size="small" onClick={() => onRegister({ type: idType === 'BUSINESS_REG' ? 'CORPORATE' : 'INDIVIDUAL', idType, idNumber: idNumber.trim() })}>
              Register new participant
            </Button>
          }
        />
      )}
    </>
  );
}

/**
 * AP-11/13: choose the participant for a quotation – reuse an existing profile (search or
 * exact ID lookup across agencies) or register a new one.
 */
export function ParticipantPicker({ onSelect }: Props) {
  const [mode, setMode] = useState<Mode>('search');
  const [registration, setRegistration] = useState<ParticipantFormValues | undefined>();

  return (
    <>
      <Segmented<Mode>
        className="mb-16"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'search', label: 'Find existing' },
          { value: 'lookup', label: 'Look up by ID' },
          { value: 'register', label: 'Register new' },
        ]}
      />
      {mode === 'search' && <ParticipantSearch onSelect={onSelect} />}
      {mode === 'lookup' && (
        <ParticipantIdLookup
          onSelect={onSelect}
          onRegister={(values) => {
            setRegistration(values);
            setMode('register');
          }}
        />
      )}
      {mode === 'register' && (
        <ParticipantRegistrationForm
          submitLabel="Register and continue"
          initialValues={registration}
          onCreated={onSelect}
          renderDuplicateAction={(match) => (
            <Button size="small" type="primary" onClick={() => onSelect(match)}>
              Use existing participant
            </Button>
          )}
        />
      )}
    </>
  );
}
