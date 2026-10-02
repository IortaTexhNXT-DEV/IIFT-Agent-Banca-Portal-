import { Col, Form, Input, Modal, Row, Select } from 'antd';
import { api } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import type { AgencyInput } from '../../api/admin-types';
import type { Agency } from '../../api/types';
import { humanise } from '../../utils/format';
import { ErrorAlert } from '../ErrorAlert';
import { mobileRule, optional } from './AgentFormFields';
import { CHANNEL_LABELS } from './agents';
import { enumOptions } from './useCodes';

const AGENCY_STATUSES: Agency['status'][] = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
const CODE_PATTERN = /^[A-Z0-9-]{2,20}$/;

interface Props {
  /** Agency to edit; omit to create a new agency or bank. */
  agency?: Agency;
  onClose(): void;
  onSaved?(agency: Agency): void;
}

/** BO-09: create or maintain an agency (agency channel) or partner bank (banca channel). */
export function AgencyFormModal({ agency, onClose, onSaved }: Props) {
  const [form] = Form.useForm<AgencyInput>();
  const editing = Boolean(agency);
  const save = useApiMutation(
    (values: AgencyInput) => {
      const body = { ...values, registrationNo: optional(values.registrationNo), email: optional(values.email), phone: optional(values.phone), address: optional(values.address) };
      return agency ? api.put<Agency>(`/backoffice/agencies/${agency.id}`, body) : api.post<Agency>('/backoffice/agencies', { ...body, code: values.code?.trim().toUpperCase() });
    },
    {
      success: editing ? 'Agency details saved' : 'Agency created',
      invalidate: ['/backoffice/agencies', '/backoffice/dashboard'],
      onSuccess: (saved) => {
        onSaved?.(saved);
        onClose();
      },
    },
  );

  return (
    <Modal
      open
      title={editing ? `Edit ${agency?.name}` : 'Add agency or bank'}
      okText={editing ? 'Save' : 'Create'}
      okButtonProps={{ loading: save.isPending }}
      onCancel={onClose}
      onOk={() => form.validateFields().then((values) => save.mutate(values))}
      destroyOnHidden
      width={680}
    >
      <ErrorAlert error={save.error} className="mb-16" />
      <Form
        form={form}
        layout="vertical"
        requiredMark="optional"
        initialValues={
          agency
            ? { name: agency.name, registrationNo: agency.registrationNo ?? '', email: agency.email ?? '', phone: agency.phone ?? '', address: agency.address ?? '', status: agency.status }
            : { channel: 'AGENCY' }
        }
      >
        <Row gutter={16}>
          {!editing && (
            <>
              <Col xs={24} md={12}>
                <Form.Item name="code" label="Code" extra="Capital letters, digits and hyphens, e.g. AGY-KB" rules={[{ required: true, message: 'Enter a code' }, { pattern: CODE_PATTERN, message: '2 to 20 capital letters, digits or hyphens' }]} normalize={(value: string) => value.toUpperCase()}>
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="channel" label="Channel" rules={[{ required: true }]}>
                  <Select options={Object.entries(CHANNEL_LABELS).map(([value, label]) => ({ value, label }))} />
                </Form.Item>
              </Col>
            </>
          )}
          <Col xs={24} md={editing ? 16 : 24}>
            <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true, message: 'Enter the name' }, { min: 2, max: 150 }]}>
              <Input />
            </Form.Item>
          </Col>
          {editing && (
            <Col xs={24} md={8}>
              <Form.Item name="status" label="Status" rules={[{ required: true }]}>
                <Select options={enumOptions(AGENCY_STATUSES, humanise)} />
              </Form.Item>
            </Col>
          )}
          <Col xs={24} md={12}>
            <Form.Item name="registrationNo" label="Registration no." rules={[{ max: 50 }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="phone" label="Phone" rules={[mobileRule]}>
              <Input inputMode="tel" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Enter a valid email address' }]}>
              <Input type="email" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="address" label="Address" rules={[{ max: 300 }]}>
              <Input />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
