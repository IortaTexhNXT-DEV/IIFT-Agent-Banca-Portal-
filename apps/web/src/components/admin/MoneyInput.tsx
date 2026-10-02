import { InputNumber, type InputNumberProps } from 'antd';

/** Brunei-dollar amount input (two decimals, never negative). */
export function MoneyInput(props: Omit<InputNumberProps<number>, 'prefix' | 'min' | 'precision'>) {
  return (
    <InputNumber<number> prefix="B$" min={0} precision={2} style={{ width: '100%' }} {...props} />
  );
}
