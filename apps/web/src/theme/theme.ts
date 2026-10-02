import type { ThemeConfig } from 'antd';

/**
 * Design tokens. Magenta is the single accent (primary actions, active navigation, links);
 * orange is reserved for warnings and items needing attention. Everything else is neutral.
 * The same values are exposed as CSS custom properties in styles.css.
 */
export const brand = {
  magenta: '#E1058C',
  magentaDark: '#B0046D',
  magentaLight: '#FDEDF6',
  orange: '#F58220',
  orangeLight: '#FEF3E8',
  ink: '#1F2329',
  text: '#3A3F47',
  muted: '#5B6270',
  subtle: '#8A909C',
  surface: '#F4F5F7',
  fill: '#F7F8FA',
  border: '#E3E5E8',
  borderStrong: '#D3D7DD',
  success: '#1E8E3E',
  danger: '#D92D20',
  info: '#2F6DB5',
} as const;

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif";

export const theme: ThemeConfig = {
  token: {
    colorPrimary: brand.magenta,
    colorLink: brand.magentaDark,
    colorLinkHover: brand.magenta,
    colorSuccess: brand.success,
    colorWarning: brand.orange,
    colorError: brand.danger,
    colorInfo: brand.info,
    colorTextBase: brand.ink,
    colorText: brand.ink,
    colorTextSecondary: brand.muted,
    colorTextTertiary: brand.subtle,
    colorBorder: brand.borderStrong,
    colorBorderSecondary: brand.border,
    colorBgLayout: brand.surface,
    colorFillAlter: brand.fill,
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    controlHeight: 32,
    boxShadowSecondary: '0 6px 16px rgba(31, 35, 41, 0.08), 0 1px 3px rgba(31, 35, 41, 0.06)',
  },
  components: {
    Layout: {
      headerBg: '#FFFFFF',
      siderBg: '#FFFFFF',
      bodyBg: brand.surface,
      headerHeight: 56,
      headerPadding: '0 16px',
    },
    Menu: {
      itemHeight: 36,
      itemBorderRadius: 6,
      itemMarginInline: 8,
      itemMarginBlock: 2,
      itemColor: brand.text,
      itemHoverBg: brand.surface,
      itemSelectedBg: brand.magentaLight,
      itemSelectedColor: brand.magentaDark,
      subMenuItemBg: '#FFFFFF',
      subMenuItemSelectedColor: brand.magentaDark,
      groupTitleColor: brand.subtle,
      groupTitleFontSize: 12,
      iconSize: 15,
      collapsedIconSize: 16,
      activeBarBorderWidth: 0,
    },
    Card: {
      headerFontSize: 15,
      headerFontSizeSM: 14,
      headerHeight: 48,
      headerHeightSM: 40,
      bodyPadding: 20,
      bodyPaddingSM: 12,
      headerPadding: 20,
      headerPaddingSM: 12,
    },
    Table: {
      headerBg: brand.fill,
      headerColor: brand.muted,
      headerSplitColor: 'transparent',
      headerBorderRadius: 0,
      borderColor: brand.border,
      rowHoverBg: '#FAFAFB',
      cellPaddingBlock: 12,
      cellPaddingInline: 12,
      cellPaddingBlockMD: 10,
      cellPaddingInlineMD: 12,
      cellPaddingBlockSM: 8,
      cellPaddingInlineSM: 10,
      footerBg: '#FFFFFF',
    },
    Form: {
      labelFontSize: 13,
      labelColor: brand.text,
      verticalLabelPadding: '0 0 4px',
      itemMarginBottom: 16,
      labelRequiredMarkColor: brand.danger,
    },
    Button: {
      fontWeight: 500,
      primaryShadow: 'none',
      defaultShadow: 'none',
      dangerShadow: 'none',
    },
    Tag: {
      defaultBg: brand.fill,
      defaultColor: brand.text,
    },
    Descriptions: {
      labelColor: brand.subtle,
      titleColor: brand.ink,
      itemPaddingBottom: 12,
      colonMarginRight: 0,
      colonMarginLeft: 0,
    },
    Tabs: {
      horizontalItemPadding: '12px 0',
      horizontalItemGutter: 28,
      horizontalMargin: '0 0 16px 0',
      itemColor: brand.muted,
    },
    Breadcrumb: {
      fontSize: 12,
      itemColor: brand.subtle,
      lastItemColor: brand.muted,
      linkColor: brand.subtle,
      linkHoverColor: brand.magentaDark,
      separatorColor: brand.borderStrong,
    },
    Steps: {
      titleLineHeight: 22,
    },
    Alert: {
      withDescriptionPadding: '12px 16px',
    },
    Modal: {
      titleFontSize: 16,
    },
    Drawer: {
      footerPaddingBlock: 12,
      footerPaddingInline: 20,
    },
    Statistic: {
      contentFontSize: 22,
    },
  },
};
