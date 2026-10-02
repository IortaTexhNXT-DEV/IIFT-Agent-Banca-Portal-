import { CheckOutlined } from '@ant-design/icons';
import { Badge, Button, Card, Flex, Switch, Table, Tooltip, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation, usePagedQuery } from '../../api/hooks';
import type { NotificationItem } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { basePathFor, notificationPath } from '../../components/admin/links';
import { PageHeader } from '../../components/PageHeader';
import { formatDateTime, humanise } from '../../utils/format';

const INVALIDATE = ['/common/notifications'];

/** AP-54: in-app notifications with read tracking; each one links to the record it is about. */
export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const audience = user?.audience ?? 'PORTAL';
  const [unreadOnly, setUnreadOnly] = useState(false);
  const notifications = usePagedQuery<NotificationItem>('/common/notifications', { unreadOnly: unreadOnly || undefined });
  const markRead = useApiMutation((id: string) => api.post(`/common/notifications/${id}/read`), { invalidate: INVALIDATE });
  const markAllRead = useApiMutation(() => api.post('/common/notifications/read-all'), { success: 'All notifications marked as read', invalidate: INVALIDATE });

  const open = (item: NotificationItem) => {
    if (!item.readAt) markRead.mutate(item.id);
    if (item.link) navigate(notificationPath(audience, item.link));
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        breadcrumb={[{ title: 'Dashboard', to: basePathFor(audience) }, { title: 'Notifications' }]}
        extra={
          <Button icon={<CheckOutlined />} loading={markAllRead.isPending} onClick={() => markAllRead.mutate(undefined)}>
            Mark all as read
          </Button>
        }
      />
      <Card
        className="content-card"
        title="Inbox"
        extra={
          <Flex gap={8} align="center">
            <Switch
              id="unread-only"
              size="small"
              checked={unreadOnly}
              onChange={(checked) => {
                setUnreadOnly(checked);
                notifications.resetPage();
              }}
            />
            <label htmlFor="unread-only">Unread only</label>
          </Flex>
        }
      >
        <Table<NotificationItem>
          size="middle"
          rowKey="id"
          showHeader={false}
          loading={notifications.isFetching}
          dataSource={notifications.items}
          pagination={notifications.pagination}
          locale={{ emptyText: unreadOnly ? 'No unread notifications' : 'No notifications yet' }}
          columns={[
            { key: 'unread', width: 28, render: (_: unknown, item) => (item.readAt ? null : <Badge status="processing" aria-label="Unread" />) },
            {
              key: 'message',
              render: (_: unknown, item) => (
                <div>
                  {item.link ? (
                    <Typography.Link strong={!item.readAt} onClick={() => open(item)}>
                      {item.subject}
                    </Typography.Link>
                  ) : (
                    <Typography.Text strong={!item.readAt}>{item.subject}</Typography.Text>
                  )}
                  <div className="muted">{item.body}</div>
                </div>
              ),
            },
            { key: 'type', dataIndex: 'eventType', width: 200, render: (type: string) => <span className="muted">{humanise(type)}</span> },
            { key: 'received', dataIndex: 'createdAt', width: 170, render: formatDateTime },
            {
              key: 'actions',
              width: 56,
              render: (_: unknown, item) =>
                !item.readAt && (
                  <Tooltip title="Mark as read">
                    <Button type="text" icon={<CheckOutlined />} aria-label={`Mark "${item.subject}" as read`} onClick={() => markRead.mutate(item.id)} />
                  </Tooltip>
                ),
            },
          ]}
        />
      </Card>
    </>
  );
}
