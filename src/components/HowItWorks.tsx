import { useCallback, useEffect, useState } from 'react';
import '../styles/app/howItWorks.css';
import { L } from '../utils/i18n';
import { getAppSettings } from '../services/appSettings';

/**
 * HowItWorks · 首页常驻「4 步流程条」
 * 放置位：表单上方，全程可见。
 * 折叠态：摘要条（① 输入歌曲 → ② 生成口令→AI → ③ 进入学习 → ④ 导出）。
 * 展开态：带图标 + 详细说明的卡片组。
 * 首次访问默认展开，偏好写入 localStorage；之后按用户选择记忆。
 */

type HowItWorksProps = {
  variant?: 'full' | 'compact';
  className?: string;
};

const COLLAPSE_PREF_KEY = 'shufuri.hiw.collapsed';

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function readCollapsePref(): boolean | null {
  try {
    const v = localStorage.getItem(COLLAPSE_PREF_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch {
    /* ignore */
  }
  return null;
}

function writeCollapsePref(collapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSE_PREF_KEY, collapsed ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function IconNote() {
  return (
    <svg viewBox="0 0 64 64" {...STROKE}>
      <circle cx="22" cy="46" r="6" />
      <circle cx="46" cy="40" r="6" />
      <path d="M28 46 V14" />
      <path d="M52 40 V12" />
      <path d="M28 14 L52 12" />
      <path d="M14 20 h10 M14 26 h10" />
    </svg>
  );
}

function IconAiSpark() {
  return (
    <svg viewBox="0 0 64 64" {...STROKE}>
      <path d="M32 8 L36 28 L56 32 L36 36 L32 56 L28 36 L8 32 L28 28 Z" />
      <path
        d="M50 12 L52 18 L58 20 L52 22 L50 28 L48 22 L42 20 L48 18 Z"
        fill="currentColor"
        stroke="none"
        opacity={0.5}
      />
    </svg>
  );
}

function IconStudy() {
  return (
    <svg viewBox="0 0 64 64" {...STROKE}>
      <rect x="12" y="14" width="26" height="36" rx="2" />
      <path d="M18 10v4M26 10v4M34 10v4" />
      <path d="M18 26h14M18 32h14M18 38h9" />
      <circle cx="46" cy="42" r="8" />
      <path d="M52 48l7 7" />
    </svg>
  );
}

function IconExport() {
  return (
    <svg viewBox="0 0 64 64" {...STROKE}>
      <path d="M16 10h22l10 10v30a2 2 0 0 1 -2 2H16a2 2 0 0 1 -2 -2V12a2 2 0 0 1 2 -2z" />
      <path d="M38 10v10h10" />
      <path d="M22 34h8M22 40h12M22 46h8" />
      <circle cx="46" cy="20" r="3.5" />
      <circle cx="58" cy="30" r="3.5" />
      <circle cx="46" cy="42" r="3.5" />
      <path d="M48.5 22 l7 6M48.5 38 l7 -6" />
    </svg>
  );
}

const STEPS = [
  {
    n: 1,
    icon: <IconNote />,
    badge: '1',
    titleZh: '输入歌曲',
    titleEn: 'Input song',
    descZh: '填入歌名 / 歌手，选择主要语言；\n或直接从音乐 APP 分享——复制链接——粘贴到输入框自动识别歌曲信息',
    descEn: 'Enter title / artist, or share → copy link → paste into the home form.',
  },
  {
    n: 2,
    icon: <IconAiSpark />,
    badge: '2',
    titleZh: '生成口令 → AI',
    titleEn: 'Prompt → AI',
    descZh: '点「一键生成口令」复制 Prompt，粘贴到你信任的 AI，将AI返回的结果复制到剪贴板，点击「生成学习材料」。',
    descEn: 'Tap "Generate Prompt", paste into your AI, then paste the result back here.',
  },
  {
    n: 3,
    icon: <IconStudy />,
    badge: '3',
    titleZh: '进入学习',
    titleEn: 'Enter & learn',
    descZh: '修正歌词、标注注音、划词 AI 解析、保存笔记到本地库。',
    descEn: 'Fix lyrics, toggle readings, AI-explain, save to local library.',
  },
  {
    n: 4,
    icon: <IconExport />,
    badge: '4',
    titleZh: '导出分享',
    titleEn: 'Export / Share',
    descZh: '一键导出可打印 PDF，或生成适配社媒的分享图。',
    descEn: 'Export a printable PDF, or create share images.',
  },
];

export default function HowItWorks({ className }: HowItWorksProps) {
  const showEnSubtitle = getAppSettings().interfaceLanguage !== 'en';
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const pref = readCollapsePref();
    setCollapsed(pref === null ? false : pref);
    setMounted(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsePref(next);
      return next;
    });
  }, []);

  return (
    <section
      className={`hiw${collapsed ? ' is-collapsed' : ''}${mounted ? ' is-mounted' : ''}${
        className ? ` ${className}` : ''
      }`}
      aria-label={L('SHUFURI 使用流程', 'How SHUFURI works')}
    >
      {/* 荧光黄胶囊按钮 */}
      <button
        type="button"
        className="hiw__pill"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
      >
        <span className="hiw__pill-label">SHUFURI · 使用流程 4 步</span>
        <span className={`hiw__chevron hiw__chevron--${collapsed ? 'down' : 'up'}`} aria-hidden />
      </button>

      {/* 4步流程卡片（展开时显示） */}
      {!collapsed && (
        <div className="hiw__steps-row">
          {STEPS.map((s, i) => (
            <div className="hiw__step-card" key={s.n}>
              <div className="hiw__step-badge">{s.badge}</div>
              <h3 className="hiw__step-title">{showEnSubtitle ? s.titleZh : s.titleEn}</h3>
              <p className="hiw__step-sub">{showEnSubtitle ? s.titleEn : s.titleZh}</p>
              <p className="hiw__step-desc">{showEnSubtitle ? s.descZh : s.descEn}</p>
              {i < STEPS.length - 1 && <span className="hiw__step-arrow">→</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
