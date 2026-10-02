import { CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons';
import { Button, Input, InputNumber, Switch, Tooltip } from 'antd';
import { useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { ConfigParameter } from '../../api/admin-types';
import { DataTable, dateTimeColumn } from '../DataTable';
import { ErrorAlert } from '../ErrorAlert';
import { QueryState } from '../QueryState';
import { TableCard } from '../TableCard';
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

/** COM-09: edits one parameter in place with an input suited to its type and range. */
function ParameterValue({
  parameter,
  onError,
}: {
  parameter: ConfigParameter;
  onError(error: unknown): void;
}) {
  const [draft, setDraft] = useState<string>();
  const save = useApiMutation(
    (value: string) =>
      api.put<ConfigParameter>(`${PATH}/${encodeURIComponent(parameter.key)}`, { value }),
    {
      success: 'Parameter saved',
      invalidate: [PATH],
      onSuccess: () => {
        setDraft(undefined);
        onError(undefined);
      },
      onError,
    },
  );

  if (parameter.valueType === 'BOOLEAN') {
    return (
      <span className="parameter-value">
        <Switch
          size="small"
          checked={parameter.value === 'true'}
          loading={save.isPending}
          aria-label={parameter.description}
          onChange={(checked) => save.mutate(String(checked))}
        />
      </span>
    );
  }
  if (draft === undefined) {
    return (
      <span className="parameter-value">
        <span>{displayValue(parameter)}</span>
        <Tooltip title="Edit">
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            aria-label={`Edit ${parameter.key}`}
            onClick={() => setDraft(parameter.value)}
          />
        </Tooltip>
      </span>
    );
  }

  const numeric = parameter.valueType !== 'STRING';
  return (
    <span className="parameter-value">
      {numeric ? (
        <InputNumber
          size="small"
          aria-label={parameter.description}
          value={draft === '' ? null : Number(draft)}
          min={parameter.minValue === null ? undefined : Number(parameter.minValue)}
          max={parameter.maxValue === null ? undefined : Number(parameter.maxValue)}
          precision={parameter.valueType === 'INTEGER' ? 0 : undefined}
          onChange={(value) => setDraft(value === null ? '' : String(value))}
          onPressEnter={() => draft.trim() !== '' && save.mutate(draft.trim())}
        />
      ) : (
        <Input
          size="small"
          aria-label={parameter.description}
          value={draft}
          maxLength={1000}
          onChange={(event) => setDraft(event.target.value)}
          onPressEnter={() => draft.trim() !== '' && save.mutate(draft.trim())}
        />
      )}
      <Tooltip title="Save">
        <Button
          size="small"
          type="primary"
          icon={<CheckOutlined />}
          aria-label={`Save ${parameter.key}`}
          loading={save.isPending}
          disabled={draft.trim() === ''}
          onClick={() => save.mutate(draft.trim())}
        />
      </Tooltip>
      <Tooltip title="Cancel">
        <Button
          size="small"
          icon={<CloseOutlined />}
          aria-label="Cancel"
          onClick={() => setDraft(undefined)}
        />
      </Tooltip>
    </span>
  );
}

/** BO-32/33, COM-09: system parameters grouped by business area. */
export function ParameterSettings() {
  const parameters = useApiQuery<ConfigParameter[]>(PATH);
  const [error, setError] = useState<unknown>();
  return (
    <>
      <ErrorAlert error={error} className="mb-16" />
      <QueryState query={parameters}>
        {(items) =>
          [...new Set(items.map((item) => item.category))].map((category) => (
            <TableCard key={category} title={category}>
              <DataTable<ConfigParameter>
                size="small"
                rowKey="key"
                pagination={false}
                scroll={{}}
                dataSource={items.filter((item) => item.category === category)}
                columns={[
                  {
                    title: 'Parameter',
                    dataIndex: 'description',
                    render: (description: string, parameter) => (
                      <>
                        {description}
                        <span className="parameter-key">{parameter.key}</span>
                      </>
                    ),
                  },
                  {
                    title: 'Value',
                    key: 'value',
                    width: 300,
                    render: (_: unknown, parameter) => (
                      <ParameterValue parameter={parameter} onError={setError} />
                    ),
                  },
                  {
                    title: 'Allowed range',
                    key: 'range',
                    width: 150,
                    render: (_: unknown, parameter) => rangeHint(parameter),
                  },
                  dateTimeColumn('Last changed', 'updatedAt', 170),
                ]}
              />
            </TableCard>
          ))
        }
      </QueryState>
    </>
  );
}
