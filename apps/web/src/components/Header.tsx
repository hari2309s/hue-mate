'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

const Header = () => {
  return (
    <header className="flex items-center justify-between p-10 w-screen">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        whileHover={{ scale: 1.05 }}
        className="flex flex-col justify-center items-center space-x-2 w-full"
      >
        <Image src="/hue.png" alt="Logo" width={50} height={50} />
        <motion.h1 className="text-3xl font-medium text-soft-orange">hue-und-you</motion.h1>
      </motion.div>
    </header>
  );
};

export default Header;
