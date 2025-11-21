export interface ExtractedColor {
  hex: string;
  rgb: [number, number, number];
  hsl: [number, number, number];
  lab: [number, number, number];
  name?: string;
  confidence?: number;
}

export async function extractColorsFromImage(
  file: File,
  quality: "fast" | "balanced" | "accurate" = "balanced",
  k: number = 5,
): Promise<ExtractedColor[]> {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/colors/extract?quality=${quality}&k=${k}`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    throw new Error("Failed to extract colors");
  }

  const data = await response.json();
  return data.colors;
}
