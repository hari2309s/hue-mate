import React from "react";

interface ColorSwatchProps {
  hex: string;
  rgb: [number, number, number];
  hsl: [number, number, number];
  name?: string;
}

export const ColorSwatch: React.FC<ColorSwatchProps> = ({
  hex,
  rgb,
  hsl,
  name,
}) => {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="w-16 h-16 rounded-lg shadow-md border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow"
        style={{ backgroundColor: hex }}
        title={hex}
      />
      <div className="text-center text-xs">
        <p className="font-semibold text-gray-900">{hex}</p>
        {name && <p className="text-gray-600">{name}</p>}
        <p className="text-gray-500 text-xs">RGB({rgb.join(",")})</p>
        <p className="text-gray-500 text-xs">HSL({hsl.join(",")})</p>
      </div>
    </div>
  );
};
