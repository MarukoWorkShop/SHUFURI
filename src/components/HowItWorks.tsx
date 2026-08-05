import { useCallback, useEffect, useState } from 'react';
import '../styles/app/howItWorks.css';
import { L } from '../utils/i18n';
import { getAppSettings } from '../services/appSettings';
import { listSavedLyricsProjects } from '../services/savedLyricsStore';

/**
 * HowItWorks · 首页「4 步说明带」
 * 放置位：输入卡下方、歌词库上方。
 * 明色：白底 + 深灰线条 + Kinari；暗色随 data-theme 翻转，对齐首页输入卡灰阶。
 * 暖用户（本地已有歌词本）默认收起；偏好写入 localStorage。
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

function Arrow() {
  return (
    <div className="hiw__arrow" aria-hidden="true">
      <svg viewBox="0 0 24 24" {...STROKE}>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </div>
  );
}

export default function HowItWorks({ variant = 'full', className }: HowItWorksProps) {
  const compact = variant === 'compact';
  const showEnSubtitle = getAppSettings().interfaceLanguage !== 'en';
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const pref = readCollapsePref();
    if (pref !== null) {
      setCollapsed(pref);
      return;
    }
    let cancelled = false;
    listSavedLyricsProjects()
      .then((items) => {
        if (!cancelled) setCollapsed(items.length > 0);
      })
      .catch(() => {
        /* cold default: expanded */
      });
    return () => {
      cancelled = true;
    };
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
      className={`hiw${collapsed ? ' is-collapsed' : ''}${className ? ` ${className}` : ''}`}
      aria-label={L('SHUFURI 使用流程', 'How SHUFURI works')}
    >
      <div className="hiw__head">
        {collapsed ? (
          <button
            type="button"
            className="hiw__kicker hiw__kicker--btn"
            onClick={toggleCollapsed}
            aria-expanded={false}
            title={L('展开使用流程', 'Expand how it works')}
          >
            {L('SHUFURI · 使用流程', 'SHUFURI · How it works')}
          </button>
        ) : (
          <>
            <div className="hiw__head-main">
              <span className="hiw__kicker">
                {L('SHUFURI · 使用流程', 'SHUFURI · How it works')}
              </span>
              <h2 className="hiw__title">
                {L(
                  '4 步，把外语歌变成可打印的学习笔记',
                  '4 steps to turn a foreign song into printable study notes',
                )}
              </h2>
              {!compact && (
                <p className="hiw__sub">
                  {L(
                    '外部 AI 生成歌词 → SHUFURI 排版 · 修正 · 学习 · 导出',
                    'Generate lyrics with an external AI → layout, fix, learn & export in SHUFURI',
                  )}
                </p>
              )}
            </div>
            <button
              type="button"
              className="hiw__toggle"
              onClick={toggleCollapsed}
              aria-expanded={true}
              aria-label={L('收起使用流程', 'Collapse how it works')}
              title={L('收起', 'Collapse')}
            >
              <svg className="hiw__toggle-icon" viewBox="0 0 24 24" aria-hidden>
                <path
                  d="M6 15l6-6 6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </>
        )}
      </div>

      {!collapsed && (
        <div className="hiw__strip">
          <article className="hiw__card">
            <div className="hiw__badge">1</div>
            <div className="hiw__icon">
              <IconNote />
            </div>
            <h3 className="hiw__card-title">{L('获得歌曲', 'Find a song')}</h3>
            {showEnSubtitle ? <div className="hiw__card-en">Find a song</div> : null}
            <p className="hiw__card-desc">
              {L(
                '输入歌名 / 歌手，或从音乐 App 分享 → 复制链接 → 粘贴到首页输入框。',
                'Enter title / artist, or share → copy link from a music app → paste into the home form.',
              )}
            </p>
          </article>

          <Arrow />

          <article className="hiw__card">
            <div className="hiw__badge">2</div>
            <div className="hiw__icon">
              <IconAiSpark />
            </div>
            <h3 className="hiw__card-title">
              {L('生成 Prompt，回传粘贴 AI 结果', 'Generate prompt, paste AI result')}
            </h3>
            {showEnSubtitle ? <div className="hiw__card-en">Prompt → AI result</div> : null}
            <p className="hiw__card-desc">
              {L(
                '点击「一键生成口令」复制 Prompt，粘贴到你信任的 AI 对话框，再把返回结果粘贴回本页排版。',
                'Tap “Generate AI Prompt”, paste it into your trusted AI chat, then paste the result back here to layout.',
              )}
            </p>
            <p className="hiw__card-desc">
              {L(
                '按需勾选「AI 生成语法」或「仅看歌词」。',
                'Optionally check “AI grammar” or “lyrics only”.',
              )}
            </p>
          </article>

          <Arrow />

          <article className="hiw__card">
            <div className="hiw__badge">3</div>
            <div className="hiw__icon">
              <IconStudy />
            </div>
            <h3 className="hiw__card-title">{L('进入学习页面', 'Enter & learn')}</h3>
            {showEnSubtitle ? <div className="hiw__card-en">Enter &amp; learn</div> : null}
            <p className="hiw__card-desc">
              {L('进入学习页后你可以：', 'On the study page you can:')}
            </p>
            <ul className="hiw__bullets">
              <li>
                {L('修正 AI 幻觉带来的歌词错误', 'Fix AI hallucination errors in lyrics')}
              </li>
              <li>{L('标注 / 去掉注音', 'Show / hide readings')}</li>
              <li>{L('划词 AI 解析', 'AI explain selection')}</li>
              <li>{L('保存笔记到本地库', 'Save notes to local library')}</li>
            </ul>
          </article>

          <Arrow />

          <article className="hiw__card">
            <div className="hiw__badge">4</div>
            <div className="hiw__icon">
              <IconExport />
            </div>
            <h3 className="hiw__card-title">{L('导出 / 分享', 'Export / Share')}</h3>
            {showEnSubtitle ? <div className="hiw__card-en">Export / Share</div> : null}
            <p className="hiw__card-desc">
              {L(
                '一键导出可打印 PDF，或生成适配社媒的分享图。',
                'Export a printable PDF, or create share images for social.',
              )}
            </p>
          </article>
        </div>
      )}
    </section>
  );
}
