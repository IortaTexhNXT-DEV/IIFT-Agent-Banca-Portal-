import { Card } from 'antd';
import { useSearchParams } from 'react-router';
import { AmlCases } from '../../components/admin/AmlCases';
import { Watchlist } from '../../components/admin/Watchlist';
import { PageHeader } from '../../components/PageHeader';

type Tab = 'cases' | 'watchlist';

/** BO-13..15: AML/KYC screening review and watch-list maintenance. */
export default function AmlPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get('tab') === 'watchlist' ? 'watchlist' : 'cases';
  return (
    <>
      <PageHeader
        title="AML / KYC"
        breadcrumb={[{ title: 'Home', to: '/backoffice' }, { title: 'AML / KYC' }]}
      />
      <Card
        className="content-card content-card--flush"
        activeTabKey={tab}
        tabProps={{ size: 'middle' }}
        onTabChange={(key) =>
          setSearchParams(key === 'cases' ? {} : { tab: key }, { replace: true })
        }
        tabList={[
          { key: 'cases', label: 'Screening cases' },
          { key: 'watchlist', label: 'Watch-lists' },
        ]}
      >
        {tab === 'cases' ? <AmlCases /> : <Watchlist />}
      </Card>
    </>
  );
}
