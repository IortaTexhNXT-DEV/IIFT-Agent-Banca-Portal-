import { CheckOutlined } from '@ant-design/icons';
import { Badge, Button, Segmented, Tooltip } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation, usePagedQuery } from '../../api/hooks';
import type { NotificationItem } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { basePathFor, notificationPath } from '../../components/admin/links';
import { DataTable, dateTimeColumn } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { TableCard } from '../../components/TableCard';
import { humanise } from '../../utils/format';
import '../../styles/admin.css';

const INVALIDATE = ['/common/notifications'];

/** AP-54: in-app notifications with read tracking; each one links to the record it is about. */
export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const audience = user?.audience ?? 'PORTAL';
  const [unreadOnly, setUnreadOnly] = useState(false);
  const notifications = usePagedQuery<NotificationItem>('/common/notifications', {
    unreadOnly: unreadOnly || undefined,
  });
  const markRead = useApiMutation((id: string) => api.post(`/common/notifications/${id}/read`), {
    invalidate: INVALIDATE,
  });
  const markAllRead = useApiMutation(() => api.post('/common/notifications/read-all'), {
    success: 'All notifications marked as read',
    invalidate: INVALIDATE,
  });

  const open = (item: NotificationItem) => {
    if (!item.readAt) markRead.mutate(item.id);
    if (item.link) navigate(notificationPath(audience, item.link));
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        breadcrumb={[{ title: 'Home', to: basePathFor(audience) }, { title: 'Notifications' }]}
        extra={
          <Button
            icon={<CheckOutlined />}
            loading={markAllRead.isPending}
            onClick={() => markAllRead.mutate(undefined)}
          >
            Mark all as read
          </Button>
        }
      />
      <TableCard
        toolbar={
          <Segmented<'all' | 'unread'>
            value={unreadOnly ? 'unread' : 'all'}
            options={[
              { value: 'all', label: 'All' },
              { value: 'unread', label: 'Unread' },
            ]}
            onChange={(value) => {
              setUnreadOnly(value === 'unread');
              notifications.resetPage();
            }}
          />
        }
      >
        <DataTable<NotificationItem>
          rowKey="id"
          tableLayout="fixed"
          showHeader={false}
          loading={notifications.isFetching}
          dataSource={notifications.items}
          pagination={notifications.pagination}
          locale={{ emptyText: unreadOnly ? 'No unread notifications' : 'No notifications' }}
          onRowClick={open}
          rowClassName={(item) =>
            item.readAt ? 'clickable-row' : 'clickable-row notification-row--unread'
          }
          columns={[
            {
              key: 'unread',
              width: 36,
              render: (_: unknown, item) =>
                item.readAt ? null : <Badge status="processing" aria-label="Unread" />,
            },
            {
              key: 'message',
              render: (_: unknown, item) => (
                <>
                  <span
                    className={`notification__subject${item.readAt ? '' : ' notification__subject--unread'}`}
                  >
                    {item.subject}
                  </span>
                  <span className="notification__body" title={item.body}>
                    {item.body}
                  </span>
                </>
              ),
            },
            {
              key: 'type',
              dataIndex: 'eventType',
              width: 180,
              render: (type: string) => <span className="muted">{humanise(type)}</span>,
            },
            dateTimeColumn('Received', 'createdAt', 160),
            {
              key: 'actions',
              width: 56,
              align: 'right',
              render: (_: unknown, item) =>
                !item.readAt && (
                  <Tooltip title="Mark as read">
                    <Button
                      type="text"
                      size="small"
                      icon={<CheckOutlined />}
                      aria-label={`Mark "${item.subject}" as read`}
                      onClick={() => markRead.mutate(item.id)}
                    />
                  </Tooltip>
                ),
            },
          ]}
        />
      </TableCard>
    </>
  );
}
