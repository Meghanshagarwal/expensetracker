'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowDownToLine, ArrowUpRight, ChartNoAxesColumnIncreasing, ChevronRight, CreditCard, LayoutGrid, Settings2, UsersRound, Volume2, VolumeX, Wallet, X } from 'lucide-react';
import { useInterfaceSound } from './useInterfaceSound';

const destinations = [
  { href: '/', label: 'Overview', icon: LayoutGrid },
  { href: '/cards', label: 'Cards', icon: CreditCard },
  { href: '/people', label: 'People', icon: UsersRound },
  { href: '/salary', label: 'Salary', icon: Wallet },
  { href: '/ipo', label: 'IPO', icon: ChartNoAxesColumnIncreasing },
];

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function Brand() {
  return (
    <Link href="/" aria-label="FinTrack overview" className="brand">
      <img src="/fintrack-mark.svg" width="36" height="36" alt="" />
      <span>FinTrack<span className="brand-period">.</span></span>
    </Link>
  );
}

export default function Navbar() {
  const path = usePathname();
  const { enabled, toggle } = useInterfaceSound();
  const [online, setOnline] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [appleInstall, setAppleInstall] = useState(false);
  const installHelp = useRef<HTMLDialogElement>(null);
  const current = destinations.find(item => item.href === path)?.label ?? 'Settings';

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const installable = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const installed = () => { setInstallPrompt(null); setAppleInstall(false); };
    update();
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setAppleInstall(Boolean(ios && !standalone));
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    window.addEventListener('beforeinstallprompt', installable);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      window.removeEventListener('beforeinstallprompt', installable);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  async function install() {
    if (!installPrompt) { installHelp.current?.showModal(); return; }
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch { /* A dismissed or expired browser prompt can be offered again later. */ }
    setInstallPrompt(null);
  }

  const navigation = (compact: boolean) => destinations.map(({ href, label, icon: Icon }) => {
    const active = path === href;
    return (
      <Link key={href} href={href} className="destination" aria-current={active ? 'page' : undefined}>
        {active && <motion.span className="selected-tab" layoutId={compact ? 'dock-tab' : 'sidebar-tab'} transition={{ type: 'spring', stiffness: 420, damping: 38 }} />}
        <Icon size={19} strokeWidth={1.7} aria-hidden="true" /><span>{label}</span>
        {!compact && active && <span className="nav-pip" aria-hidden="true" />}
      </Link>
    );
  });

  return (
    <>
      <aside className="side-rail">
        <Brand />
        <nav aria-label="Main navigation" className="side-nav">
          <span className="rail-caption">Workspace</span>
          {navigation(false)}
          <div className="rail-rule" />
          <Link href="/settings" className="destination" aria-current={path === '/settings' ? 'page' : undefined}>
            <Settings2 size={19} strokeWidth={1.7} /><span>Settings</span>
          </Link>
        </nav>
        <div className="rail-foot"><span className={online ? 'status-dot' : 'status-dot is-offline'} />{online ? 'Online' : 'Offline mode'}</div>
      </aside>
      <header className="workspace-bar">
        <div className="mobile-brand"><Brand /></div>
        <div className="breadcrumbs"><LayoutGrid size={15} /><span>Workspace</span><ChevronRight size={13} /><strong>{current}</strong></div>
        <div className="bar-tools">
          {(installPrompt || appleInstall) && <button className="tool-button install-button" type="button" onClick={install} aria-label="Install FinTrack" title="Install FinTrack"><ArrowDownToLine size={17} /><span>Install app</span></button>}
          <button className="tool-button sound-button" type="button" data-sound-toggle aria-label="Interface sounds" aria-pressed={enabled} title={enabled ? 'Mute interface sounds' : 'Enable interface sounds'} onClick={toggle}>
            {enabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
            <span>{enabled ? 'Sound on' : 'Sound off'}</span>
          </button>
          <Link className="tool-button mobile-settings" href="/settings" aria-label="Settings" aria-current={path === '/settings' ? 'page' : undefined}><Settings2 size={19} /></Link>
        </div>
      </header>
      <nav aria-label="Mobile navigation" className="mobile-dock">{navigation(true)}</nav>
      <dialog ref={installHelp} aria-labelledby="install-title" className="install-dialog">
        <form method="dialog"><button className="tool-button" autoFocus aria-label="Close install instructions"><X size={18} /></button></form>
        <ArrowUpRight size={24} aria-hidden="true" />
        <h2 id="install-title">Install FinTrack</h2>
        <p>Open this page in Safari, tap Share, then choose Add to Home Screen.</p>
      </dialog>
    </>
  );
}
