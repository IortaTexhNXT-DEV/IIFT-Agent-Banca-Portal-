import { Tabs } from 'antd';
import { AmlCases } from '../../components/admin/AmlCases';
import { Watchlist } from '../../components/admin/Watchlist';
import { PageHeader } from '../../components/PageHeader';

/** BO-13..15: AML/KYC screening review and watch-list maintenance. */
export default function AmlPage() {
  return (
    <>
      <PageHeader
        title="AML / KYC"
        breadcrumb={[{ title: 'Home', to: '/backoffice' }, { title: 'AML / KYC' }]}
      />
      <Tabs
        destroyOnHidden
        items={[
          { key: 'cases', label: 'Screening cases', children: <AmlCases /> },
          { key: 'watchlist', label: 'Watch-lists', children: <Watchlist /> },
        ]}
      />
    </>
  );
}
