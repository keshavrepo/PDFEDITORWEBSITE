export interface CollageLayout {
  rows: number;
  cols: number;
  gap: number;
  radius: number;
  background: string;
}

export function createCollageGrid(layout: CollageLayout, images: string[]): string {
  const total = layout.rows * layout.cols;
  const cells = images.slice(0, total);
  const gapStr = `${layout.gap}px`;
  const style = `display: grid; grid-template-columns: repeat(${layout.cols}, 1fr); grid-template-rows: repeat(${layout.rows}, 1fr); gap: ${gapStr}; background: ${layout.background}; border-radius: ${layout.radius}px; padding: ${gapStr};`;
  const html = `<div style="${style}">${cells.map(src => `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:${layout.radius}px;" />`).join('')}</div>`;
  return html;
}
