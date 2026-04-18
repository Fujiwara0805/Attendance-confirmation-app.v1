'use client';

import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';

export default function ThanksPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="text-center px-6"
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center mb-6"
        >
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center ring-1 ring-indigo-100 shadow-sm">
            <Heart size={40} strokeWidth={1.5} className="text-indigo-500" />
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900"
        >
          ありがとうございました
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-3 text-sm sm:text-base text-slate-500 leading-relaxed"
        >
          出席登録が完了しました。このページは閉じて構いません。
        </motion.p>
      </motion.div>
    </div>
  );
}
