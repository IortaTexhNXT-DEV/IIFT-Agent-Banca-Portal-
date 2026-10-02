import { Tabs } from 'antd';
import { MasterDataSettings } from '../../components/admin/MasterDataSettings';
import { ParameterSettings } from '../../components/admin/ParameterSettings';
import { PageHeader } from '../../components/PageHeader';

/** BO-32/33, COM-09: business parameters and master data maintained without code changes. */
export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Parameters & master data"
        breadcrumb={[{ title: 'Home', to: '/backoffice' }, { title: 'Parameters & master data' }]}
      />
      <Tabs
        destroyOnHidden
        items={[
          { key: 'parameters', label: 'Parameters', children: <ParameterSettings /> },
          { key: 'codes', label: 'Master data', children: <MasterDataSettings /> },
        ]}
      />
    </>
  );
}
