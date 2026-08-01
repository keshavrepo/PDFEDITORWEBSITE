interface IcoEntry {
  width: number;
  height: number;
  bpp: number;
  dataLength: number;
  dataOffset: number;
  pngData: Uint8Array;
}

export function encodeIco(entries: { size: number; pngData: Uint8Array }[]): Uint8Array {
  const count = entries.length;
  let offset = 6 + count * 16;
  const icoEntries: IcoEntry[] = [];
  for (const e of entries) {
    icoEntries.push({
      width: e.size > 255 ? 0 : e.size,
      height: e.size > 255 ? 0 : e.size,
      bpp: 32,
      dataLength: e.pngData.length,
      dataOffset: offset,
      pngData: e.pngData
    });
    offset += e.pngData.length;
  }
  const totalSize = offset;
  const ico = new Uint8Array(totalSize);
  // ICO header
  ico[0] = 0; ico[1] = 0; // Reserved
  ico[2] = 1; ico[3] = 0; // Type: icon (1)
  ico[4] = count & 0xff;
  ico[5] = (count >> 8) & 0xff;
  let pos = 6;
  for (const entry of icoEntries) {
    ico[pos++] = entry.width === 255 ? 0 : entry.width;
    ico[pos++] = entry.height === 255 ? 0 : entry.height;
    ico[pos++] = 0; // Color count (0 for > 8bpp)
    ico[pos++] = 0; // Reserved
    // Size in bytes (4 bytes, little-endian)
    const sizeLE = new Uint8Array(new Uint32Array([entry.dataLength]).buffer);
    ico[pos++] = sizeLE[0]; ico[pos++] = sizeLE[1]; ico[pos++] = sizeLE[2]; ico[pos++] = sizeLE[3];
    // Offset (4 bytes, little-endian)
    const offLE = new Uint8Array(new Uint32Array([entry.dataOffset]).buffer);
    ico[pos++] = offLE[0]; ico[pos++] = offLE[1]; ico[pos++] = offLE[2]; ico[pos++] = offLE[3];
  }
  // Write PNG data for each entry
  for (const entry of icoEntries) {
    ico.set(entry.pngData, entry.dataOffset);
  }
  return ico;
}
