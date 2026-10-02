import type { ThemeConfig } from 'antd';

/** Insurans TAIB / Family Takaful brand palette. */
export const brand = {
  magenta: '#E1058C',
  magentaDark: '#B0046D',
  magentaLight: '#FCE6F3',
  orange: '#F58220',
  orangeLight: '#FEF0E3',
  ink: '#2B2B33',
  muted: '#6B6B76',
  surface: '#F7F5F8',
  border: '#ECE6EA',
} as const;

export const theme: ThemeConfig = {
  token: {
    colorPrimary: brand.magenta,
    colorLink: brand.magentaDark,
    colorWarning: brand.orange,
    colorInfo: brand.magenta,
    colorTextBase: brand.ink,
    colorBgLayout: brand.surface,
    borderRadius: 8,
    fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
    fontSize: 14,
  },
  components: {
    Layout: { headerBg: '#FFFFFF', siderBg: '#FFFFFF', headerHeight: 64, headerPadding: '0 24px' },
    Menu: { itemSelectedBg: brand.magentaLight, itemSelectedColor: brand.magentaDark, itemBorderRadius: 8 },
    Card: { headerFontSize: 15 },
    Table: { headerBg: '#FBF7FA', headerColor: brand.ink },
    Statistic: { contentFontSize: 26 },
  },
};
