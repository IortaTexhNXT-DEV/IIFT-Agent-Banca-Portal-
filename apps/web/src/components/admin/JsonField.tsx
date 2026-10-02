import { Form, Input } from 'antd';
import '../../styles/admin.css';

type Shape = 'object' | 'array';

function matches(value: unknown, shape: Shape): boolean {
  return shape === 'array'
    ? Array.isArray(value)
    : typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Pretty-printed JSON for editing. */
export function toJsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

interface Props {
  name: string;
  label: string;
  shape: Shape;
  /** Shown as a tooltip on the label, e.g. the expected entry shape. */
  tooltip?: string;
  className?: string;
}

/** Monospace JSON editor field of fixed height that checks the text parses to an object or array. */
export function JsonField({ name, label, shape, tooltip, className }: Props) {
  return (
    <Form.Item
      name={name}
      label={label}
      tooltip={tooltip}
      className={className}
      rules={[
        { required: true, message: `Enter the ${label.toLowerCase()}` },
        {
          validator: (_, text: string) => {
            try {
              return matches(JSON.parse(text), shape)
                ? Promise.resolve()
                : Promise.reject(new Error(`Must be a JSON ${shape}`));
            } catch {
              return Promise.reject(new Error('Invalid JSON'));
            }
          },
        },
      ]}
    >
      <Input.TextArea spellCheck={false} className="json-editor" />
    </Form.Item>
  );
}
