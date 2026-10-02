import { Checkbox, Col, Row, Typography } from 'antd';
import type { PermissionDefinition } from '../../api/admin-types';
import '../../styles/admin.css';

interface Props {
  permissions: PermissionDefinition[];
  value?: string[];
  onChange?(value: string[]): void;
}

/** BO-04: permissions grouped by functional area, each group with a select-all box. */
export function PermissionPicker({ permissions, value = [], onChange }: Props) {
  const groups = [...new Set(permissions.map((permission) => permission.group))];
  const selected = new Set(value);

  const setGroup = (codes: string[], checked: boolean) => {
    const next = new Set(selected);
    codes.forEach((code) => (checked ? next.add(code) : next.delete(code)));
    onChange?.([...next]);
  };

  return (
    <Row gutter={[16, 8]}>
      {groups.map((group) => {
        const members = permissions.filter((permission) => permission.group === group);
        const codes = members.map((permission) => permission.code);
        const count = codes.filter((code) => selected.has(code)).length;
        return (
          <Col key={group} xs={24} md={12}>
            <fieldset className="permission-group">
              <legend>
                <Checkbox
                  checked={count === codes.length}
                  indeterminate={count > 0 && count < codes.length}
                  onChange={(event) => setGroup(codes, event.target.checked)}
                >
                  <Typography.Text strong>{group}</Typography.Text>
                </Checkbox>
              </legend>
              {members.map((permission) => (
                <div key={permission.code}>
                  <Checkbox
                    checked={selected.has(permission.code)}
                    onChange={(event) => setGroup([permission.code], event.target.checked)}
                  >
                    {permission.description}
                  </Checkbox>
                </div>
              ))}
            </fieldset>
          </Col>
        );
      })}
    </Row>
  );
}
