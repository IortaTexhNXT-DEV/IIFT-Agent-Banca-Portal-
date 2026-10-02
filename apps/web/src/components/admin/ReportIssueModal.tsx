import { Alert, Button, Form, Input, Modal, Select } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import type { Issue, IssuePriority } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { humanise } from '../../utils/format';
import { DocumentPanel } from '../DocumentPanel';
import { ErrorAlert } from '../ErrorAlert';
import { FormSection } from '../FormSection';
import { ISSUE_PRIORITIES, issueUploadTypes } from './issues';
import { basePathFor } from './links';
import { enumOptions, useCodes } from './useCodes';

interface IssueValues {
  title: string;
  category: string;
  priority: IssuePriority;
  description: string;
}

const PRIORITY_HELP =
  'Critical: business stopped. High: key function unavailable. Medium: workaround exists. Low: question or minor fault.';

/** AP-55..57: report an issue, then attach screenshots or documents to it. */
export function ReportIssueModal({ onClose }: { onClose(): void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm<IssueValues>();
  const [created, setCreated] = useState<Issue>();
  const categories = useCodes('ISSUE_CATEGORY');
  const documentTypes = useCodes('DOCUMENT_TYPE');
  const report = useApiMutation(
    (values: IssueValues) => api.post<Issue>('/common/issues', values),
    {
      invalidate: ['/common/issues'],
      onSuccess: setCreated,
    },
  );

  if (created) {
    const detailPath = `${basePathFor(user?.audience ?? 'PORTAL')}/issues/${created.id}`;
    return (
      <Modal
        open
        title={`Issue ${created.issueNo} reported`}
        onCancel={onClose}
        footer={
          <>
            <Button onClick={onClose}>Close</Button>
            <Button type="primary" onClick={() => navigate(detailPath)}>
              View issue
            </Button>
          </>
        }
        destroyOnHidden
        width={720}
      >
        <Alert
          className="mb-16"
          type="success"
          showIcon
          title={`Reference ${created.issueNo} – ${humanise(created.priority).toLowerCase()} priority response target applies`}
        />
        <DocumentPanel
          ownerType="ISSUE"
          ownerId={created.id}
          canUpload
          uploadTypes={issueUploadTypes(documentTypes.labelOf)}
          title="Attachments"
        />
      </Modal>
    );
  }

  return (
    <Modal
      open
      title="Report an issue"
      okText="Submit"
      okButtonProps={{ loading: report.isPending }}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
      width={640}
    >
      <ErrorAlert error={report.error} className="mb-16" />
      <Form
        form={form}
        onFinish={(values) =>
          report.mutate({
            ...values,
            title: values.title.trim(),
            description: values.description.trim(),
          })
        }
        layout="vertical"
        requiredMark="optional"
        initialValues={{ priority: 'MEDIUM' }}
      >
        <FormSection title="Issue" columns={2}>
          <Form.Item
            name="title"
            label="Title"
            className="field--full"
            rules={[
              { required: true, whitespace: true, message: 'Enter a short title' },
              { min: 5, max: 200, message: '5 to 200 characters' },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="category"
            label="Category"
            rules={[{ required: true, message: 'Choose a category' }]}
          >
            <Select options={categories.options} loading={categories.loading} />
          </Form.Item>
          <Form.Item
            name="priority"
            label="Priority"
            tooltip={PRIORITY_HELP}
            rules={[{ required: true }]}
          >
            <Select options={enumOptions(ISSUE_PRIORITIES, humanise)} />
          </Form.Item>
          <Form.Item
            name="description"
            label="Description"
            className="field--full"
            tooltip="What happened, what you expected, and any reference numbers"
            rules={[
              { required: true, whitespace: true, message: 'Describe the issue' },
              { min: 10, max: 4000, message: '10 to 4,000 characters' },
            ]}
          >
            <Input.TextArea rows={4} showCount maxLength={4000} />
          </Form.Item>
        </FormSection>
      </Form>
    </Modal>
  );
}
