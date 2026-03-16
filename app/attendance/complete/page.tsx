'use client';

import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';

export default function AttendanceComplete() {
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
          <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center ring-1 ring-emerald-100">
            <CheckCircle size={40} strokeWidth={1.5} className="text-emerald-500" />
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold text-gray-900 tracking-tight"
        >
          ありがとうございました
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-3 text-sm text-slate-500"
        >
          出席が正常に登録されました
        </motion.p>
      </motion.div>
    </div>
  );
}
