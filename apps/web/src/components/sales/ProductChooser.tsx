import { Radio, Tag } from 'antd';
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
          <h3 className="form-section__title product-chooser__line">{line}</h3>
          <div className="choice-cards">
            {products
              .filter((product) => product.lineOfBusiness === line)
              .map((product) => (
                <Radio key={product.id} value={product.id} className="choice-card">
                  <div className="choice-card__body">
                    <div className="choice-card__title">{product.name}</div>
                    <div className="choice-card__description">{product.description}</div>
                    <div className="choice-card__tags">
                      <Tag>{product.code}</Tag>
                      <Tag>
                        {product.paymentBeforeIssuance ? 'Pay before issue' : 'Pay after issue'}
                      </Tag>
                      {product.allowRenewal && <Tag>Renewable</Tag>}
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
