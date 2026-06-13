'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Delete, Fingerprint } from 'lucide-react';

interface PinLoginProps {
  onSuccess: () => void;
}

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
        // Set server session cookie via the auth endpoint using the cached pin hash
        try {
          if (navigator.onLine) {
            const cachedPinHash = localStorage.getItem('app_pin_hash');
            if (cachedPinHash) {
              await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pinHash: cachedPinHash }),
              });
            }
          }
        } catch (e) {
          console.error("Failed to establish server session after biometric login:", e);
        }
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
        const enteredHash = await hashPin(pin);
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
        localStorage.setItem('app_pin_hash', await hashPin(pin));
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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black px-6 text-white select-none">

      <div className="relative z-10 flex flex-col items-center w-full max-w-sm">
        <AnimatePresence mode="wait">
          {!showPinPad ? (
            <motion.div
              key="biometric-screen"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex flex-col items-center w-full text-center"
            >
              {/* Pulsing Fingerprint Icon */}
              <motion.div
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleBiometricLogin}
                className="mb-10 cursor-pointer flex h-24 w-24 items-center justify-center rounded-full bg-[#111111] text-gold-400 border border-gold-400/30 hover:border-gold-400/50 transition-all duration-300"
              >
                <Fingerprint className="h-12 w-12 animate-pulse" />
              </motion.div>

              <h1 className="mb-2 text-2xl font-light tracking-wide text-white">FinTrack is Locked</h1>
              <p className="mb-10 text-sm text-[#8A8A8A] uppercase tracking-wider font-light">Touch the fingerprint sensor to unlock</p>

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setShowPinPad(true)}
                className="px-6 py-2.5 rounded-full bg-[#111111] border border-white/[0.08] text-sm font-medium hover:border-white/[0.16] transition-all duration-200 text-[#8A8A8A] hover:text-white"
              >
                Use PIN Instead
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="pin-screen"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex flex-col items-center w-full"
            >
              {/* Logo */}
              <motion.h1
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="mb-1 text-3xl font-light tracking-wide text-white"
              >
                FinTrack
              </motion.h1>
              <p className="mb-10 text-xs text-[#8A8A8A] uppercase tracking-wider font-light">Enter your passcode</p>

              {/* Passcode dots */}
              <div className="mb-8 flex gap-5">
                {[0, 1, 2, 3].map(index => (
                  <motion.div
                    key={index}
                    animate={index < pin.length ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                    transition={{ duration: 0.15 }}
                    className={`h-3.5 w-3.5 rounded-full border-[1.5px] transition-all duration-200 ${
                      index < pin.length
                        ? 'bg-gold-400 border-gold-400'
                        : 'border-gold-400/40 bg-transparent'
                    }`}
                  />
                ))}
              </div>

              {/* Smaller biometric button for quick access on PIN pad */}
              {hasBiometrics && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handleFingerprintButtonClick}
                  className="mb-8 flex items-center gap-2 px-4 py-2 rounded-full bg-[#111111] border border-white/[0.08] text-gold-400 hover:border-gold-400/30 active:scale-95 transition-all duration-200 text-xs font-medium"
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
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-sm font-medium text-[#FF5A5F]"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-5 w-full px-4 justify-items-center">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                  <motion.button
                    whileTap={{ scale: 0.92, backgroundColor: '#F5C451' }}
                    key={num}
                    onClick={() => handleKeyPress(num)}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-[#111111] text-xl font-medium text-white border border-white/[0.06] hover:border-white/[0.12] active:text-black transition-all duration-150"
                  >
                    {num}
                  </motion.button>
                ))}
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={handleClear}
                  className="flex h-16 w-16 items-center justify-center text-xs font-medium text-[#555555] hover:text-white uppercase tracking-wider transition-colors duration-150"
                >
                  Clear
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.92, backgroundColor: '#F5C451' }}
                  onClick={() => handleKeyPress('0')}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-[#111111] text-xl font-medium text-white border border-white/[0.06] hover:border-white/[0.12] active:text-black transition-all duration-150"
                >
                  0
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={handleDelete}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-[#111111] border border-white/[0.06] text-white hover:border-white/[0.12] transition-all duration-150"
                >
                  <Delete className="h-5 w-5" />
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-6 text-white"
          >
            <motion.div
              initial={{ scale: 0.95, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 16 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="w-full max-w-sm rounded-2xl bg-[#111111] border border-white/[0.06] p-8 text-center relative"
            >
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gold-400/10 text-gold-400 border border-gold-400/20">
                <Fingerprint className="h-8 w-8 animate-pulse" />
              </div>
              <h2 className="text-xl font-medium text-white mb-2">Enable Fingerprint Login?</h2>
              <p className="text-sm text-[#8A8A8A] mb-8 leading-relaxed font-light">
                Use your device's fingerprint or face scanner to unlock your expense tracker quickly next time.
              </p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={async () => {
                    const success = await registerBiometrics();
                    if (success) {
                      setShowSetupPrompt(false);
                      onSuccess();
                    } else {
                      // Registration failed or was cancelled, still let user proceed
                      setShowSetupPrompt(false);
                      onSuccess();
                    }
                  }}
                  className="w-full py-3 rounded-xl bg-gold-400 hover:bg-gold-500 text-black font-medium text-sm transition-all duration-200 hover:scale-[1.01] active:scale-[0.98]"
                >
                  Enable Fingerprint Unlock
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem('biometric_setup_declined', 'true');
                    onSuccess();
                  }}
                  className="w-full py-3 rounded-xl text-sm text-[#8A8A8A] hover:text-white font-medium transition-all duration-200 active:scale-[0.98]"
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
