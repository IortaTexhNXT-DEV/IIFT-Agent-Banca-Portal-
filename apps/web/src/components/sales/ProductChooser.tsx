import { Radio, Tag, Typography } from 'antd';
import type { Product } from '../../api/types';

interface Props {
  products: Product[];
  value: string | undefined;
  onChange(product: Product): void;
}

/** AP-17: active products grouped by line of business, chosen as cards. */
export function ProductChooser({ products, value, onChange }: Props) {
  const lines = [...new Set(products.map((product) => product.lineOfBusiness))];
  return (
    <Radio.Group
      value={value}
      onChange={(event) => {
        const product = products.find((candidate) => candidate.id === event.target.value);
        if (product) onChange(product);
      }}
      className="product-chooser"
    >
      {lines.map((line) => (
        <section key={line} className="product-chooser__group" aria-label={line}>
          <Typography.Title level={5} className="form-section-title">
            {line}
          </Typography.Title>
          <div className="choice-cards">
            {products
              .filter((product) => product.lineOfBusiness === line)
              .map((product) => (
                <Radio key={product.id} value={product.id} className="choice-card">
                  <div className="choice-card__body">
                    <div className="choice-card__title">
                      {product.name} <Tag variant="filled">{product.code}</Tag>
                    </div>
                    <div className="muted">{product.description}</div>
                    <div className="choice-card__meta">
                      {product.paymentBeforeIssuance ? 'Issued after payment' : 'Issued on acceptance, pay within the grace period'}
                      {product.allowRenewal ? ' · Renewable' : ''}
                    </div>
                  </div>
                </Radio>
              ))}
          </div>
        </section>
      ))}
    </Radio.Group>
  );
}
