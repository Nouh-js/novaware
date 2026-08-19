import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { useTheme, ToastContainer, toast } from './lib/toast';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { Customers } from './pages/Customers';
import { Suppliers } from './pages/Suppliers';
import { Sales } from './pages/Sales';
import { POS } from './pages/POS';
import { Services } from './pages/Services';
import { Purchases } from './pages/Purchases';
import { Payments } from './pages/Payments';
import { Reports } from './pages/Reports';
import { AIAssistant } from './pages/AIAssistant';
import { OCRInvoices } from './pages/OCRInvoices';
import { Settings } from './pages/Settings';
import { AuthPage } from './pages/Auth';
import { Archives } from './pages/Archives';
import type { Settings as SettingsType, Notification, Product, Profile } from './lib/types';
import type { Session } from '@supabase/supabase-js';
import { canAccess, defaultPage } from './lib/auth';

export default function App() {
  const { theme, setTheme } = useTheme();

  // ── Auth state ─────────────────────────────────────────────────────────────
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);

  // ── App state ──────────────────────────────────────────────────────────────
  const [page, setPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stockAlerts, setStockAlerts] = useState(0);
  const [salesAlerts] = useState(0);

  // ── Auth setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    // Detect password-reset redirect
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }

    // Hard timeout: never stay stuck on loading screen longer than 5s
    const timeout = setTimeout(() => setAuthLoading(false), 5000);

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) {
        loadProfile(s.user.id).finally(() => { clearTimeout(timeout); setAuthLoading(false); });
      } else {
        clearTimeout(timeout);
        setAuthLoading(false);
      }
    }).catch(() => { clearTimeout(timeout); setAuthLoading(false); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      (async () => {
        setSession(s);
        if (event === 'PASSWORD_RECOVERY') {
          setIsRecovery(true);
          setAuthLoading(false);
          return;
        }
        try {
          if (s) {
            await loadProfile(s.user.id);
          } else {
            setProfile(null);
          }
        } finally {
          setAuthLoading(false);
        }
      })();
    });

    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) setProfile(data as Profile);
  };

  // ── App data ───────────────────────────────────────────────────────────────
  const loadSettings = async () => {
    const { data } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
    if (data) setSettings(data as SettingsType);
  };
  const loadNotifications = async () => {
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
    setNotifications((data as Notification[]) || []);
  };
  const loadAlerts = async () => {
    const { data } = await supabase.from('products').select('stock_qty, min_stock');
    const prods = (data as Pick<Product, 'stock_qty' | 'min_stock'>[]) || [];
    setStockAlerts(prods.filter((p) => p.stock_qty <= p.min_stock).length);
  };

  useEffect(() => {
    if (!session) return;
    loadSettings();
    loadNotifications();
    loadAlerts();
  }, [session]);

  useEffect(() => {
    if (settings?.theme === 'dark') setTheme('dark');
    else if (settings?.theme === 'light') setTheme('light');
  }, [settings?.theme]);

  // ── Role-aware navigation ──────────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return;
    // If current page isn't accessible, redirect to first allowed page
    if (!canAccess(profile.role, page)) {
      setPage(defaultPage(profile.role));
    }
  }, [profile]);

  const navigate = (id: string) => {
    if (!canAccess(profile?.role, id)) {
      toast("Accès non autorisé pour votre rôle", 'error');
      return;
    }
    setPage(id);
    setSearch('');
    window.scrollTo({ top: 0 });
  };

  const markAllRead = async () => {
    await supabase.from('notifications').update({ read: true }).eq('read', false);
    loadNotifications();
    toast('Notifications marquées comme lues');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSettings(null);
    toast('Déconnexion réussie');
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) { toast('Erreur mise à jour du rôle', 'error'); return; }
    await loadProfile(session!.user.id);
    toast('Rôle mis à jour');
  };

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-ink-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-ink-200 border-t-brand-600" />
          <p className="text-sm text-ink-500">Chargement…</p>
        </div>
      </div>
    );
  }

  // ── Auth gates ─────────────────────────────────────────────────────────────
  if (!session || isRecovery) {
    return (
      <>
        <AuthPage onReset={isRecovery} />
        <ToastContainer />
      </>
    );
  }

  // ── Main app ───────────────────────────────────────────────────────────────
  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard onNavigate={navigate} settings={settings} />;
      case 'products': return <Products settings={settings} />;
      case 'customers': return <Customers settings={settings} />;
      case 'suppliers': return <Suppliers settings={settings} />;
      case 'sales': return <Sales settings={settings} onNavigate={navigate} />;
      case 'pos': return <POS settings={settings} />;
      case 'services': return <Services settings={settings} />;
      case 'purchases': return <Purchases settings={settings} />;
      case 'payments': return <Payments settings={settings} />;
      case 'reports': return <Reports settings={settings} />;
      case 'ai': return <AIAssistant settings={settings} onNavigate={navigate} />;
      case 'ocr': return <OCRInvoices settings={settings} />;
      case 'settings': return <Settings settings={settings} onSaved={loadSettings} profile={profile} onRoleChange={handleRoleChange} />;
      case 'archives': return <Archives settings={settings} />;
      default: return <Dashboard onNavigate={navigate} settings={settings} />;
    }
  };

  return (
    <div className="min-h-screen">
      <Sidebar
        current={page}
        onNavigate={navigate}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        stockAlerts={stockAlerts}
        salesAlerts={salesAlerts}
        profile={profile}
        onSignOut={handleSignOut}
      />
      <div className="lg:pl-64">
        <Topbar
          onMenu={() => setSidebarOpen(true)}
          onNavigate={navigate}
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          notifications={notifications}
          onMarkAllRead={markAllRead}
          search={search}
          setSearch={setSearch}
          profile={profile}
          onSignOut={handleSignOut}
        />
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          {renderPage()}
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
