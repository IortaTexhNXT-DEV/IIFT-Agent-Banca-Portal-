import { Checkbox } from 'antd';
import type { PermissionDefinition } from '../../api/admin-types';
import { FormSection } from '../FormSection';
import '../../styles/admin.css';

interface Props {
  permissions: PermissionDefinition[];
  value?: string[];
  onChange?(value: string[]): void;
}

/** BO-04: permissions grouped by functional area, each area with a select-all box. */
export function PermissionPicker({ permissions, value = [], onChange }: Props) {
  const groups = [...new Set(permissions.map((permission) => permission.group))];
  const selected = new Set(value);

  const setGroup = (codes: string[], checked: boolean) => {
    const next = new Set(selected);
    codes.forEach((code) => (checked ? next.add(code) : next.delete(code)));
    onChange?.([...next]);
  };

  return (
    <div className="permission-picker">
      {groups.map((group) => {
        const members = permissions.filter((permission) => permission.group === group);
        const codes = members.map((permission) => permission.code);
        const count = codes.filter((code) => selected.has(code)).length;
        return (
          <FormSection
            key={group}
            columns={2}
            title={
              <Checkbox
                checked={count === codes.length}
                indeterminate={count > 0 && count < codes.length}
                onChange={(event) => setGroup(codes, event.target.checked)}
              >
                {group}
              </Checkbox>
            }
            extra={
              <span className="muted">
                {count} of {codes.length}
              </span>
            }
          >
            {members.map((permission) => (
              <Checkbox
                key={permission.code}
                checked={selected.has(permission.code)}
                onChange={(event) => setGroup([permission.code], event.target.checked)}
              >
                {permission.description}
              </Checkbox>
            ))}
          </FormSection>
        );
      })}
    </div>
  );
}
