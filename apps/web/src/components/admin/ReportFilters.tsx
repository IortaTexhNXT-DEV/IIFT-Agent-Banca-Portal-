import { Col, DatePicker, Form, type FormInstance, Row, Select } from 'antd';
import type { Dayjs } from 'dayjs';
import { useApiQuery } from '../../api/hooks';
import type { AgentView, Page, Product, ReportDefinition } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { humanise } from '../../utils/format';
import { P } from '../../utils/permissions';
import { AgencySelect } from './AgencySelect';
import { enumOptions } from './useCodes';

export interface ReportFilterValues {
  period?: [Dayjs | null, Dayjs | null] | null;
  productId?: string;
  agencyId?: string;
  agentId?: string;
  status?: string;
}

export type ReportQuery = Record<string, string | undefined>;

/** Converts the filter form into the query parameters every report endpoint accepts. */
export function toReportQuery(values: ReportFilterValues): ReportQuery {
  return {
    from: values.period?.[0]?.format('YYYY-MM-DD'),
    to: values.period?.[1]?.format('YYYY-MM-DD'),
    productId: values.productId,
    agencyId: values.agencyId,
    agentId: values.agentId,
    status: values.status,
  };
}

function AgentFilter({ agencyId }: { agencyId?: string }) {
  const { user, can } = useAuth();
  const backoffice = user?.audience === 'BACKOFFICE';
  const path = backoffice
    ? '/backoffice/agents'
    : can(P.portalHierarchyView)
      ? '/portal/agents'
      : null;
  const agents = useApiQuery<Page<AgentView>>(path, {
    agencyId: backoffice ? agencyId : undefined,
    pageSize: 100,
  });
  return (
    <Form.Item name="agentId" label="Agent / bank officer">
      <Select
        allowClear
        placeholder="All agents"
        showSearch={{ optionFilterProp: 'label' }}
        loading={agents.isLoading}
        options={(agents.data?.items ?? []).map((agent) => ({
          value: agent.id,
          label: `${agent.fullName} (${agent.agentCode})`,
        }))}
      />
    </Form.Item>
  );
}

/** BO-23: filters offered by the selected report (period, product, agency, agent, status). */
export function ReportFilters({
  report,
  form,
}: {
  report: ReportDefinition;
  form: FormInstance<ReportFilterValues>;
}) {
  const { user } = useAuth();
  const backoffice = user?.audience === 'BACKOFFICE';
  const has = (filter: ReportDefinition['filters'][number]) => report.filters.includes(filter);
  const products = useApiQuery<Product[]>(has('product') ? '/common/products' : null);
  const agencyId = Form.useWatch('agencyId', form);

  return (
    <Form form={form} layout="vertical" requiredMark={false}>
      <Row gutter={16}>
        {has('dateRange') && (
          <Col xs={24} md={12} xl={8}>
            <Form.Item name="period" label={report.dateLabel ?? 'Period'}>
              <DatePicker.RangePicker
                format="DD MMM YYYY"
                allowEmpty={[true, true]}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
        )}
        {has('product') && (
          <Col xs={24} md={12} xl={8}>
            <Form.Item name="productId" label="Product">
              <Select
                allowClear
                placeholder="All products"
                loading={products.isLoading}
                options={(products.data ?? []).map((product) => ({
                  value: product.id,
                  label: product.name,
                }))}
              />
            </Form.Item>
          </Col>
        )}
        {backoffice && has('agency') && (
          <Col xs={24} md={12} xl={8}>
            <Form.Item name="agencyId" label="Agency / bank">
              <AgencySelect
                allowClear
                placeholder="All agencies and banks"
                onChange={() => form.setFieldValue('agentId', undefined)}
              />
            </Form.Item>
          </Col>
        )}
        {has('agent') && (
          <Col xs={24} md={12} xl={8}>
            <AgentFilter agencyId={agencyId} />
          </Col>
        )}
        {has('status') && report.statusOptions && (
          <Col xs={24} md={12} xl={8}>
            <Form.Item name="status" label="Status">
              <Select
                allowClear
                placeholder="All statuses"
                options={enumOptions(report.statusOptions, humanise)}
              />
            </Form.Item>
          </Col>
        )}
      </Row>
    </Form>
  );
}
