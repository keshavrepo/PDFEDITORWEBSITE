export interface OfficeDoc {
  title: string;
  content: string;
  type: 'word' | 'spreadsheet' | 'presentation';
  updatedAt: Date;
}
