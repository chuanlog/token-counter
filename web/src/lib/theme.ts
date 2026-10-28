/** Recharts 使用 SVG 属性，避免依赖 CSS 变量解析。与 styles.css 中的变量保持一致。 */
export const chartTheme = {
  surface: '#13161c',
  surfaceRaised: '#1a1f27',
  grid: '#242a33',
  axis: '#343c48',
  muted: '#7f8794',
  ink: '#eef1f6',
  ink2: '#b9c0cc',
  border: 'rgba(255, 255, 255, 0.08)',
  cursor: 'rgba(255, 255, 255, 0.045)',
  cursorLine: '#3b4452',
} as const;
