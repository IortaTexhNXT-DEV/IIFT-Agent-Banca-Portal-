import { Form, Input } from 'antd';
import '../../styles/admin.css';

type Shape = 'object' | 'array';

function matches(value: unknown, shape: Shape): boolean {
  return shape === 'array' ? Array.isArray(value) : typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Pretty-printed JSON for editing. */
export function toJsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

interface Props {
  name: string;
  label: string;
  shape: Shape;
  extra?: string;
  rows?: number;
}

/** Monospace JSON editor field that checks the text parses to an object or array. */
export function JsonField({ name, label, shape, extra, rows = 12 }: Props) {
  return (
    <Form.Item
      name={name}
      label={label}
      extra={extra}
      rules={[
        { required: true, message: `Enter the ${label.toLowerCase()}` },
        {
          validator: (_, text: string) => {
            try {
              return matches(JSON.parse(text), shape) ? Promise.resolve() : Promise.reject(new Error(`Must be a JSON ${shape}`));
            } catch (error) {
              return Promise.reject(new Error(`Invalid JSON: ${(error as Error).message}`));
            }
          },
        },
      ]}
    >
      <Input.TextArea rows={rows} spellCheck={false} className="json-editor" />
    </Form.Item>
  );
}
