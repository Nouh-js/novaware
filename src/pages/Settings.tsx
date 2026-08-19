import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, Spinner, Badge } from '../components/ui';
import { toast } from '../lib/toast';
import {
  Building2,
  Percent,
  Coins,
  Hash,
  Palette,
  Shield,
  Database,
  Save,
  Bell,
  Globe,
  Users,
  ChevronDown,
  Upload,
  X,
  FileText,
  Landmark,
  Stamp,
  PenLine,
  Check,
  ChevronRight,
} from 'lucide-react';
import type { Settings as SettingsType } from '../lib/types';
import type { Profile } from '../lib/types';
import { ROLE_LABELS, ROLE_COLORS, type UserRole } from '../lib/auth';

// ─── Document template definitions ────────────────────────────────────────────

type DocTemplate = {
  id: string;
  name: string;
  description: string;
  preview: (company: Partial<SettingsType>) => string;
};

const DOC_TEMPLATES: DocTemplate[] = [
  {
    id: 'classic',
    name: 'Classique',
    description: 'En-tête sobre avec logo à gauche et infos document à droite',
    preview: (c) => `
      <div style="font-family:Inter,sans-serif;font-size:11px;padding:16px;border-radius:8px;border:1px solid #e5e7eb">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:2px solid #3b82f6">
          <div style="display:flex;align-items:center;gap:10px">
            ${c.company_logo ? `<img src="${c.company_logo}" style="height:36px;width:auto;object-fit:contain" />` : `<div style="width:36px;height:36px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:700">${(c.company_name || 'E').charAt(0)}</div>`}
            <div>
              <div style="font-size:14px;font-weight:700;color:#1e40af">${c.company_name || 'Mon Entreprise'}</div>
              <div style="color:#6b7280;font-size:10px">${c.company_email || 'contact@entreprise.ma'}</div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:18px;font-weight:700;text-transform:uppercase;color:#1e40af">FACTURE</div>
            <div style="color:#9ca3af;font-size:10px">N° FAC-2026-0001</div>
          </div>
        </div>
        ${c.company_rc || c.company_ice ? `<div style="display:flex;gap:12px;margin-top:8px;flex-wrap:wrap">${c.company_rc ? `<span style="font-size:9px;color:#6b7280">RC: ${c.company_rc}</span>` : ''}${c.company_ice ? `<span style="font-size:9px;color:#6b7280">ICE: ${c.company_ice}</span>` : ''}${c.company_if ? `<span style="font-size:9px;color:#6b7280">IF: ${c.company_if}</span>` : ''}</div>` : ''}
      </div>`,
  },
  {
    id: 'modern',
    name: 'Moderne',
    description: 'Bandeau coloré en haut avec logo centré, design épuré',
    preview: (c) => `
      <div style="font-family:Inter,sans-serif;font-size:11px;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden">
        <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:16px;display:flex;justify-content:space-between;align-items:center">
          <div style="display:flex;align-items:center;gap:10px">
            ${c.company_logo ? `<img src="${c.company_logo}" style="height:36px;width:auto;object-fit:contain;background:#fff;padding:3px;border-radius:6px" />` : `<div style="width:36px;height:36px;background:rgba(255,255,255,0.2);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:700">${(c.company_name || 'E').charAt(0)}</div>`}
            <div>
              <div style="font-size:14px;font-weight:700;color:#fff">${c.company_name || 'Mon Entreprise'}</div>
              <div style="color:rgba(255,255,255,0.7);font-size:10px">${c.company_address || 'Adresse de la société'}</div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:18px;font-weight:700;text-transform:uppercase;color:#fff">FACTURE</div>
            <div style="background:rgba(255,255,255,0.2);color:#fff;border-radius:4px;padding:2px 8px;font-size:10px;margin-top:3px">N° FAC-2026-0001</div>
          </div>
        </div>
        ${c.company_rc || c.company_ice ? `<div style="display:flex;gap:12px;padding:6px 16px;background:#f8fafc;flex-wrap:wrap">${c.company_rc ? `<span style="font-size:9px;color:#6b7280">RC: ${c.company_rc}</span>` : ''}${c.company_ice ? `<span style="font-size:9px;color:#6b7280">ICE: ${c.company_ice}</span>` : ''}${c.company_if ? `<span style="font-size:9px;color:#6b7280">IF: ${c.company_if}</span>` : ''}</div>` : ''}
      </div>`,
  },
  {
    id: 'minimal',
    name: 'Minimaliste',
    description: 'Typographie fine, ligne de séparation discrète, très professionnel',
    preview: (c) => `
      <div style="font-family:Inter,sans-serif;font-size:11px;padding:16px;border-radius:8px;border:1px solid #e5e7eb">
        <div style="display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:10px;border-bottom:1px solid #e5e7eb">
          <div>
            ${c.company_logo ? `<img src="${c.company_logo}" style="height:28px;width:auto;object-fit:contain;margin-bottom:4px" />` : ''}
            <div style="font-size:15px;font-weight:700;letter-spacing:-0.02em">${c.company_name || 'Mon Entreprise'}</div>
            <div style="color:#9ca3af;font-size:10px;margin-top:2px">${[c.company_address, c.company_email, c.company_phone].filter(Boolean).join(' · ')}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af">Facture</div>
            <div style="font-size:16px;font-weight:700;color:#111827">FAC-2026-0001</div>
          </div>
        </div>
        ${c.company_rc || c.company_ice ? `<div style="display:flex;gap:12px;margin-top:6px;flex-wrap:wrap">${c.company_rc ? `<span style="font-size:9px;color:#9ca3af">RC ${c.company_rc}</span>` : ''}${c.company_ice ? `<span style="font-size:9px;color:#9ca3af">ICE ${c.company_ice}</span>` : ''}${c.company_if ? `<span style="font-size:9px;color:#9ca3af">IF ${c.company_if}</span>` : ''}</div>` : ''}
      </div>`,
  },
  {
    id: 'elegant',
    name: 'Élégant',
    description: 'Accent doré, mise en page luxueuse pour grandes entreprises',
    preview: (c) => `
      <div style="font-family:Georgia,serif;font-size:11px;padding:16px;border-radius:8px;border:2px solid #d97706">
        <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;border-bottom:1px solid #fde68a">
          <div style="display:flex;align-items:center;gap:12px">
            ${c.company_logo ? `<img src="${c.company_logo}" style="height:40px;width:auto;object-fit:contain" />` : `<div style="width:40px;height:40px;background:linear-gradient(135deg,#d97706,#f59e0b);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:15px;font-weight:700">${(c.company_name || 'E').charAt(0)}</div>`}
            <div>
              <div style="font-size:16px;font-weight:700;color:#92400e;letter-spacing:0.02em">${c.company_name || 'Mon Entreprise'}</div>
              <div style="color:#b45309;font-size:10px">${c.company_email || ''}</div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.15em;color:#b45309">Facture Commerciale</div>
            <div style="font-size:18px;font-weight:700;color:#78350f">FAC-2026-0001</div>
          </div>
        </div>
        ${c.company_rc || c.company_ice ? `<div style="display:flex;gap:12px;margin-top:6px;flex-wrap:wrap">${c.company_rc ? `<span style="font-size:9px;color:#b45309">RC: ${c.company_rc}</span>` : ''}${c.company_ice ? `<span style="font-size:9px;color:#b45309">ICE: ${c.company_ice}</span>` : ''}${c.company_if ? `<span style="font-size:9px;color:#b45309">IF: ${c.company_if}</span>` : ''}</div>` : ''}
      </div>`,
  },
  {
    id: 'dark',
    name: 'Sombre',
    description: 'Fond sombre, typographie claire, style premium et moderne',
    preview: (c) => `
      <div style="font-family:Inter,sans-serif;font-size:11px;border-radius:8px;border:1px solid #374151;overflow:hidden">
        <div style="background:#111827;padding:16px;display:flex;justify-content:space-between;align-items:flex-start">
          <div style="display:flex;align-items:center;gap:10px">
            ${c.company_logo ? `<img src="${c.company_logo}" style="height:36px;width:auto;object-fit:contain;filter:brightness(0) invert(1)" />` : `<div style="width:36px;height:36px;background:#3b82f6;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:700">${(c.company_name || 'E').charAt(0)}</div>`}
            <div>
              <div style="font-size:14px;font-weight:700;color:#f9fafb">${c.company_name || 'Mon Entreprise'}</div>
              <div style="color:#9ca3af;font-size:10px">${c.company_address || ''}</div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:18px;font-weight:700;color:#3b82f6">FACTURE</div>
            <div style="color:#6b7280;font-size:10px">FAC-2026-0001</div>
          </div>
        </div>
        ${c.company_rc || c.company_ice ? `<div style="display:flex;gap:12px;padding:5px 16px;background:#1f2937;flex-wrap:wrap">${c.company_rc ? `<span style="font-size:9px;color:#9ca3af">RC: ${c.company_rc}</span>` : ''}${c.company_ice ? `<span style="font-size:9px;color:#9ca3af">ICE: ${c.company_ice}</span>` : ''}${c.company_if ? `<span style="font-size:9px;color:#9ca3af">IF: ${c.company_if}</span>` : ''}</div>` : ''}
      </div>`,
  },
];

// ─── Logo upload helper ────────────────────────────────────────────────────────

function LogoUploader({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) { toast('Format non supporté', 'error'); return; }
    if (f.size > 2 * 1024 * 1024) { toast('Image trop volumineuse (max 2 MB)', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (e) => onChange(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  return (
    <div className="space-y-2">
      <label className="label">Logo de l'entreprise</label>
      <div className="flex items-start gap-4">
        <div
          className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-ink-200 bg-ink-50 dark:border-ink-700 dark:bg-ink-800"
        >
          {value ? (
            <img src={value} alt="Logo" className="h-full w-full object-contain p-1" />
          ) : (
            <Building2 size={28} className="text-ink-300" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="btn-secondary text-xs"
            >
              <Upload size={13} /> Téléverser
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-950/20"
              >
                <X size={13} /> Supprimer
              </button>
            )}
          </div>
          <p className="text-xs text-ink-400">PNG, SVG, JPG — max 2 MB. Le logo apparaîtra sur tous vos documents.</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
          />
        </div>
      </div>
      {/* URL input as alternative */}
      <input
        className="input mt-1 text-xs"
        placeholder="Ou collez une URL d'image…"
        value={value?.startsWith('http') ? value : ''}
        onChange={(e) => onChange(e.target.value || null)}
      />
    </div>
  );
}

// ─── Image upload helper for signature / stamp ─────────────────────────────────

function ImageUploader({
  label,
  value,
  onChange,
  icon,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  icon: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => onChange(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  return (
    <div className="flex items-start gap-3 rounded-xl border border-ink-100 p-3 dark:border-ink-800">
      <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-ink-200 bg-ink-50/60 dark:border-ink-700 dark:bg-ink-800">
        {value ? (
          <img src={value} alt={label} className="h-full w-full object-contain p-1" />
        ) : (
          <div className="text-ink-300">{icon}</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-ink-700 dark:text-ink-200">{label}</div>
        <p className="mt-0.5 text-[11px] text-ink-400">PNG transparent recommandé</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-ink-200 px-2 py-1 text-xs font-medium text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800"
          >
            <Upload size={11} className="inline mr-1" />Téléverser
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded-lg px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              <X size={11} className="inline" />
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
      </div>
    </div>
  );
}

// ─── Company tab ───────────────────────────────────────────────────────────────

function CompanyTab({ form, set }: { form: Partial<SettingsType>; set: (k: keyof SettingsType, v: any) => void }) {
  const [section, setSection] = useState<'identity' | 'legal' | 'bank' | 'stamps'>('identity');

  const sections = [
    { id: 'identity' as const, label: 'Identité', icon: Building2 },
    { id: 'legal' as const, label: 'Identifiants légaux', icon: FileText },
    { id: 'bank' as const, label: 'Coordonnées bancaires', icon: Landmark },
    { id: 'stamps' as const, label: 'Signature & cachet', icon: Stamp },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display font-semibold">Informations société</h3>
        <p className="text-sm text-ink-500">Apparaîtront automatiquement sur tous vos documents commerciaux</p>
      </div>

      {/* Sub-nav */}
      <div className="flex flex-wrap gap-1 rounded-xl bg-ink-50 p-1 dark:bg-ink-800/50">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              section === s.id
                ? 'bg-white text-ink-800 shadow-soft dark:bg-ink-700 dark:text-ink-100'
                : 'text-ink-500 hover:text-ink-700 dark:hover:text-ink-300'
            }`}
          >
            <s.icon size={13} /> {s.label}
          </button>
        ))}
      </div>

      {/* Section: Identity */}
      {section === 'identity' && (
        <div className="space-y-4">
          <LogoUploader value={form.company_logo ?? null} onChange={(v) => set('company_logo', v)} />
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Raison sociale *</label>
              <input className="input" value={form.company_name || ''} onChange={(e) => set('company_name', e.target.value)} />
            </div>
            <div>
              <label className="label">E-mail</label>
              <input className="input" type="email" value={form.company_email || ''} onChange={(e) => set('company_email', e.target.value)} />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input className="input" type="tel" value={form.company_phone || ''} onChange={(e) => set('company_phone', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Adresse</label>
              <textarea className="input resize-none" rows={2} value={form.company_address || ''} onChange={(e) => set('company_address', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Site web</label>
              <input className="input" type="url" placeholder="https://…" value={form.company_website || ''} onChange={(e) => set('company_website', e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Section: Legal IDs */}
      {section === 'legal' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-300">
            Ces identifiants apparaissent sur chaque document commercial conforme à la réglementation marocaine.
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">RC — Registre de Commerce</label>
              <input className="input font-mono" placeholder="ex: 123456" value={form.company_rc || ''} onChange={(e) => set('company_rc', e.target.value)} />
            </div>
            <div>
              <label className="label">ICE — Identifiant Commun de l'Entreprise</label>
              <input className="input font-mono" placeholder="15 chiffres" maxLength={15} value={form.company_ice || ''} onChange={(e) => set('company_ice', e.target.value)} />
            </div>
            <div>
              <label className="label">IF — Identifiant Fiscal</label>
              <input className="input font-mono" placeholder="ex: 12345678" value={form.company_if || ''} onChange={(e) => set('company_if', e.target.value)} />
            </div>
            <div>
              <label className="label">Patente — Taxe professionnelle</label>
              <input className="input font-mono" placeholder="ex: 12345678" value={form.company_patente || ''} onChange={(e) => set('company_patente', e.target.value)} />
            </div>
            <div>
              <label className="label">CNSS <span className="text-ink-400 font-normal">(optionnel)</span></label>
              <input className="input font-mono" placeholder="Numéro affiliation" value={form.company_cnss || ''} onChange={(e) => set('company_cnss', e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Section: Bank */}
      {section === 'bank' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Nom de la banque</label>
              <input className="input" placeholder="ex: Attijariwafa Bank" value={form.company_bank_name || ''} onChange={(e) => set('company_bank_name', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">RIB</label>
              <input className="input font-mono tracking-wider" placeholder="24 chiffres" maxLength={24} value={form.company_rib || ''} onChange={(e) => set('company_rib', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">IBAN <span className="text-ink-400 font-normal">(optionnel)</span></label>
              <input className="input font-mono uppercase tracking-wider" placeholder="ex: MA64 …" value={form.company_iban || ''} onChange={(e) => set('company_iban', e.target.value.toUpperCase())} />
            </div>
          </div>
          <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-3 text-xs text-ink-500 dark:border-ink-800 dark:bg-ink-800/30">
            Les coordonnées bancaires apparaissent en pied de page des factures et devis pour faciliter le règlement.
          </div>
        </div>
      )}

      {/* Section: Signature & Stamp */}
      {section === 'stamps' && (
        <div className="space-y-3">
          <p className="text-sm text-ink-500">
            Téléversez la signature et le cachet de votre entreprise. Ils seront apposés automatiquement sur les documents validés.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <ImageUploader
              label="Signature"
              value={form.company_signature ?? null}
              onChange={(v) => set('company_signature', v)}
              icon={<PenLine size={22} />}
            />
            <ImageUploader
              label="Cachet / Tampon"
              value={form.company_stamp ?? null}
              onChange={(v) => set('company_stamp', v)}
              icon={<Stamp size={22} />}
            />
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/40 px-4 py-3 text-xs text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
            Utilisez des images PNG avec fond transparent pour un rendu optimal sur les documents imprimés.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Document templates tab ────────────────────────────────────────────────────

function TemplatesTab({ form, set }: { form: Partial<SettingsType>; set: (k: keyof SettingsType, v: any) => void }) {
  const current = form.doc_template || 'classic';

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display font-semibold">Templates des documents commerciaux</h3>
        <p className="text-sm text-ink-500">
          Choisissez le modèle d'en-tête appliqué à tous vos devis, factures, bons de commande et bons de livraison.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DOC_TEMPLATES.map((tpl) => {
          const active = current === tpl.id;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => set('doc_template', tpl.id)}
              className={`group relative rounded-xl border-2 p-3 text-left transition ${
                active
                  ? 'border-brand-500 bg-brand-50/30 dark:bg-brand-950/20'
                  : 'border-ink-100 hover:border-brand-300 dark:border-ink-800 dark:hover:border-brand-700'
              }`}
            >
              {active && (
                <div className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Check size={11} />
                </div>
              )}
              <div
                className="mb-3 overflow-hidden rounded-lg"
                dangerouslySetInnerHTML={{ __html: tpl.preview(form) }}
              />
              <div className="font-semibold text-sm text-ink-800 dark:text-ink-100">{tpl.name}</div>
              <div className="mt-0.5 text-xs text-ink-400">{tpl.description}</div>
              {active && (
                <div className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400">
                  <Check size={11} /> Template actif
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-4 dark:border-ink-800 dark:bg-ink-800/30">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-700 dark:text-ink-200">
          <FileText size={14} /> Prévisualisation complète — {DOC_TEMPLATES.find((t) => t.id === current)?.name}
        </div>
        <div
          className="overflow-hidden rounded-lg"
          dangerouslySetInnerHTML={{ __html: DOC_TEMPLATES.find((t) => t.id === current)?.preview(form) || '' }}
        />
        <p className="mt-3 text-xs text-ink-400">
          La prévisualisation utilise vos informations société actuelles. Enregistrez vos modifications pour mettre à jour l'aperçu.
        </p>
      </div>
    </div>
  );
}

// ─── Main Settings page ────────────────────────────────────────────────────────

export function Settings({
  settings,
  onSaved,
  profile,
  onRoleChange,
}: {
  settings: SettingsType | null;
  onSaved: () => void;
  profile: Profile | null;
  onRoleChange: (userId: string, role: string) => void;
}) {
  const [form, setForm] = useState<Partial<SettingsType>>(settings || {});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('company');
  const [users, setUsers] = useState<Profile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [changingRole, setChangingRole] = useState<string | null>(null);

  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  useEffect(() => {
    if (tab === 'users' && profile?.role === 'admin') loadUsers();
  }, [tab, profile]);

  const loadUsers = async () => {
    setUsersLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
    setUsers((data as Profile[]) || []);
    setUsersLoading(false);
  };

  const set = (k: keyof SettingsType, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('settings').update(form).eq('id', 1);
    setSaving(false);
    if (error) { toast('Erreur de sauvegarde', 'error'); return; }
    toast('Paramètres enregistrés');
    onSaved();
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setChangingRole(userId);
    await onRoleChange(userId, newRole);
    await loadUsers();
    setChangingRole(null);
  };

  const isAdmin = profile?.role === 'admin';

  const tabs = [
    { id: 'company', label: 'Société', icon: Building2 },
    { id: 'templates', label: 'Templates documents', icon: FileText },
    { id: 'taxes', label: 'Taxes & TVA', icon: Percent },
    { id: 'currency', label: 'Devises', icon: Coins },
    { id: 'numbering', label: 'Numérotation', icon: Hash },
    { id: 'appearance', label: 'Apparence', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Sécurité', icon: Shield },
    ...(isAdmin ? [{ id: 'users', label: 'Utilisateurs', icon: Users }] : []),
    { id: 'api', label: 'API & Intégrations', icon: Database },
  ];

  const roles: UserRole[] = ['admin', 'manager', 'sales', 'accountant', 'cashier', 'warehouse'];

  const showSaveBtn = tab !== 'users';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Paramètres</h1>
          <p className="mt-1 text-sm text-ink-500">Configuration de votre espace ERP</p>
        </div>
        {showSaveBtn && (
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? <Spinner /> : <Save size={15} />} Enregistrer
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Sidebar nav */}
        <Card padding={false} className="lg:col-span-1">
          <div className="p-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  tab === t.id
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
                    : 'text-ink-600 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-800'
                }`}
              >
                <t.icon size={16} /> {t.label}
                {(t.id === 'company' || t.id === 'templates') && (
                  <ChevronRight size={13} className="ml-auto text-ink-300" />
                )}
              </button>
            ))}
          </div>
        </Card>

        {/* Content */}
        <div className="lg:col-span-3">
          <Card>
            {tab === 'company' && <CompanyTab form={form} set={set} />}

            {tab === 'templates' && <TemplatesTab form={form} set={set} />}

            {tab === 'taxes' && (
              <div className="space-y-4">
                <div><h3 className="font-display font-semibold">Taxes & TVA</h3></div>
                <div>
                  <label className="label">Taux de TVA par défaut (%)</label>
                  <input type="number" step="0.01" className="input" value={form.default_tax_rate ?? 20} onChange={(e) => set('default_tax_rate', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="rounded-lg bg-ink-50 p-3 dark:bg-ink-800/50">
                  <div className="text-sm font-medium">Taux de TVA configurés</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone="brand">20% — Normal</Badge>
                    <Badge tone="neutral">14% — Intermédiaire</Badge>
                    <Badge tone="neutral">10% — Réduit</Badge>
                    <Badge tone="neutral">7% — Super réduit</Badge>
                    <Badge tone="success">0% — Exonéré</Badge>
                  </div>
                </div>
              </div>
            )}

            {tab === 'currency' && (
              <div className="space-y-4">
                <div><h3 className="font-display font-semibold">Devises & Langues</h3></div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Devise</label>
                    <select className="input" value={form.currency || 'MAD'} onChange={(e) => set('currency', e.target.value)}>
                      <option value="MAD">Dirham marocain (MAD)</option>
                      <option value="EUR">Euro (EUR)</option>
                      <option value="USD">Dollar (USD)</option>
                      <option value="GBP">Livre (GBP)</option>
                      <option value="XOF">Franc CFA (XOF)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Symbole</label>
                    <input className="input" value={form.currency_symbol || ''} onChange={(e) => set('currency_symbol', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Langue</label>
                    <select className="input" value={form.language || 'fr'} onChange={(e) => set('language', e.target.value)}>
                      <option value="fr">Français</option>
                      <option value="en">English</option>
                      <option value="ar">العربية</option>
                    </select>
                  </div>
                </div>
                <div className="rounded-lg bg-ink-50 p-3 dark:bg-ink-800/50">
                  <div className="flex items-center gap-2 text-sm"><Globe size={14} /> Taux de change (indicatifs)</div>
                  <div className="mt-2 space-y-1 text-xs text-ink-500">
                    <div className="flex justify-between"><span>1 EUR</span><span>10.85 MAD</span></div>
                    <div className="flex justify-between"><span>1 USD</span><span>10.02 MAD</span></div>
                    <div className="flex justify-between"><span>1 GBP</span><span>12.71 MAD</span></div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'numbering' && (
              <div className="space-y-4">
                <div><h3 className="font-display font-semibold">Numérotation automatique</h3></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Préfixe factures</label><input className="input" value={form.invoice_prefix || ''} onChange={(e) => set('invoice_prefix', e.target.value)} /></div>
                  <div><label className="label">Préfixe devis</label><input className="input" value={form.quote_prefix || ''} onChange={(e) => set('quote_prefix', e.target.value)} /></div>
                  <div><label className="label">Préfixe commandes</label><input className="input" value={form.order_prefix || ''} onChange={(e) => set('order_prefix', e.target.value)} /></div>
                  <div><label className="label">Préfixe livraisons</label><input className="input" value={form.delivery_prefix || ''} onChange={(e) => set('delivery_prefix', e.target.value)} /></div>
                  <div><label className="label">Préfixe paiements</label><input className="input" value={form.payment_prefix || ''} onChange={(e) => set('payment_prefix', e.target.value)} /></div>
                </div>
                <div className="rounded-lg bg-ink-50 p-3 text-sm dark:bg-ink-800/50">
                  Format: <span className="font-mono font-medium">{form.invoice_prefix}-2026-0001</span>
                </div>
              </div>
            )}

            {tab === 'appearance' && (
              <div className="space-y-4">
                <div><h3 className="font-display font-semibold">Apparence</h3></div>
                <div>
                  <label className="label">Thème</label>
                  <select className="input" value={form.theme || 'light'} onChange={(e) => set('theme', e.target.value)}>
                    <option value="light">Clair</option>
                    <option value="dark">Sombre</option>
                    <option value="system">Système</option>
                  </select>
                </div>
              </div>
            )}

            {tab === 'notifications' && (
              <div className="space-y-3">
                <div><h3 className="font-display font-semibold">Alertes & notifications</h3></div>
                {[
                  { label: 'Stock faible', desc: 'Alerte quand le stock atteint le minimum', on: true },
                  { label: 'Paiements en retard', desc: 'Relance automatique des factures impayées', on: true },
                  { label: 'Péremption produits', desc: 'Alerte avant date de péremption', on: false },
                  { label: 'Nouveaux abonnements', desc: 'Notification SaaS', on: true },
                ].map((n) => (
                  <div key={n.label} className="flex items-center justify-between rounded-lg border border-ink-100 p-3 dark:border-ink-800">
                    <div><div className="text-sm font-medium">{n.label}</div><div className="text-xs text-ink-500">{n.desc}</div></div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input type="checkbox" defaultChecked={n.on} className="peer sr-only" />
                      <div className="h-6 w-11 rounded-full bg-ink-200 transition peer-checked:bg-brand-600 dark:bg-ink-700" />
                      <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" />
                    </label>
                  </div>
                ))}
              </div>
            )}

            {tab === 'security' && (
              <div className="space-y-4">
                <div><h3 className="font-display font-semibold">Sécurité & Rôles</h3></div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { role: 'Administrateur', perms: 'Tous droits', tone: 'danger' as const },
                    { role: 'Manager', perms: 'Gestion complète', tone: 'brand' as const },
                    { role: 'Commercial', perms: 'Ventes & clients', tone: 'success' as const },
                    { role: 'Comptable', perms: 'Finance & rapports', tone: 'warning' as const },
                    { role: 'Caissier', perms: 'POS uniquement', tone: 'neutral' as const },
                    { role: 'Magasinier', perms: 'Stock & inventaire', tone: 'neutral' as const },
                  ].map((r) => (
                    <div key={r.role} className="rounded-lg border border-ink-100 p-3 dark:border-ink-800">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{r.role}</span>
                        <Badge tone={r.tone}>{r.perms}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'users' && isAdmin && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-display font-semibold">Gestion des utilisateurs</h3>
                  <p className="text-sm text-ink-500">Gérez les comptes et les rôles de votre équipe</p>
                </div>
                {usersLoading ? (
                  <div className="flex justify-center py-8"><Spinner /></div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-ink-100 dark:border-ink-800">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-ink-100 bg-ink-50 dark:border-ink-800 dark:bg-ink-800/50">
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-400">Utilisateur</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-400">Rôle</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-400">Membre depuis</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u.id} className="border-b border-ink-50 last:border-0 dark:border-ink-800/50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white">
                                  {(u.full_name || u.id).split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                                </div>
                                <div>
                                  <div className="font-medium text-ink-800 dark:text-ink-100">{u.full_name || 'Sans nom'}</div>
                                  {u.id === profile?.id && <span className="text-[10px] text-ink-400">Vous</span>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${ROLE_COLORS[u.role]}`}>
                                {ROLE_LABELS[u.role]}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-ink-500">
                              {new Date(u.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {u.id === profile?.id ? (
                                <span className="text-xs text-ink-400">—</span>
                              ) : (
                                <div className="relative inline-block">
                                  <select
                                    value={u.role}
                                    disabled={changingRole === u.id}
                                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                    className="appearance-none rounded-lg border border-ink-200 bg-white py-1.5 pl-3 pr-7 text-xs font-medium text-ink-700 outline-none transition hover:border-brand-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
                                  >
                                    {roles.map((r) => (
                                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                    ))}
                                  </select>
                                  <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-400" />
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                        {users.length === 0 && (
                          <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-ink-400">Aucun utilisateur trouvé</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                  Le premier compte créé obtient automatiquement le rôle Administrateur. Les nouveaux comptes recoivent le rôle Commercial par défaut.
                </div>
              </div>
            )}

            {tab === 'api' && (
              <div className="space-y-4">
                <div><h3 className="font-display font-semibold">API & Intégrations</h3></div>
                <div className="rounded-lg border border-ink-100 p-4 dark:border-ink-800">
                  <div className="text-sm font-medium">Clé API</div>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 rounded bg-ink-100 px-2 py-1 font-mono text-xs dark:bg-ink-800">nxs_live_••••••••••••3f9a</code>
                    <button className="btn-secondary" onClick={() => toast('Clé copiée', 'info')}>Copier</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-ink-100 p-3 dark:border-ink-800">
                    <div className="text-sm font-medium">Webhooks</div>
                    <div className="text-xs text-ink-500">3 endpoints actifs</div>
                  </div>
                  <div className="rounded-lg border border-ink-100 p-3 dark:border-ink-800">
                    <div className="text-sm font-medium">Supabase</div>
                    <Badge tone="success">Connecté</Badge>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
