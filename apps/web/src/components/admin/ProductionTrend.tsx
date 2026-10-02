import dayjs from 'dayjs';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MonthlyPoint } from '../../api/types';
import { brand } from '../../theme/theme';
import { formatMoney, formatNumber } from '../../utils/format';
import '../../styles/admin.css';

const SYNC_ID = 'production-trend';
const CHART_MARGIN = { top: 8, right: 8, left: 0, bottom: 0 };

/**
 * BO-20: contribution and policy count per month. The two measures have different
 * scales, so they are drawn as two aligned charts sharing the month axis and hover
 * rather than on one chart with two value axes.
 */
export function ProductionTrend({ points }: { points: MonthlyPoint[] }) {
  const data = points.map((point) => ({ ...point, label: dayjs(`${point.month}-01`).format('MMM YY') }));
  return (
    <>
      <div className="chart-title">Contribution issued (B$)</div>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={data} syncId={SYNC_ID} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={brand.border} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={72} tickFormatter={(value: number) => value.toLocaleString('en-GB')} />
            <Tooltip formatter={(value) => [formatMoney(Number(value)), 'Contribution']} />
            <Bar dataKey="contribution" fill={brand.magenta} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-title">Policies issued</div>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height={150}>
          <ComposedChart data={data} syncId={SYNC_ID} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={brand.border} />
            <XAxis dataKey="label" scale="band" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={72} allowDecimals={false} />
            <Tooltip formatter={(value) => [formatNumber(Number(value)), 'Policies']} />
            <Line type="monotone" dataKey="policies" stroke={brand.magentaDark} strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
