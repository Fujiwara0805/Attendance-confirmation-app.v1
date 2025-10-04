'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, HelpCircle } from 'lucide-react';
import Image from 'next/image';

interface LocationPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LocationPermissionModal({ isOpen, onClose }: LocationPermissionModalProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 2;

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrev = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleClose = () => {
    setCurrentPage(1);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-gray-100"
        >
            {/* ヘッダー */}
            <div className="flex items-center justify-between p-6 bg-indigo-600 text-white">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-full">
                  <HelpCircle className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">
                  位置情報の許可方法
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="text-white hover:bg-white/20 hover:text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* コンテンツ */}
            <div className="p-8 bg-gray-50">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentPage}
                  initial={{ x: 50, opacity: 0, scale: 0.95 }}
                  animate={{ x: 0, opacity: 1, scale: 1 }}
                  exit={{ x: -50, opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                  className="text-center"
                >
                  {currentPage === 1 && (
                    <div className="space-y-4">
                      <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                        <Image
                          src="https://res.cloudinary.com/dz9trbwma/image/upload/v1759390749/IMG_6344_nhxucx.jpg"
                          alt="位置情報許可手順1"
                          fill
                          className="object-contain"
                        />
                      </div>
                      <div className="text-left space-y-3">
                        <h4 className="text-lg font-semibold text-gray-800">
                          ステップ1: 設定画面へ
                        </h4>
                        <ul className="text-gray-600 leading-relaxed space-y-2 list-disc list-inside">
                          <li>デバイスの設定画面へ</li>
                          <li>「プライバシーとセキュリティ」をタップ</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {currentPage === 2 && (
                    <div className="space-y-4">
                      <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                        <Image
                          src="https://res.cloudinary.com/dz9trbwma/image/upload/v1759390747/IMG_6345_xmqfew.jpg"
                          alt="位置情報許可手順2"
                          fill
                          className="object-contain"
                        />
                      </div>
                      <div className="text-left space-y-3">
                        <h4 className="text-lg font-semibold text-gray-800">
                          ステップ2: 位置情報の許可
                        </h4>
                        <ul className="text-gray-600 leading-relaxed space-y-2 list-disc list-inside">
                          <li>位置情報サービスをクリック</li>
                          <li>使用しているブラウザの設定を変更</li>
                          <li>「次回または共有時に確認」を選択</li>
                          <li>もしくは、「使用中」を選択</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* ページネーション */}
              <div className="flex items-center justify-center mt-8 space-x-6 bg-white rounded-xl p-4 shadow-md border border-gray-100">
                <Button
                  variant="outline"
                  onClick={handlePrev}
                  disabled={currentPage === 1}
                  className="flex items-center space-x-2 bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>前へ</span>
                </Button>

                {currentPage < totalPages ? (
                  <Button
                    onClick={handleNext}
                    className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                  >
                    <span>次へ</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleClose}
                    className="bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                  >
                    理解しました
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
