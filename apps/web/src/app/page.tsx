"use client";

import React, { useRef, useState } from "react";
import { Upload, Loader, Download, Share2 } from "lucide-react";
import { ColorSwatch } from "@hue-und-you/ui";
import { extractColorsFromImage } from "@/lib/color-extraction";

interface ExtractedColor {
  hex: string;
  rgb: [number, number, number];
  hsl: [number, number, number];
  name?: string;
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [colors, setColors] = useState<ExtractedColor[]>([]);
  const [imagePreview, setImagePreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Extract colors
      const extractedColors = await extractColorsFromImage(file);
      setColors(extractedColors);
    } catch (error) {
      console.error("Error extracting colors:", error);
      alert("Failed to extract colors. Please try another image.");
    } finally {
      setLoading(false);
    }
  };

  const downloadTailwindConfig = () => {
    const config = generateTailwindConfig(colors);
    const blob = new Blob([config], { type: "text/javascript" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tailwind.config.js";
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
            Hue & You
          </h1>
          <p className="text-gray-600 mt-1">
            Extract perfect color palettes from images instantly
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-purple-500 transition-colors"
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-900">
              {loading
                ? "Processing..."
                : "Drop your image here or click to upload"}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              PNG, JPG, or WebP • Max 10MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={loading}
            />
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <Loader className="w-8 h-8 text-purple-600 animate-spin" />
          </div>
        )}

        {imagePreview && !loading && (
          <div className="grid md:grid-cols-2 gap-8">
            {/* Image Preview */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Uploaded Image
              </h2>
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full rounded-lg"
              />
            </div>

            {/* Color Palette */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  Extracted Palette
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  {colors.map((color, idx) => (
                    <ColorSwatch key={idx} {...color} />
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={downloadTailwindConfig}
                  className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Tailwind
                </button>
                <button className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function generateTailwindConfig(colors: ExtractedColor[]): string {
  const colorMap: Record<string, string> = {};
  colors.forEach((color, idx) => {
    colorMap[`custom-${idx + 1}`] = color.hex;
  });

  return `module.exports = {
  theme: {
    extend: {
      colors: ${JSON.stringify(colorMap, null, 8)}
    }
  }
}`;
}
