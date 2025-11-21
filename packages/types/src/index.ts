export interface ColorPalette {
  id: number;
  name: string;
  colors: string[];
  description?: string;
}

export interface User {
  id: number;
  email: string;
  name?: string;
}
