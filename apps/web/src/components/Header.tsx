'use client';

import { motion } from 'framer-motion';

const Header = () => {
  return (
    <header className="flex items-center justify-between p-10 w-screen">
      <motion.div
        initial={{ opacity: 0, y: 0 }}
        animate={{ opacity: 1, y: 20 }}
        transition={{ duration: 0.5 }}
        className="flex justify-center items-center space-x-2 w-full"
      >
        <motion.h1 className="text-3xl font-medium" whileHover={{ scale: 1.05 }}>
          hue-und-you
        </motion.h1>
      </motion.div>
    </header>
  );
};

export default Header;
