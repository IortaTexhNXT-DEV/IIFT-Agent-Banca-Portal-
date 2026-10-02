import { Button, Checkbox, Form, Input, Tag } from 'antd';
import { api } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import type { Issue } from '../../api/types';
import { formatDateTime } from '../../utils/format';
import { ActionBar } from '../ActionBar';
import { EmptyState } from '../EmptyState';
import { ErrorAlert } from '../ErrorAlert';
import '../../styles/admin.css';

type Comment = NonNullable<Issue['comments']>[number];

interface CommentValues {
  body: string;
  internal?: boolean;
}

/** Conversation on an issue; support staff can add internal notes hidden from the reporter. */
export function IssueComments({
  issue,
  canAddInternal,
}: {
  issue: Issue;
  canAddInternal: boolean;
}) {
  const [form] = Form.useForm<CommentValues>();
  const comments: Comment[] = issue.comments ?? [];
  const add = useApiMutation(
    (values: CommentValues) =>
      api.post(`/common/issues/${issue.id}/comments`, {
        body: values.body.trim(),
        internal: values.internal ?? false,
      }),
    {
      success: 'Comment added',
      invalidate: [`/common/issues`],
      onSuccess: () => form.resetFields(),
    },
  );

  return (
    <>
      {comments.length === 0 ? (
        <EmptyState label="No comments" inline />
      ) : (
        <ol className="comment-thread">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className={`comment${comment.internal ? ' comment--internal' : ''}`}
            >
              <div className="comment__meta tag-row">
                <strong>{comment.authorName}</strong>
                {comment.internal && (
                  <Tag color="orange" variant="filled" className="status-tag">
                    Internal
                  </Tag>
                )}
                <span className="muted">{formatDateTime(comment.createdAt)}</span>
              </div>
              <div className="comment__body">{comment.body}</div>
            </li>
          ))}
        </ol>
      )}
      {issue.status !== 'CLOSED' && (
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={(values) => add.mutate(values)}
          className="comment-form"
        >
          <ErrorAlert error={add.error} className="mb-16" />
          <Form.Item
            name="body"
            label="Comment"
            rules={[
              { required: true, whitespace: true, message: 'Write a comment' },
              { max: 4000 },
            ]}
          >
            <Input.TextArea rows={2} maxLength={4000} />
          </Form.Item>
          <ActionBar
            start={
              canAddInternal && (
                <Form.Item name="internal" valuePropName="checked" noStyle>
                  <Checkbox>Internal note</Checkbox>
                </Form.Item>
              )
            }
          >
            <Button type="primary" htmlType="submit" loading={add.isPending}>
              Send
            </Button>
          </ActionBar>
        </Form>
      )}
    </>
  );
}
