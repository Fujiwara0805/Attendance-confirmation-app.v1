'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
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
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-xl"
          >
            {/* ヘッダー */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-xl font-bold text-indigo-700">
                位置情報の許可方法
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* コンテンツ */}
            <div className="p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentPage}
                  initial={{ x: 50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -50, opacity: 0 }}
                  transition={{ duration: 0.3 }}
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
                          <li>プライバシーとセキュリティをクリック</li>
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
              <div className="flex items-center justify-center mt-6 space-x-4">
                <Button
                  variant="outline"
                  onClick={handlePrev}
                  disabled={currentPage === 1}
                  className="flex items-center space-x-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>前へ</span>
                </Button>

                {currentPage < totalPages ? (
                  <Button
                    onClick={handleNext}
                    className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700"
                  >
                    <span>次へ</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleClose}
                    className="bg-green-600 hover:bg-green-700 text-white"
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
