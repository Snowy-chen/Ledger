import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context';

/**
 * Ant Design token overrides.
 *
 * These hex values deliberately mirror the CSS custom properties in
 * `styles.css` (`--primary`, `--ink`, `--muted`, ...). Ant Design v4 is
 * CSS-in-JS: its tokens are JS objects and cannot read CSS variables, so the
 * palette exists in two places and both must change together.
 *
 * The palette comes from the Figma file (`极简记账`); the orange is the same
 * one the FAB and the active nav item use.
 */
export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: '#ff5b00',
    colorError: '#d4380d',
    colorText: '#1a1a1a',
    colorTextSecondary: '#8c8c8c',
    colorBorder: '#f0f0f0',
    colorBorderSecondary: '#f0f0f0',
    colorBgContainer: '#ffffff',
    borderRadius: 12,
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
  },
};
