import { EditOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Input, InputNumber, Switch, Table, Typography } from 'antd';
import { useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { ConfigParameter } from '../../api/admin-types';
import { formatDateTime } from '../../utils/format';
import { ErrorAlert } from '../ErrorAlert';
import { QueryState } from '../QueryState';
import '../../styles/admin.css';

const PATH = '/backoffice/config/parameters';

function rangeHint(parameter: ConfigParameter): string {
  const { minValue: min, maxValue: max } = parameter;
  if (min !== null && max !== null) return `${Number(min)} to ${Number(max)}`;
  if (min !== null) return `At least ${Number(min)}`;
  if (max !== null) return `At most ${Number(max)}`;
  return '–';
}

function displayValue(parameter: ConfigParameter): string {
  if (parameter.valueType === 'BOOLEAN') return parameter.value === 'true' ? 'Yes' : 'No';
  return parameter.value;
}

/** COM-09: edits one parameter with an input suited to its type and range. */
function ParameterValue({ parameter }: { parameter: ConfigParameter }) {
  const [draft, setDraft] = useState<string>();
  const save = useApiMutation(
    (value: string) =>
      api.put<ConfigParameter>(`${PATH}/${encodeURIComponent(parameter.key)}`, { value }),
    {
      success: 'Parameter saved',
      invalidate: [PATH],
      onSuccess: () => setDraft(undefined),
    },
  );

  if (parameter.valueType === 'BOOLEAN') {
    return (
      <>
        <Switch
          checked={parameter.value === 'true'}
          loading={save.isPending}
          aria-label={parameter.description}
          onChange={(checked) => save.mutate(String(checked))}
        />
        <ErrorAlert error={save.error} className="parameter-error" />
      </>
    );
  }
  if (draft === undefined) {
    return (
      <Flex gap={8} align="center">
        <span>{displayValue(parameter)}</span>
        <Button
          size="small"
          type="text"
          icon={<EditOutlined />}
          aria-label={`Edit ${parameter.key}`}
          onClick={() => setDraft(parameter.value)}
        />
      </Flex>
    );
  }

  const numeric = parameter.valueType !== 'STRING';
  return (
    <>
      <Flex gap={8} align="center">
        {numeric ? (
          <InputNumber
            aria-label={parameter.description}
            value={draft === '' ? null : Number(draft)}
            min={parameter.minValue === null ? undefined : Number(parameter.minValue)}
            max={parameter.maxValue === null ? undefined : Number(parameter.maxValue)}
            precision={parameter.valueType === 'INTEGER' ? 0 : undefined}
            onChange={(value) => setDraft(value === null ? '' : String(value))}
          />
        ) : (
          <Input
            aria-label={parameter.description}
            value={draft}
            maxLength={1000}
            onChange={(event) => setDraft(event.target.value)}
            style={{ width: 280 }}
          />
        )}
        <Button
          size="small"
          type="primary"
          loading={save.isPending}
          disabled={draft.trim() === ''}
          onClick={() => save.mutate(draft.trim())}
        >
          Save
        </Button>
        <Button size="small" onClick={() => setDraft(undefined)}>
          Cancel
        </Button>
      </Flex>
      <ErrorAlert error={save.error} className="parameter-error" />
    </>
  );
}

/** BO-32/33, COM-09: system parameters grouped by business area. */
export function ParameterSettings() {
  const parameters = useApiQuery<ConfigParameter[]>(PATH);
  return (
    <QueryState query={parameters}>
      {(items) =>
        [...new Set(items.map((item) => item.category))].map((category) => (
          <Card key={category} title={category} className="content-card">
            <Table<ConfigParameter>
              size="small"
              rowKey="key"
              pagination={false}
              dataSource={items.filter((item) => item.category === category)}
              scroll={{ x: 'max-content' }}
              columns={[
                {
                  title: 'Parameter',
                  dataIndex: 'description',
                  width: 460,
                  render: (description: string, parameter) => (
                    <>
                      <div>{description}</div>
                      <Typography.Text type="secondary" className="parameter-key">
                        {parameter.key}
                      </Typography.Text>
                    </>
                  ),
                },
                {
                  title: 'Value',
                  key: 'value',
                  width: 320,
                  render: (_: unknown, parameter) => <ParameterValue parameter={parameter} />,
                },
                {
                  title: 'Allowed range',
                  key: 'range',
                  render: (_: unknown, parameter) => rangeHint(parameter),
                },
                { title: 'Last changed', dataIndex: 'updatedAt', render: formatDateTime },
              ]}
            />
          </Card>
        ))
      }
    </QueryState>
  );
}
