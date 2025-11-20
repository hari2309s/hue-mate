import React, { useState } from "react";
import { motion } from "framer-motion";

interface ColorSwatchProps {
  hex: string;
  rgb: [number, number, number];
  hsl: [number, number, number];
  name?: string;
  index?: number;
}

export const ColorSwatch: React.FC<ColorSwatchProps> = ({
  hex,
  rgb,
  hsl,
  name,
  index = 0,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      className="flex flex-col items-center gap-2"
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.1,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      <motion.div
        className="w-16 h-16 rounded-lg shadow-md border border-gray-200 cursor-pointer relative overflow-hidden"
        style={{ backgroundColor: hex }}
        title={hex}
        onClick={handleCopy}
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        {copied && (
          <motion.div
            className="absolute inset-0 bg-black/50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <span className="text-white text-xs font-bold">✓</span>
          </motion.div>
        )}
      </motion.div>
      <motion.div
        className="text-center text-xs"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.1 + 0.2 }}
      >
        <p className="font-semibold text-gray-900">{hex}</p>
        {name && <p className="text-gray-600">{name}</p>}
        <p className="text-gray-500 text-xs">RGB({rgb.join(",")})</p>
        <p className="text-gray-500 text-xs">HSL({hsl.join(",")})</p>
      </motion.div>
    </motion.div>
  );
};
