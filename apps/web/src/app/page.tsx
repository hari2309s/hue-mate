"use client";

import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Loader,
  Download,
  Share2,
  Palette,
  Copy,
  Check,
  Zap,
} from "lucide-react";
import { ColorSwatch } from "@hue-und-you/ui";
import { extractColorsFromImage } from "@/lib/color-extraction";

interface ExtractedColor {
  hex: string;
  rgb: [number, number, number];
  hsl: [number, number, number];
  lab: [number, number, number];
  name?: string;
  confidence?: number;
}

interface ExtractionStats {
  processingTimeMs: number;
  quality: string;
  colorCount: number;
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [quality, setQuality] = useState<"fast" | "balanced" | "accurate">(
    "balanced",
  );
  const [colors, setColors] = useState<ExtractedColor[]>([]);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [stats, setStats] = useState<ExtractionStats | null>(null);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<
    "tailwind" | "figma" | "css"
  >("tailwind");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image file");
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      alert("File size must be less than 50MB");
      return;
    }

    setLoading(true);
    try {
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Extract colors with timing
      const startTime = performance.now();
      const response = await extractColorsFromImage(file, quality, 5);

      // Handle both direct color array and response object
      const extractedColors = Array.isArray(response)
        ? response
        : response.colors;
      const processingTime = Array.isArray(response)
        ? Math.round(performance.now() - startTime)
        : response.processingTimeMs;

      setColors(extractedColors);
      setStats({
        processingTimeMs: processingTime,
        quality: quality,
        colorCount: extractedColors.length,
      });
    } catch (error) {
      console.error("Error extracting colors:", error);
      alert(
        "Failed to extract colors. Please try another image or check your connection.",
      );
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
    } else {
      alert("Please drop a valid image file");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleCopyHex = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 2000);
  };

  const generateTailwindConfig = (): string => {
    const colorMap: Record<string, Record<string, string>> = {};

    colors.forEach((color, idx) => {
      const colorName =
        color.name
          ?.toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "") || `custom-${idx + 1}`;

      const scale = generateColorScale(color.hex);
      colorMap[colorName] = scale;
    });

    return `module.exports = {
  theme: {
    extend: {
      colors: ${JSON.stringify(colorMap, null, 8)}
    }
  },
  plugins: [],
}`;
  };

  const generateFigmaVariables = (): string => {
    const tokens = {
      colors: {} as Record<string, Record<string, string>>,
    };

    colors.forEach((color, idx) => {
      const colorName =
        color.name
          ?.toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "") || `custom-${idx + 1}`;

      tokens.colors[colorName] = {
        "50": adjustBrightness(color.hex, 0.95),
        "100": adjustBrightness(color.hex, 0.9),
        "200": adjustBrightness(color.hex, 0.75),
        "300": adjustBrightness(color.hex, 0.6),
        "400": adjustBrightness(color.hex, 0.3),
        "500": color.hex,
        "600": adjustBrightness(color.hex, -0.1),
        "700": adjustBrightness(color.hex, -0.2),
        "800": adjustBrightness(color.hex, -0.3),
        "900": adjustBrightness(color.hex, -0.4),
        "950": adjustBrightness(color.hex, -0.5),
      };
    });

    return JSON.stringify(tokens, null, 2);
  };

  const generateCSSVariables = (): string => {
    let css = ":root {\n";

    colors.forEach((color, idx) => {
      const colorName =
        color.name
          ?.toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "") || `custom-${idx + 1}`;

      css += `  --color-${colorName}: ${color.hex};\n`;
      css += `  --color-${colorName}-rgb: ${color.rgb.join(", ")};\n`;
      css += `  --color-${colorName}-hsl: ${color.hsl[0]}, ${color.hsl[1]}%, ${color.hsl[2]}%;\n`;
    });

    css += "}\n";
    return css;
  };

  const downloadExport = () => {
    let content = "";
    let filename = "";
    let mimeType = "text/plain";

    switch (exportFormat) {
      case "tailwind":
        content = generateTailwindConfig();
        filename = "tailwind.config.js";
        mimeType = "text/javascript";
        break;
      case "figma":
        content = generateFigmaVariables();
        filename = "figma-tokens.json";
        mimeType = "application/json";
        break;
      case "css":
        content = generateCSSVariables();
        filename = "colors.css";
        mimeType = "text/css";
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const shareColors = async () => {
    const colorList = colors
      .map((c) => `${c.name || "Color"}: ${c.hex}`)
      .join("\n");

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Color Palette",
          text: `Check out this color palette:\n${colorList}`,
        });
      } catch (error) {
        console.error("Share failed:", error);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(colorList);
      alert("Colors copied to clipboard!");
    }
  };

  const resetUpload = () => {
    setColors([]);
    setImagePreview("");
    setStats(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <motion.header
        className="border-b border-gray-200 bg-white/50 backdrop-blur sticky top-0 z-40"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <div className="max-w-7xl mx-auto px-4 py-6">
          <motion.div
            className="flex items-center justify-between"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              >
                <Palette className="w-10 h-10 text-purple-600" />
              </motion.div>
              <div>
                <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
                  Hue & You
                </h1>
                <p className="text-gray-600 text-sm mt-1">
                  ML-powered color extraction for designers
                </p>
              </div>
            </div>

            {/* Quality Badge */}
            <motion.div
              className="hidden md:flex items-center gap-2 px-3 py-2 bg-purple-100 rounded-lg"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Zap className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-semibold text-purple-700">
                Advanced ML
              </span>
            </motion.div>
          </motion.div>
        </div>
      </motion.header>

      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Quality & Settings */}
        {!imagePreview && (
          <motion.div
            className="mb-8 flex justify-center gap-4 flex-wrap"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {(["fast", "balanced", "accurate"] as const).map((q) => (
              <motion.button
                key={q}
                onClick={() => setQuality(q)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  quality === q
                    ? "bg-purple-600 text-white shadow-lg"
                    : "bg-white text-gray-700 border border-gray-300 hover:border-purple-600"
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {q.charAt(0).toUpperCase() + q.slice(1)}
              </motion.button>
            ))}
          </motion.div>
        )}

        {/* Upload Section */}
        <motion.div
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          layout
        >
          <motion.div
            onClick={() => !loading && fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-purple-500 bg-purple-50 scale-105"
                : "border-gray-300 hover:border-purple-500 hover:bg-purple-50/50"
            } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
            whileHover={{ scale: loading ? 1 : 1.01 }}
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
                <Loader className="w-16 h-16 text-purple-600 mx-auto mb-4" />
              ) : (
                <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              )}
            </motion.div>

            <p className="text-2xl font-bold text-gray-900 mb-2">
              {loading
                ? "Processing your image with AI..."
                : isDragging
                  ? "Drop it like it's hot! 🔥"
                  : "Drop your image here or click to upload"}
            </p>

            <p className="text-gray-600 mb-4">
              {loading
                ? "Extracting colors using advanced ML clustering..."
                : "PNG, JPG, WebP • Max 50MB • Supports any image"}
            </p>

            {!loading && (
              <motion.div
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-semibold"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Zap className="w-4 h-4" />
                Quality: {quality.charAt(0).toUpperCase() + quality.slice(1)}
              </motion.div>
            )}

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
              aria-label="Upload image"
            />
          </motion.div>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* Results Section */}
          {imagePreview && !loading && (
            <motion.div
              className="space-y-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
            >
              {/* Stats Bar */}
              {stats && (
                <motion.div
                  className="grid grid-cols-3 gap-4"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <motion.div
                    className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200"
                    whileHover={{ scale: 1.02 }}
                  >
                    <p className="text-sm text-purple-700 font-semibold">
                      Processing Time
                    </p>
                    <p className="text-2xl font-bold text-purple-900 mt-1">
                      {stats.processingTimeMs}ms
                    </p>
                  </motion.div>

                  <motion.div
                    className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200"
                    whileHover={{ scale: 1.02 }}
                  >
                    <p className="text-sm text-blue-700 font-semibold">
                      Colors Extracted
                    </p>
                    <p className="text-2xl font-bold text-blue-900 mt-1">
                      {stats.colorCount}
                    </p>
                  </motion.div>

                  <motion.div
                    className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-4 border border-indigo-200"
                    whileHover={{ scale: 1.02 }}
                  >
                    <p className="text-sm text-indigo-700 font-semibold">
                      Quality Mode
                    </p>
                    <p className="text-2xl font-bold text-indigo-900 mt-1 capitalize">
                      {stats.quality}
                    </p>
                  </motion.div>
                </motion.div>
              )}

              {/* Main Content Grid */}
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Image Preview */}
                <motion.div
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-hidden"
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                >
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-purple-600" />
                    Uploaded Image
                  </h2>
                  <motion.img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full rounded-lg object-cover max-h-96"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                  />
                </motion.div>

                {/* Color Palette */}
                <motion.div
                  className="space-y-6"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                >
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Palette className="w-5 h-5 text-purple-600" />
                      Extracted Palette
                    </h2>

                    <div className="grid grid-cols-3 gap-4">
                      {colors.map((color, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.1 }}
                        >
                          <ColorSwatch {...color} index={idx} />
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Color Details */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-h-80 overflow-y-auto">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">
                      Color Details
                    </h3>
                    <div className="space-y-3">
                      {colors.map((color, idx) => (
                        <motion.div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                          whileHover={{ scale: 1.02 }}
                          onClick={() => handleCopyHex(color.hex)}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <motion.div
                              className="w-8 h-8 rounded border border-gray-300 shadow-sm"
                              style={{ backgroundColor: color.hex }}
                              whileHover={{ scale: 1.1 }}
                            />
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-900">
                                {color.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {color.hex}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {color.confidence && (
                              <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded">
                                {color.confidence}%
                              </span>
                            )}
                            <motion.button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyHex(color.hex);
                              }}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {copiedHex === color.hex ? (
                                <Check className="w-4 h-4 text-green-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </motion.button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Export Section */}
              <motion.div
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Download className="w-5 h-5 text-purple-600" />
                  Export Your Palette
                </h2>

                <div className="grid md:grid-cols-3 gap-4">
                  {(["tailwind", "figma", "css"] as const).map((format) => (
                    <motion.button
                      key={format}
                      onClick={() => setExportFormat(format)}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        exportFormat === format
                          ? "border-purple-600 bg-purple-50"
                          : "border-gray-200 hover:border-purple-300"
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <p className="font-bold text-gray-900 capitalize mb-1">
                        {format === "figma" ? "Figma Tokens" : format}
                      </p>
                      <p className="text-xs text-gray-600">
                        {format === "tailwind" && "Tailwind CSS config"}
                        {format === "figma" && "Design system tokens"}
                        {format === "css" && "CSS custom properties"}
                      </p>
                    </motion.button>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                  <motion.button
                    onClick={downloadExport}
                    className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors col-span-2 md:col-span-1"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </motion.button>

                  <motion.button
                    onClick={shareColors}
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors col-span-2 md:col-span-1"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Share2 className="w-4 h-4" />
                    Share
                  </motion.button>

                  <motion.button
                    onClick={resetUpload}
                    className="flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-3 px-4 rounded-lg transition-colors col-span-2 md:col-span-1"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Upload className="w-4 h-4" />
                    New
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Loading State */}
          {loading && (
            <motion.div
              className="flex flex-col items-center justify-center py-20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Loader className="w-16 h-16 text-purple-600" />
              </motion.div>
              <p className="mt-4 text-gray-600 font-semibold text-lg">
                Analyzing image colors...
              </p>
              <motion.p
                className="mt-2 text-gray-500 text-sm"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                Using {quality} quality ML extraction
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!imagePreview && !loading && (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-gray-600 text-lg">
              Upload an image to extract its color palette
            </p>
            <p className="text-gray-500 text-sm mt-2">
              Supports JPEG, PNG, WebP and other image formats
            </p>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <motion.footer
        className="mt-20 border-t border-gray-200 bg-white/50 backdrop-blur py-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-600">
          <p>
            Built with <span className="text-red-500">❤️</span> using Next.js,
            Tailwind CSS & ML
          </p>
          <p className="text-sm mt-2 text-gray-500">
            © 2024 Hue & You. All rights reserved.
          </p>
        </div>
      </motion.footer>
    </div>
  );
}

/**
 * Utility functions
 */

function generateColorScale(hex: string): Record<string, string> {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);

  const scale: Record<string, string> = {};
  const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

  shades.forEach((shade) => {
    const factor = (shade - 500) / 500;
    let newL: number;

    if (factor > 0) {
      newL = l + (100 - l) * (factor * 0.5);
    } else {
      newL = l + l * (factor * 0.5);
    }

    const newRgb = hslToRgb(h, s, newL);
    scale[shade.toString()] = rgbToHex(...newRgb);
  });

  return scale;
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [0, 0, 0];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((x) => Math.round(x).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;
  s /= 100;
  l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function adjustBrightness(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const newL = Math.max(0, Math.min(100, l + factor * 100));
  const newRgb = hslToRgb(h, s, newL);
  return rgbToHex(...newRgb);
}
