import { BellOutlined } from '@ant-design/icons';
import { Badge, Button, Popover, Spin } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../api/client';
import { useApiMutation, useApiQuery } from '../api/hooks';
import type { NotificationItem, Page } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { notificationPath } from '../components/admin/links';
import { EmptyState } from '../components/EmptyState';
import { formatDateTime } from '../utils/format';

const UNREAD_REFRESH_MS = 60_000;
const INVALIDATE = ['/common/notifications'];

function NoticeList({ basePath, onDone }: { basePath: string; onDone(): void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const latest = useApiQuery<Page<NotificationItem>>('/common/notifications', { pageSize: 6 });
  const markRead = useApiMutation((id: string) => api.post(`/common/notifications/${id}/read`), {
    invalidate: INVALIDATE,
  });
  const markAllRead = useApiMutation(() => api.post('/common/notifications/read-all'), {
    invalidate: INVALIDATE,
  });

  const open = (item: NotificationItem) => {
    if (!item.readAt) markRead.mutate(item.id);
    onDone();
    navigate(
      item.link
        ? notificationPath(user?.audience ?? 'PORTAL', item.link)
        : `${basePath}/notifications`,
    );
  };

  const items = latest.data?.items ?? [];
  return (
    <div className="notice-panel">
      <div className="notice-panel__head">
        Notifications
        <Button
          type="link"
          size="small"
          disabled={!items.some((item) => !item.readAt)}
          loading={markAllRead.isPending}
          onClick={() => markAllRead.mutate(undefined)}
        >
          Mark all as read
        </Button>
      </div>
      {latest.isLoading ? (
        <Spin size="small" className="page-loading" />
      ) : items.length === 0 ? (
        <EmptyState label="No notifications yet" inline />
      ) : (
        <ul className="notice-panel__list">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                aria-label={item.subject}
                className={`notice-item${item.readAt ? '' : ' notice-item--unread'}`}
                onClick={() => open(item)}
              >
                <span className="notice-item__dot" aria-hidden="true" />
                <span className="notice-item__body">
                  <span className="notice-item__subject">{item.subject}</span>
                  <span className="notice-item__time">{formatDateTime(item.createdAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="notice-panel__foot">
        <Link to={`${basePath}/notifications`} onClick={onDone}>
          View all
        </Link>
      </div>
    </div>
  );
}

/** Bell with the unread count; opens the latest notifications. */
export function NotificationBell({ basePath }: { basePath: string }) {
  const [open, setOpen] = useState(false);
  const unread = useApiQuery<{ count: number }>('/common/notifications/unread-count', undefined, {
    refetchInterval: UNREAD_REFRESH_MS,
  });
  return (
    <Badge count={unread.data?.count ?? 0} size="small" overflowCount={99} offset={[-4, 4]}>
      <Popover
        open={open}
        onOpenChange={setOpen}
        trigger="click"
        placement="bottomRight"
        arrow={false}
        destroyOnHidden
        content={<NoticeList basePath={basePath} onDone={() => setOpen(false)} />}
      >
        <Button type="text" shape="circle" icon={<BellOutlined />} aria-label="Notifications" />
      </Popover>
    </Badge>
  );
}
