import { Form, Input, Radio } from 'antd';
import { api } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import type { QuestionnaireAnswer } from '../../api/sales-types';
import type { PolicyDetail } from '../../api/types';
import { FormModal } from './FormModal';

type Values = Record<string, { answer?: boolean; details?: string }>;

/** AP-19: health and risk declarations; a "yes" needs details and may refer the case. */
export function QuestionnaireModal({ policy, onClose }: { policy: PolicyDetail; onClose(): void }) {
  const [form] = Form.useForm<Values>();
  const questions = policy.product.questionnaire;
  const answers = Form.useWatch([], form);
  const save = useApiMutation((body: { answers: QuestionnaireAnswer[] }) => api.put(`/portal/policies/${policy.id}/questionnaire`, body), {
    success: 'Declarations saved',
    invalidate: ['/portal/policies'],
    onSuccess: onClose,
  });

  const initialValues: Values = Object.fromEntries((policy.questionnaire ?? []).map((answer) => [answer.code, { answer: answer.answer, details: answer.details }]));

  const submit = (values: Values) =>
    save.mutate({
      answers: questions.map((question) => {
        const { answer = false, details } = values[question.code] ?? {};
        return { code: question.code, answer, details: answer ? details?.trim() : undefined };
      }),
    });

  return (
    <FormModal<Values> title="Declarations" okText="Save declarations" form={form} initialValues={initialValues} onSubmit={submit} onClose={onClose} pending={save.isPending} error={save.error} width={720}>
      {questions.map((question, index) => (
        <div key={question.code} className="question">
          <Form.Item name={[question.code, 'answer']} label={`${index + 1}. ${question.text}`} rules={[{ required: true, message: 'Answer yes or no' }]}>
            <Radio.Group
              options={[
                { value: false, label: 'No' },
                { value: true, label: 'Yes' },
              ]}
            />
          </Form.Item>
          {answers?.[question.code]?.answer === true && (
            <Form.Item
              name={[question.code, 'details']}
              label="Details"
              extra={question.referIfYes ? 'A "yes" answer is referred to IIFT underwriting.' : undefined}
              rules={[
                { required: true, whitespace: true, message: 'Give details for a "yes" answer' },
                { max: 500, message: 'Up to 500 characters' },
              ]}
            >
              <Input.TextArea rows={2} maxLength={500} showCount />
            </Form.Item>
          )}
        </div>
      ))}
    </FormModal>
  );
}
