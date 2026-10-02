import { Typography } from 'antd';

/** Long text in a table cell, cut to one line with the full text in a tooltip. */
export function CellText({
  text,
  width = 360,
  type,
}: {
  text: string | null | undefined;
  width?: number;
  type?: 'danger';
}) {
  if (!text) return <>–</>;
  return (
    <Typography.Text type={type} ellipsis={{ tooltip: text }} style={{ maxWidth: width }}>
      {text}
    </Typography.Text>
  );
}
