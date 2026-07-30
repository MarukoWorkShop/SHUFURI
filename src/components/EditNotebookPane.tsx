import { useMemo, type ReactNode, type Ref } from 'react';
import { listExplainNotesFromBodyHtml } from '../utils/appendExplainNoteToBody';
import { listStudyEntriesFromBodyHtml } from '../utils/studySectionItems';
import { L } from '../utils/i18n';
import './EditNotebookPane.css';

type Props = {
  bodyHtml: string;
  explainMode: boolean;
  aiOpen: boolean;
  onEnableExplain: () => void;
  onOpenExplainNote: (noteId: string) => void;
  onOpenVocab: (itemId: string) => void;
  onOpenGrammar: (itemId: string) => void;
  onDeleteExplainNote: (noteId: string) => void;
  onDeleteStudy: (itemId: string) => void;
  scrollRef?: Ref<HTMLDivElement>;
  /** 嵌入的 AI 显微镜（仅 aiOpen 时由父级传入） */
  microscope?: ReactNode;
};

export default function EditNotebookPane({
  bodyHtml,
  explainMode,
  aiOpen,
  onEnableExplain,
  onOpenExplainNote,
  onOpenVocab,
  onOpenGrammar,
  onDeleteExplainNote,
  onDeleteStudy,
  scrollRef,
  microscope,
}: Props) {
  const explainNotes = useMemo(() => listExplainNotesFromBodyHtml(bodyHtml), [bodyHtml]);
  const { vocab, grammar } = useMemo(() => listStudyEntriesFromBodyHtml(bodyHtml), [bodyHtml]);
  const total = vocab.length + grammar.length + explainNotes.length;
  const showRuledEmpty = !aiOpen && total === 0;
  const showList = !aiOpen && total > 0;

  return (
    <aside className="edit-notebook" aria-label={L('笔记本', 'Notebook')}>
      <header className="edit-notebook__header">
        <h2 className="edit-notebook__title">{L('笔记本', 'Notebook')}</h2>
        {total > 0 ? <span className="edit-notebook__count">{total} {L('条', 'items')}</span> : null}
      </header>

      <div
        ref={scrollRef}
        className={`edit-notebook__body${showRuledEmpty ? ' edit-notebook__body--ruled' : ''}`}
      >
        {aiOpen && microscope ? (
          <div className="edit-notebook__microscope-host">{microscope}</div>
        ) : null}

        {showRuledEmpty ? (
          <div className="edit-notebook__empty">
            <p className="edit-notebook__empty-kicker">Notebook</p>
            <h3 className="edit-notebook__empty-title">{L('在这里留下笔记', 'Leave your notes here.')}</h3>
            <ul className="edit-notebook__empty-list">
              <li>{L('在上一步勾选重点词汇和语法点解释，将直接在这里生成笔记', 'Select key vocab & grammar in the previous step to auto-generate notes here.')}</li>
              <li>{L('点击下方的「开启划词」，对字词和句子展开解析', 'Tap "Enable Selection" below to analyze words & sentences.')}</li>
              <li>{L('点条目可编辑，右上角 × 可删除', 'Tap an item to edit, tap × to delete.')}</li>
              <li>{L('导出时笔记将与歌词原文一并生成文档', 'Notes will be included with the lyrics in the exported document.')}</li>
            </ul>
            <button
              type="button"
              className={`edit-notebook__cta${explainMode ? ' is-active' : ''}`}
              onClick={onEnableExplain}
            >
              {explainMode ? L('划词已开启 · 去左侧选词', 'Selection on · Select text on the left') : L('开启划词', 'Enable Selection')}
            </button>
          </div>
        ) : null}

        {showList ? (
          <div className="edit-notebook__sections">
            {vocab.length > 0 ? (
              <section className="edit-notebook__section" aria-label={L('重点词汇', 'Key Vocabulary')}>
                <h3 className="edit-notebook__section-title">{L('重点词汇', 'Key Vocabulary')}</h3>
                <ul className="edit-notebook__list">
                  {vocab.map((item) => (
                    <li key={`v-${item.id}`} className="edit-notebook__item">
                      <button
                        type="button"
                        className="edit-notebook__delete"
                        aria-label={L('删除词汇', 'Delete Vocabulary')}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteStudy(item.id);
                        }}
                      >
                        ×
                      </button>
                      <button
                        type="button"
                        className="edit-notebook__card"
                        onClick={() => onOpenVocab(item.id)}
                      >
                        <p className="edit-notebook__card-line1">
                          <span
                            className="edit-notebook__card-term"
                            dangerouslySetInnerHTML={{ __html: item.termHtml || item.term }}
                          />
                          {item.meaning ? (
                            <span className="edit-notebook__card-meaning">{item.meaning}</span>
                          ) : null}
                        </p>
                        {item.example ? (
                          <p className="edit-notebook__card-ex">{item.example}</p>
                        ) : null}
                        {item.translation ? (
                          <p className="edit-notebook__card-zh">{item.translation}</p>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {grammar.length > 0 ? (
              <section className="edit-notebook__section" aria-label={L('重点语法', 'Key Grammar')}>
                <h3 className="edit-notebook__section-title">{L('重点语法', 'Key Grammar')}</h3>
                <ul className="edit-notebook__list">
                  {grammar.map((item) => (
                    <li key={`g-${item.id}`} className="edit-notebook__item">
                      <button
                        type="button"
                        className="edit-notebook__delete"
                        aria-label={L('删除语法点', 'Delete Grammar')}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteStudy(item.id);
                        }}
                      >
                        ×
                      </button>
                      <button
                        type="button"
                        className="edit-notebook__card"
                        onClick={() => onOpenGrammar(item.id)}
                      >
                        <p className="edit-notebook__card-line1">
                          <span
                            className="edit-notebook__card-term"
                            dangerouslySetInnerHTML={{
                              __html: item.titlePrimaryHtml || item.titlePrimary,
                            }}
                          />
                          {item.titleSecondary ? (
                            <span className="edit-notebook__card-meaning">
                              {item.titleSecondary}
                            </span>
                          ) : null}
                        </p>
                        {item.detail ? (
                          <p className="edit-notebook__card-ex">{item.detail}</p>
                        ) : null}
                        {item.example ? (
                          <p className="edit-notebook__card-ex">{item.example}</p>
                        ) : null}
                        {item.translation ? (
                          <p className="edit-notebook__card-zh">{item.translation}</p>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {explainNotes.length > 0 ? (
              <section className="edit-notebook__section" aria-label={L('划词笔记', 'Selection Notes')}>
                <h3 className="edit-notebook__section-title">{L('划词笔记', 'Selection Notes')}</h3>
                <ul className="edit-notebook__list">
                  {explainNotes.map((note) => (
                    <li key={`e-${note.id}`} className="edit-notebook__item">
                      <button
                        type="button"
                        className="edit-notebook__delete"
                        aria-label={L('删除划词笔记', 'Delete Note')}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteExplainNote(note.id);
                        }}
                      >
                        ×
                      </button>
                      <button
                        type="button"
                        className="edit-notebook__card"
                        onClick={() => onOpenExplainNote(note.id)}
                      >
                        <p className="edit-notebook__card-line1">
                          <span className="edit-notebook__card-term">
                            {note.term || L('（无词条）', '(No entry)')}
                          </span>
                          {note.contextSense ? (
                            <span className="edit-notebook__card-meaning">
                              {note.contextSense}
                            </span>
                          ) : null}
                        </p>
                        {note.grammar ? (
                          <p className="edit-notebook__card-ex">{note.grammar}</p>
                        ) : null}
                        {note.mood ? (
                          <p className="edit-notebook__card-zh">{note.mood}</p>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
