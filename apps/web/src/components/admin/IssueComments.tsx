import { Button, Checkbox, Empty, Flex, Form, Input, Tag } from 'antd';
import { api } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import type { Issue } from '../../api/types';
import { formatDateTime } from '../../utils/format';
import { ErrorAlert } from '../ErrorAlert';
import '../../styles/admin.css';

type Comment = NonNullable<Issue['comments']>[number];

interface CommentValues {
  body: string;
  internal?: boolean;
}

/** Conversation on an issue; support staff can add internal notes hidden from the reporter. */
export function IssueComments({ issue, canAddInternal }: { issue: Issue; canAddInternal: boolean }) {
  const [form] = Form.useForm<CommentValues>();
  const comments: Comment[] = issue.comments ?? [];
  const add = useApiMutation((values: CommentValues) => api.post(`/common/issues/${issue.id}/comments`, { body: values.body.trim(), internal: values.internal ?? false }), {
    success: 'Comment added',
    invalidate: [`/common/issues`],
    onSuccess: () => form.resetFields(),
  });

  return (
    <>
      {comments.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No comments yet" />
      ) : (
        <ol className="comment-thread">
          {comments.map((comment) => (
            <li key={comment.id} className={`comment${comment.internal ? ' comment--internal' : ''}`}>
              <Flex justify="space-between" gap={8} wrap className="comment__meta">
                <span>
                  <strong>{comment.authorName}</strong>
                  {comment.internal && (
                    <Tag color="orange" variant="filled" className="comment__tag">
                      Internal note
                    </Tag>
                  )}
                </span>
                <span className="muted">{formatDateTime(comment.createdAt)}</span>
              </Flex>
              <div className="comment__body">{comment.body}</div>
            </li>
          ))}
        </ol>
      )}
      {issue.status !== 'CLOSED' && (
        <Form form={form} layout="vertical" requiredMark={false} onFinish={(values) => add.mutate(values)} className="comment-form">
          <ErrorAlert error={add.error} className="mb-16" />
          <Form.Item name="body" label="Add a comment" rules={[{ required: true, whitespace: true, message: 'Write a comment' }, { max: 4000 }]}>
            <Input.TextArea rows={3} maxLength={4000} />
          </Form.Item>
          <Flex justify="space-between" align="center">
            {canAddInternal ? (
              <Form.Item name="internal" valuePropName="checked" noStyle>
                <Checkbox>Internal note (not visible to the reporter)</Checkbox>
              </Form.Item>
            ) : (
              <span />
            )}
            <Button type="primary" htmlType="submit" loading={add.isPending}>
              Send
            </Button>
          </Flex>
        </Form>
      )}
    </>
  );
}
