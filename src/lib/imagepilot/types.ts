export interface ImageLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: string;
  dataUrl?: string;
}

export interface ImageDocument {
  layers: ImageLayer[];
  width: number;
  height: number;
  format: 'png' | 'jpeg' | 'svg';
}
