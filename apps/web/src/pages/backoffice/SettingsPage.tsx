import { Tabs } from 'antd';
import { useSearchParams } from 'react-router';
import { MasterDataSettings } from '../../components/admin/MasterDataSettings';
import { ParameterSettings } from '../../components/admin/ParameterSettings';
import { PageHeader } from '../../components/PageHeader';

type Tab = 'parameters' | 'codes';

/** BO-32/33, COM-09: business parameters and master data maintained without code changes. */
export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get('tab') === 'codes' ? 'codes' : 'parameters';
  return (
    <>
      <PageHeader
        title="Parameters & master data"
        breadcrumb={[{ title: 'Home', to: '/backoffice' }, { title: 'Parameters & master data' }]}
      />
      <Tabs
        className="page-tabs"
        activeKey={tab}
        destroyOnHidden
        onChange={(key) =>
          setSearchParams(key === 'parameters' ? {} : { tab: key }, { replace: true })
        }
        items={[
          { key: 'parameters', label: 'Parameters', children: <ParameterSettings /> },
          { key: 'codes', label: 'Master data', children: <MasterDataSettings /> },
        ]}
      />
    </>
  );
}
