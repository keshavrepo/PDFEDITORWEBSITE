export async function compareImages(
  beforeFile: File,
  afterFile: File,
  progress?: (p: number) => void
): Promise<{ beforeUrl: string; afterUrl: string; diffUrl?: string }> {
  progress?.(10);
  const beforeUrl = URL.createObjectURL(beforeFile);
  const afterUrl = URL.createObjectURL(afterFile);
  progress?.(100);
  return { beforeUrl, afterUrl };
}
