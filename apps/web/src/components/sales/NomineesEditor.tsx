import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Col, Form, Input, InputNumber, Row, Select, Typography } from 'antd';
import type { NomineeInput } from '../../api/sales-types';
import type { Nominee } from '../../api/types';
import { NOMINEE_ROLE_OPTIONS } from './options';
import { useCodes } from './useCodes';

const MAX_NOMINEES = 10;

/** A row being edited; existing nominees carry their id and masked ID number. */
export type NomineeRow = Partial<NomineeInput> & { idNumberMasked?: string | null };

function totalShares(nominees: NomineeRow[] | undefined): number {
  return (
    Math.round(
      (nominees ?? []).reduce((total, nominee) => total + (nominee?.sharePercent ?? 0), 0) * 100,
    ) / 100
  );
}

/**
 * Nominee, beneficiary and executor rows for an antd Form (field "nominees"). Shares must
 * add up to 100%; relationships come from master data (RELATIONSHIP).
 */
export function NomineesEditor({ required = false }: { required?: boolean }) {
  const relationships = useCodes('RELATIONSHIP');
  const form = Form.useFormInstance();
  const nominees = Form.useWatch<NomineeRow[] | undefined>('nominees', form);
  const total = totalShares(nominees);

  return (
    <Form.List
      name="nominees"
      rules={[
        {
          validator: async (_, rows: NomineeRow[] | undefined) => {
            if (required && (!rows || rows.length === 0))
              throw new Error('Add at least one nominee, beneficiary or executor');
            if (rows && rows.length > 0 && totalShares(rows) !== 100)
              throw new Error(`Shares must add up to 100% (currently ${totalShares(rows)}%)`);
          },
        },
      ]}
    >
      {(fields, { add, remove }, { errors }) => (
        <>
          {fields.map((field, index) => (
            <div key={field.key} className="nominee-row">
              <Form.Item name={[field.name, 'id']} hidden>
                <Input />
              </Form.Item>
              <Row gutter={12} align="top">
                <Col xs={24} md={12} xl={7}>
                  <Form.Item
                    name={[field.name, 'fullName']}
                    label="Full name"
                    rules={[
                      { required: true, whitespace: true, message: 'Enter the name' },
                      { min: 2, max: 150 },
                    ]}
                  >
                    <Input maxLength={150} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12} xl={5}>
                  <Form.Item
                    name={[field.name, 'idNumber']}
                    label="IC / passport no."
                    rules={[
                      { pattern: /^[A-Za-z0-9-/ ]{5,30}$/, message: '5 to 30 letters or digits' },
                    ]}
                  >
                    <Input
                      maxLength={30}
                      autoComplete="off"
                      placeholder={nominees?.[field.name]?.idNumberMasked ?? undefined}
                    />
                  </Form.Item>
                </Col>
                <Col xs={12} md={8} xl={4}>
                  <Form.Item
                    name={[field.name, 'relationship']}
                    label="Relationship"
                    rules={[{ required: true, message: 'Choose the relationship' }]}
                  >
                    <Select options={relationships.options} loading={relationships.loading} />
                  </Form.Item>
                </Col>
                <Col xs={12} md={7} xl={4}>
                  <Form.Item
                    name={[field.name, 'role']}
                    label="Role"
                    rules={[{ required: true, message: 'Choose the role' }]}
                  >
                    <Select options={NOMINEE_ROLE_OPTIONS} />
                  </Form.Item>
                </Col>
                <Col xs={18} md={6} xl={3}>
                  <Form.Item
                    name={[field.name, 'sharePercent']}
                    label="Share %"
                    rules={[{ required: true, message: 'Enter the share' }]}
                  >
                    <InputNumber
                      className="full-width"
                      min={0.01}
                      max={100}
                      precision={2}
                      suffix="%"
                    />
                  </Form.Item>
                </Col>
                <Col xs={6} md={3} xl={1} className="nominee-row__remove">
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label={`Remove nominee ${index + 1}`}
                    onClick={() => remove(field.name)}
                  />
                </Col>
              </Row>
            </div>
          ))}
          <Form.ErrorList errors={errors} />
          <div className="nominee-footer">
            <Button
              icon={<PlusOutlined />}
              disabled={fields.length >= MAX_NOMINEES}
              onClick={() =>
                add({ role: 'NOMINEE', sharePercent: Math.max(0, 100 - total) || undefined })
              }
            >
              Add nominee
            </Button>
            {fields.length > 0 && (
              <Typography.Text type={total === 100 ? 'secondary' : 'danger'}>
                Total share {total}%
              </Typography.Text>
            )}
          </div>
        </>
      )}
    </Form.List>
  );
}

/** Editable rows for the current nominees, or one full-share row to start with. */
export function nomineeRows(nominees: Nominee[]): NomineeRow[] {
  if (nominees.length === 0) return [{ role: 'NOMINEE', sharePercent: 100 }];
  return nominees.map((nominee) => ({
    id: nominee.id,
    fullName: nominee.fullName,
    relationship: nominee.relationship,
    role: nominee.role,
    sharePercent: Number(nominee.sharePercent),
    idNumberMasked: nominee.idNumberMasked,
  }));
}

/** Nominee rows as sent to the API (optional ID number dropped when empty). */
export function toNomineeInputs(rows: NomineeRow[] | undefined): NomineeInput[] {
  return (rows ?? []).map((row) => ({
    id: row.id || undefined,
    fullName: (row.fullName ?? '').trim(),
    idNumber: row.idNumber?.trim() || undefined,
    relationship: row.relationship ?? '',
    role: row.role ?? 'NOMINEE',
    sharePercent: row.sharePercent ?? 0,
  }));
}
