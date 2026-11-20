'use client';

import { useEffect, useRef, useState } from 'react';

const preferenceKey = 'fintrack.feedback.sound';

export function useInterfaceSound() {
  const [enabled, setEnabled] = useState(false);
  const audio = useRef<AudioContext | null>(null);

  function play(tone: 'switch' | 'navigate' | 'tap') {
    try {
      const Audio = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Audio) return;
      const ctx = audio.current ?? (audio.current = new Audio());
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
      const pitches = tone === 'switch' ? [523.25, 783.99] : tone === 'navigate' ? [659.25] : [493.88];
      pitches.forEach((frequency, index) => {
        const start = ctx.currentTime + index * 0.045;
        const oscillator = ctx.createOscillator();
        const envelope = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, start);
        envelope.gain.setValueAtTime(0.0001, start);
        envelope.gain.exponentialRampToValueAtTime(0.045, start + 0.009);
        envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.115);
        oscillator.connect(envelope);
        envelope.connect(ctx.destination);
        oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
        oscillator.start(start);
        oscillator.stop(start + 0.12);
      });
    } catch { /* Audio can be unavailable in silent or restricted browsing modes. */ }
  }

  useEffect(() => {
    try { setEnabled(localStorage.getItem(preferenceKey) === 'on'); } catch {}
    return () => { if (audio.current) void audio.current.close().catch(() => {}); audio.current = null; };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    function onClick(event: MouseEvent) {
      if (!event.isTrusted || !(event.target instanceof Element)) return;
      const control = event.target.closest('button, a[href]');
      if (!control || control.matches(':disabled, [aria-disabled="true"], [data-sound-toggle]')) return;
      play(control.tagName === 'A' ? 'navigate' : 'tap');
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [enabled]);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    try { localStorage.setItem(preferenceKey, next ? 'on' : 'off'); } catch {}
    if (next) play('switch');
  };
  return { enabled, toggle };
}
