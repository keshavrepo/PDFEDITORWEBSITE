export interface ExifData {
  make?: string;
  model?: string;
  date?: string;
  width?: number;
  height?: number;
  orientation?: number;
  exposure?: string;
  aperture?: string;
  iso?: number;
}

export async function readExif(file: File): Promise<ExifData> {
  const arrayBuffer = await file.arrayBuffer();
  const text = new TextDecoder('latin1').decode(arrayBuffer.slice(0, 2048));
  const result: ExifData = {};
  if (text.includes('Exif')) {
    result.date = new Date(file.lastModified).toISOString();
  }
  result.width = 0;
  result.height = 0;
  return result;
}
