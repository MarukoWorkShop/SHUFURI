import { useMemo, type ReactNode, type Ref } from 'react';
import { listExplainNotesFromBodyHtml } from '../utils/appendExplainNoteToBody';
import { listStudyEntriesFromBodyHtml } from '../utils/studySectionItems';
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
    <aside className="edit-notebook" aria-label="笔记本">
      <header className="edit-notebook__header">
        <h2 className="edit-notebook__title">笔记本</h2>
        {total > 0 ? <span className="edit-notebook__count">{total} 条</span> : null}
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
            <h3 className="edit-notebook__empty-title">在这里留下笔记</h3>
            <ul className="edit-notebook__empty-list">
              <li>在上一步勾选重点词汇和语法点解释，将直接在这里生成笔记</li>
              <li>也可在左侧划选词语，写入划词笔记</li>
              <li>点条目可编辑，右上角 × 可删除</li>
              <li>导出时笔记将与歌词原文一并生成文档</li>
            </ul>
            <button
              type="button"
              className={`edit-notebook__cta${explainMode ? ' is-active' : ''}`}
              onClick={onEnableExplain}
            >
              {explainMode ? '划词已开启 · 去左侧选词' : '开启划词'}
            </button>
          </div>
        ) : null}

        {showList ? (
          <div className="edit-notebook__sections">
            {vocab.length > 0 ? (
              <section className="edit-notebook__section" aria-label="重点词汇">
                <h3 className="edit-notebook__section-title">重点词汇</h3>
                <ul className="edit-notebook__list">
                  {vocab.map((item) => (
                    <li key={`v-${item.id}`} className="edit-notebook__item">
                      <button
                        type="button"
                        className="edit-notebook__delete"
                        aria-label="删除词汇"
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
              <section className="edit-notebook__section" aria-label="重点语法">
                <h3 className="edit-notebook__section-title">重点语法</h3>
                <ul className="edit-notebook__list">
                  {grammar.map((item) => (
                    <li key={`g-${item.id}`} className="edit-notebook__item">
                      <button
                        type="button"
                        className="edit-notebook__delete"
                        aria-label="删除语法点"
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
              <section className="edit-notebook__section" aria-label="划词笔记">
                <h3 className="edit-notebook__section-title">划词笔记</h3>
                <ul className="edit-notebook__list">
                  {explainNotes.map((note) => (
                    <li key={`e-${note.id}`} className="edit-notebook__item">
                      <button
                        type="button"
                        className="edit-notebook__delete"
                        aria-label="删除划词笔记"
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
                            {note.term || '（无词条）'}
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
