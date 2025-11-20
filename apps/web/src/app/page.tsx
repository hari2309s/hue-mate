"use client";

import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Loader, Download, Share2, Palette } from "lucide-react";
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
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
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
      <motion.header
        className="border-b border-gray-200 bg-white/50 backdrop-blur"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <div className="max-w-6xl mx-auto px-4 py-6">
          <motion.div
            className="flex items-center gap-3"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <Palette className="w-10 h-10 text-purple-600" />
            <div>
              <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
                Hue & You
              </h1>
              <p className="text-gray-600 mt-1">
                Extract perfect color palettes from images instantly
              </p>
            </div>
          </motion.div>
        </div>
      </motion.header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        {/* Upload Section */}
        <motion.div
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <motion.div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-purple-500 bg-purple-50 scale-105"
                : "border-gray-300 hover:border-purple-500"
            }`}
            whileHover={{ scale: 1.01 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <motion.div
              animate={
                loading
                  ? { rotate: 360 }
                  : isDragging
                    ? { scale: 1.2, y: -5 }
                    : { scale: 1, y: 0 }
              }
              transition={
                loading
                  ? { duration: 1, repeat: Infinity, ease: "linear" }
                  : { type: "spring", stiffness: 300 }
              }
            >
              {loading ? (
                <Loader className="w-12 h-12 text-purple-600 mx-auto mb-4" />
              ) : (
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              )}
            </motion.div>
            <p className="text-lg font-semibold text-gray-900">
              {loading
                ? "Processing your image..."
                : isDragging
                  ? "Drop it like it's hot! 🔥"
                  : "Drop your image here or click to upload"}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              PNG, JPG, or WebP • Max 10MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
              className="hidden"
              disabled={loading}
            />
          </motion.div>
        </motion.div>

        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              className="flex justify-center py-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Loader className="w-8 h-8 text-purple-600 animate-spin" />
            </motion.div>
          )}

          {imagePreview && !loading && (
            <motion.div
              className="grid md:grid-cols-2 gap-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
            >
              {/* Image Preview */}
              <motion.div
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
              >
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  Uploaded Image
                </h2>
                <motion.img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full rounded-lg"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                />
              </motion.div>

              {/* Color Palette */}
              <div className="space-y-6">
                <motion.div
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                >
                  <h2 className="text-xl font-bold text-gray-900 mb-4">
                    Extracted Palette
                  </h2>
                  <div className="grid grid-cols-3 gap-4">
                    {colors.map((color, idx) => (
                      <ColorSwatch key={idx} {...color} index={idx} />
                    ))}
                  </div>
                </motion.div>

                {/* Actions */}
                <motion.div
                  className="grid grid-cols-2 gap-3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                >
                  <motion.button
                    onClick={downloadTailwindConfig}
                    className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Download className="w-4 h-4" />
                    Tailwind
                  </motion.button>
                  <motion.button
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Share2 className="w-4 h-4" />
                    Share
                  </motion.button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
