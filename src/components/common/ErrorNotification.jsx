import React, { useEffect } from 'react';

export default function ErrorNotification({ message, type = 'error', onClose, duration = 4000 }) {
  useEffect(() => {
    if (!message) return;

    // 如果沒有設定 duration 或 duration <= 0，則不自動關閉
    if (duration > 0) {
      const timer = setTimeout(() => {
        if (onClose) onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [message, duration, onClose]);

  if (!message) return null;

  // 定義不同類型的樣式 (這裡支援 success, error, warning, info)
  const styles = {
    error: {
      bg: 'bg-rose-500 text-white',
      icon: '❌',
      border: 'border-rose-600',
    },
    warning: {
      bg: 'bg-amber-500 text-white',
      icon: '⚠️',
      border: 'border-amber-600',
    },
    success: {
      bg: 'bg-emerald-500 text-white',
      icon: '✅',
      border: 'border-emerald-600',
    },
    info: {
      bg: 'bg-blue-500 text-white',
      icon: 'ℹ️',
      border: 'border-blue-600',
    }
  };

  const currentStyle = styles[type] || styles.info;

  // 為了區分載入中等狀態，如果 message 裡面已經自帶 Emoji，我們可以選擇隱藏內建 icon
  const hasEmojiPrefix = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(message.charAt(0));

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-[slideUpFade_0.3s_ease-out_forwards]">
      <div className={`flex items-center gap-3 px-5 py-3 rounded-full shadow-xl border ${currentStyle.bg} ${currentStyle.border} max-w-[90vw] md:max-w-md`}>
        {!hasEmojiPrefix && <span>{currentStyle.icon}</span>}
        <span className="font-semibold text-sm whitespace-pre-wrap">{message}</span>
        {onClose && (
          <button 
            type="button" 
            onClick={onClose}
            className="ml-2 hover:opacity-75 transition-opacity bg-black/10 rounded-full w-6 h-6 flex items-center justify-center -mr-2"
          >
            ✕
          </button>
        )}
      </div>

      <style>{`
        @keyframes slideUpFade {
          0% { opacity: 0; transform: translate(-50%, 20px); }
          100% { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}
