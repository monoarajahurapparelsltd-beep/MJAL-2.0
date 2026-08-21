import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share2, PlusSquare, Factory, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { ModalPortal } from './ModalPortal';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, triggerInstall } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    return sessionStorage.getItem('pwa_banner_dismissed') === 'true';
  });
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  // If already running in PWA standalone or permanently dismissed for this session
  if (isInstalled || (isDismissed && !showIOSGuide)) {
    return null;
  }

  // Show banner if native prompt is available OR if on mobile iOS
  const shouldShow = isInstallable || (isIOS && !isDismissed);

  if (!shouldShow) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    setIsInstalling(true);
    try {
      const accepted = await triggerInstall();
      if (accepted) {
        setInstallSuccess(true);
        setTimeout(() => setInstallSuccess(false), 4000);
      }
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
  };

  return (
    <>
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white border-b border-blue-500/30 px-3 py-2 sm:py-2.5 shadow-md flex items-center justify-between gap-3 text-xs animate-fade-in relative z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0 shadow-inner">
            <Smartphone className="w-4 h-4 text-blue-300 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-black text-xs text-white truncate font-sans">
                Install MJAL ERP App
              </span>
              <span className="bg-blue-500/30 text-blue-200 text-[9px] font-extrabold px-1.5 py-0.2 rounded border border-blue-400/30 uppercase tracking-wider hidden xs:inline-block">
                Mobile PWA
              </span>
            </div>
            <p className="text-[10px] text-slate-300 truncate">
              {isIOS
                ? 'মোবাইলে সহজে চালাতে হোম স্ক্রিনে ইন্সটল করুন'
                : 'Install as app for faster access, offline mode & native experience'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            disabled={isInstalling}
            className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold rounded-lg text-xs shadow-sm shadow-blue-500/20 flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
          >
            {installSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                <span>Installed!</span>
              </>
            ) : isIOS ? (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>Install Guide</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>{isInstalling ? 'Installing...' : 'Install App'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* iOS Installation Instruction Modal */}
      {showIOSGuide && (
        <ModalPortal
          isOpen={showIOSGuide}
          onClose={() => setShowIOSGuide(false)}
          title="Install on iPhone / iPad (iOS)"
          subtitle="Add Monoara Jahur Apparels Ltd ERP to your Home Screen"
          maxWidth="md"
          headerGradient={true}
          headerIcon={<Smartphone className="w-5 h-5 text-blue-300" />}
        >
          <div className="space-y-4 text-xs text-slate-700 dark:text-slate-200">
            <p className="font-medium text-slate-600 dark:text-slate-300">
              Follow these 3 quick steps in Safari to install MJAL ERP on your home screen:
            </p>

            <div className="space-y-3 bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white font-black shrink-0 text-xs shadow-xs">
                  1
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">Tap the Share button</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                    Tap the <Share2 className="w-3.5 h-3.5 text-blue-500" /> Share icon at the bottom of your Safari browser bar.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white font-black shrink-0 text-xs shadow-xs">
                  2
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">Select "Add to Home Screen"</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                    Scroll down and tap <PlusSquare className="w-3.5 h-3.5 text-blue-500" /> <strong>Add to Home Screen</strong> (হোম স্ক্রিনে যোগ করুন).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white font-black shrink-0 text-xs shadow-xs">
                  3
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">Tap "Add" in Top Right Corner</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Tap <strong>Add</strong> to create the MJAL ERP app icon on your home screen.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs"
              >
                Got it (বুঝেছি)
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
};
