'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Delete, Fingerprint } from 'lucide-react';

interface PinLoginProps {
  onSuccess: () => void;
}

export default function PinLogin({ onSuccess }: PinLoginProps) {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [showSetupPrompt, setShowSetupPrompt] = useState(false);
  const [showPinPad, setShowPinPad] = useState(true);

  const checkBiometricsSupport = async () => {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
    try {
      const isAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return !!isAvailable;
    } catch (e) {
      return false;
    }
  };

  const registerBiometrics = async () => {
    try {
      const challenge = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]);
      const userId = new Uint8Array([1, 2, 3, 4]);
      
      const creationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: "FinTrack Expense Tracker",
          id: window.location.hostname,
        },
        user: {
          id: userId,
          name: "user@fintrack",
          displayName: "FinTrack User",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
        timeout: 60000,
      };

      const credential = await navigator.credentials.create({
        publicKey: creationOptions,
      }) as PublicKeyCredential;

      if (credential) {
        const rawId = new Uint8Array(credential.rawId);
        const base64Id = btoa(String.fromCharCode(...rawId));
        localStorage.setItem('biometric_credential_id', base64Id);
        localStorage.removeItem('biometric_setup_declined');
        return true;
      }
      return false;
    } catch (err: any) {
      console.error("Biometric registration failed:", err);
      setError("Biometric registration cancelled or failed.");
      return false;
    }
  };

  const handleBiometricLogin = async () => {
    const base64Id = localStorage.getItem('biometric_credential_id');
    if (!base64Id) return;

    setError(null);
    try {
      const rawId = Uint8Array.from(atob(base64Id), c => c.charCodeAt(0));
      const challenge = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]);

      const requestOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: [
          {
            type: "public-key",
            id: rawId,
          },
        ],
        userVerification: "required",
        timeout: 60000,
      };

      const assertion = await navigator.credentials.get({
        publicKey: requestOptions,
      });

      if (assertion) {
        localStorage.setItem('local_session_active', 'true');
        onSuccess();
      }
    } catch (err: any) {
      console.error("Biometric validation failed:", err);
      // Fallback to PIN pad if verification failed or was canceled
      setShowPinPad(true);
      if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
        setError("Biometric login failed. Please use your PIN.");
      }
    }
  };

  const handleFingerprintButtonClick = async () => {
    const isRegistered = localStorage.getItem('biometric_credential_id');
    if (isRegistered) {
      setShowPinPad(false);
      handleBiometricLogin();
    } else {
      setShowSetupPrompt(true);
    }
  };

  useEffect(() => {
    const checkBiometrics = async () => {
      const available = await checkBiometricsSupport();
      setHasBiometrics(available);
      
      const registered = localStorage.getItem('biometric_credential_id');
      if (available && registered) {
        setShowPinPad(false);
        const timer = setTimeout(() => {
          handleBiometricLogin();
        }, 500);
        return () => clearTimeout(timer);
      } else {
        setShowPinPad(true);
      }
    };
    checkBiometrics();
  }, []);

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      setError(null);
      setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    // If offline, check against cached auth token in localStorage
    if (!navigator.onLine) {
      const cachedPinHash = localStorage.getItem('app_pin_hash');
      if (cachedPinHash) {
        const enteredHash = btoa(pin); 
        if (enteredHash === cachedPinHash) {
          localStorage.setItem('local_session_active', 'true');
          const isSupported = await checkBiometricsSupport();
          const isRegistered = localStorage.getItem('biometric_credential_id');
          const setupDeclined = localStorage.getItem('biometric_setup_declined');
          
          if (isSupported && !isRegistered && !setupDeclined) {
            setShowSetupPrompt(true);
          } else {
            onSuccess();
          }
          setLoading(false);
          return;
        }
      }
      setError('Incorrect PIN (Offline validation failed)');
      setPin('');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      if (res.ok) {
        localStorage.setItem('app_pin_hash', btoa(pin));
        localStorage.setItem('local_session_active', 'true');
        
        const isSupported = await checkBiometricsSupport();
        const isRegistered = localStorage.getItem('biometric_credential_id');
        const setupDeclined = localStorage.getItem('biometric_setup_declined');
        
        if (isSupported && !isRegistered && !setupDeclined) {
          setShowSetupPrompt(true);
        } else {
          onSuccess();
        }
      } else {
        setError('Invalid passcode. Please try again.');
        setPin('');
      }
    } catch (err) {
      setError('Connection error. Please check your network.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pin.length === 4) {
      handleSubmit();
    }
  }, [pin]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0F172A] px-6 text-white select-none">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 translate-x-1/2 translate-y-1/2 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="relative z-10 flex flex-col items-center w-full max-w-sm">
        <AnimatePresence mode="wait">
          {!showPinPad ? (
            <motion.div
              key="biometric-screen"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center w-full text-center"
            >
              {/* Pulsing Fingerprint Icon */}
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleBiometricLogin}
                className="mb-8 cursor-pointer flex h-24 w-24 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[0_0_40px_rgba(59,130,246,0.15)] hover:bg-blue-500/20 hover:border-blue-400/40 hover:shadow-[0_0_50px_rgba(59,130,246,0.25)] transition-all"
              >
                <Fingerprint className="h-12 w-12 animate-pulse" />
              </motion.div>

              <h1 className="mb-2 text-2xl font-bold font-sans tracking-wide">FinTrack is Locked</h1>
              <p className="mb-10 text-sm text-slate-400">Touch the fingerprint sensor to unlock</p>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowPinPad(true)}
                className="px-6 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50 text-sm font-semibold hover:bg-slate-700 hover:text-white transition-all text-slate-300 shadow-md"
              >
                Use PIN Instead
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="pin-screen"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center w-full"
            >
              {/* Lock Icon */}
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
              >
                <Lock className="h-8 w-8" />
              </motion.div>

              <h1 className="mb-2 text-2xl font-bold font-sans tracking-wide">Enter PIN to Unlock</h1>
              <p className="mb-8 text-sm text-slate-400">Please enter your 4-digit passcode</p>

              {/* Passcode dots */}
              <div className="mb-8 flex gap-5">
                {[0, 1, 2, 3].map(index => (
                  <div
                    key={index}
                    className={`h-4 w-4 rounded-full border transition-all duration-200 ${
                      index < pin.length
                        ? 'bg-blue-500 border-blue-500 scale-110 shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                        : 'border-slate-600 bg-transparent'
                    }`}
                  />
                ))}
              </div>

              {/* Smaller biometric button for quick access on PIN pad */}
              {hasBiometrics && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleFingerprintButtonClick}
                  className="mb-8 flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-400 hover:bg-blue-500/20 active:scale-95 transition-all text-xs font-bold shadow-lg shadow-blue-500/5"
                >
                  <Fingerprint className="h-4 w-4" />
                  <span>Use Fingerprint</span>
                </motion.button>
              )}

              {/* Error messages */}
              <div className="h-6 mb-6">
                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-sm font-semibold text-red-500"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-6 w-full px-4 justify-items-center">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    key={num}
                    onClick={() => handleKeyPress(num)}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/80 text-xl font-semibold border border-slate-700/50 hover:bg-slate-700/60 transition-colors"
                  >
                    {num}
                  </motion.button>
                ))}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleClear}
                  className="flex h-16 w-16 items-center justify-center text-sm font-semibold text-slate-400 hover:text-white"
                >
                  Clear
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleKeyPress('0')}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/80 text-xl font-semibold border border-slate-700/50 hover:bg-slate-700/60 transition-colors"
                >
                  0
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDelete}
                  className="flex h-16 w-16 items-center justify-center text-slate-400 hover:text-white"
                >
                  <Delete className="h-6 w-6" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Setup modal */}
      <AnimatePresence>
        {showSetupPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/90 backdrop-blur-md px-6 text-white"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm rounded-2xl bg-slate-800/85 border border-slate-700/60 p-6 text-center shadow-2xl relative"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <Fingerprint className="h-8 w-8 animate-pulse" />
              </div>
              <h2 className="text-xl font-bold mb-2">Enable Fingerprint Login?</h2>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                Use your device's fingerprint or face scanner to unlock your expense tracker quickly next time.
              </p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={async () => {
                    const success = await registerBiometrics();
                    if (success) {
                      onSuccess();
                    } else {
                      onSuccess();
                    }
                  }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 font-bold text-sm shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Enable Fingerprint Unlock
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem('biometric_setup_declined', 'true');
                    onSuccess();
                  }}
                  className="w-full py-3 rounded-xl bg-slate-700/50 hover:bg-slate-700 border border-slate-600/40 font-bold text-sm text-slate-300 transition-all active:scale-[0.98]"
                >
                  Maybe Later
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
