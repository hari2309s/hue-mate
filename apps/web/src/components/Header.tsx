'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

const titleText = 'hute-mate';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.2,
    },
  },
};

const letterVariants = {
  hidden: {
    opacity: 0,
    y: 20,
    filter: 'blur(10px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

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
        <Image src="/hue.png" alt="Logo" width={28} height={28} />
        <motion.h1
          className="text-3xl font-medium text-soft-orange"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {titleText.split('').map((char, index) => (
            <motion.span
              key={`${char}-${index}`}
              variants={letterVariants}
              className="inline-block"
              style={{ display: 'inline-block' }}
            >
              {char === '-' ? '\u2011' : char}
            </motion.span>
          ))}
        </motion.h1>
      </motion.div>
    </header>
  );
};

export default Header;
