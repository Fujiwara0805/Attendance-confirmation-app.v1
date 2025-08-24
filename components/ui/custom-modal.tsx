"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
  description?: string;
  showCloseButton?: boolean;
  className?: string; // For the main motion.div content wrapper
  dialogContentClassName?: string; // For DialogPrimitive.Content (positioning, max-width etc.)
  overlayClassName?: string;
  contentMotionProps?: Omit<React.ComponentProps<typeof motion.div>, 'children'>;
  overlayMotionProps?: Omit<React.ComponentProps<typeof motion.div>, 'children'>;
}

const CustomModal = React.forwardRef<
  HTMLDivElement, // Ref will be on the motion.div
  CustomModalProps
>(
  (
    {
      isOpen,
      onClose,
      children,
      title,
      description,
      showCloseButton = true,
      className,
      dialogContentClassName,
      overlayClassName,
      contentMotionProps,
      overlayMotionProps,
    },
    ref
  ) => {
    const handleOpenChange = (open: boolean) => {
      if (!open) {
        onClose();
      }
    };

    // Escapeキーで閉じるイベントハンドラ
    React.useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onClose();
        }
      };
      if (isOpen) {
        document.addEventListener('keydown', handleKeyDown);
      }
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, [isOpen, onClose]);

    // Generate unique IDs for title and description for aria attributes
    const titleId = React.useId();
    const descriptionId = React.useId();

    return (
      <DialogPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
        <AnimatePresence>
          {isOpen && (
            <DialogPrimitive.Portal forceMount>
              <DialogPrimitive.Overlay asChild forceMount>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className={cn(
                    "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm", // UIガイドラインに合わせ少し濃いめの背景
                    overlayClassName
                  )}
                  onClick={onClose} // Overlayクリックでも閉じる
                  {...overlayMotionProps}
                />
              </DialogPrimitive.Overlay>
              <DialogPrimitive.Content
                onEscapeKeyDown={onClose} // Radix UIのEscapeキー処理
                aria-labelledby={titleId} // Set aria-labelledby
                aria-describedby={description ? descriptionId : undefined} // Set aria-describedby only if description exists
                className={cn(
                  "fixed inset-0 z-50 flex items-center justify-center p-4", // 中央配置コンテナ
                  dialogContentClassName
                )}
              >
                <motion.div
                  ref={ref}
                  initial={{ opacity: 0, scale: 0.90, y: 20 }} // 少し大きめの開始スケールとYオフセット
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.90, y: 20 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} // カスタムイージングでクールな動き
                  className={cn(
                    "relative bg-card border border-border rounded-xl shadow-2xl", // よりクールな印象のスタイル
                    "w-full max-w-md", // デフォルト幅
                    "max-h-[85vh] flex flex-col", // 高さとレイアウト
                    className
                  )}
                  onClick={(e) => e.stopPropagation()} // モーダル内部のクリックがOverlayに伝播しないように
                  {...contentMotionProps}
                >
                  <div className="flex items-start justify-between px-6 py-5 border-b border-border rounded-t-xl">
                    <div className="space-y-1.5">
                      <DialogPrimitive.Title id={titleId} className="text-xl font-semibold text-foreground">
                        {title}
                      </DialogPrimitive.Title>
                      {description && (
                        <DialogPrimitive.Description id={descriptionId} className="text-sm text-muted-foreground">
                          {description}
                        </DialogPrimitive.Description>
                      )}
                    </div>
                    {showCloseButton && (
                      <DialogPrimitive.Close
                        onClick={onClose}
                        className="-mt-1 -mr-2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background"
                      >
                        <X className="h-5 w-5" />
                        <span className="sr-only">閉じる</span>
                      </DialogPrimitive.Close>
                    )}
                  </div>
                   <div className="flex-1 px-6 py-5 overflow-y-auto"> {/* コンテンツエリア */}
                    {children}
                  </div>
                </motion.div>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          )}
        </AnimatePresence>
      </DialogPrimitive.Root>
    );
  }
);

CustomModal.displayName = "CustomModal";

export { CustomModal };
