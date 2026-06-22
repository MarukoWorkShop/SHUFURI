import { useCallback, useRef, useState } from 'react';
import type { InkEditTarget } from '../components/InkFineTunePopover';
import { applyRubyEdit, applyZhLineEdit } from '../utils/inkFineTune/applyInkEdit';
import { saveInkFineTuneDraft } from '../utils/inkFineTune/inkFineTuneDraft';
import { playPencilScratchSound } from '../utils/inkFineTune/pencilScratchSound';
import {
  type InkEditSnapshot,
  inkEditSnapshotsEqual,
  INK_EDIT_UNDO_LIMIT,
} from '../utils/inkFineTune/inkEditHistory';
import { prepareBodyHtmlForPreview, prepareTitleMarkupHtml } from '../utils/inkEditUtils';

const INK_POPOVER_CLOSE_MS = 220;

type WorkspaceRefs = {
  bodyHtmlRef: { current: string };
  titleRef: { current: string };
  artistRef: { current: string };
  titleMarkupHtmlRef: { current: string | undefined };
};

type WorkspaceSetters = {
  setBodyHtml: (html: string) => void;
  setTitle: (title: string) => void;
  setArtist: (artist: string) => void;
  setTitleMarkupHtml: (html: string | undefined) => void;
};

type Options = WorkspaceRefs &
  WorkspaceSetters & {
    bodyHtml: string;
    savedProjectId: string | null;
  };

export function useInkEditSession({
  bodyHtml,
  savedProjectId,
  bodyHtmlRef,
  titleRef,
  artistRef,
  titleMarkupHtmlRef,
  setBodyHtml,
  setTitle,
  setArtist,
  setTitleMarkupHtml,
}: Options) {
  const [inkEditTarget, setInkEditTarget] = useState<InkEditTarget | null>(null);
  const [inkPopoverClosing, setInkPopoverClosing] = useState(false);
  const [inkToolboxOpen, setInkToolboxOpen] = useState(false);
  const [canUndoInkEdit, setCanUndoInkEdit] = useState(false);
  const [inkDraftKanji, setInkDraftKanji] = useState('');
  const [inkDraftKana, setInkDraftKana] = useState('');
  const [inkDraftZh, setInkDraftZh] = useState('');
  const [inkDraftTitle, setInkDraftTitle] = useState('');
  const [inkDraftArtist, setInkDraftArtist] = useState('');
  const undoStackRef = useRef<InkEditSnapshot[]>([]);

  const inkFocusGroupIndex =
    inkEditTarget && inkEditTarget.kind !== 'title' ? inkEditTarget.groupIndex : null;

  const closeInkPopover = useCallback(() => {
    setInkPopoverClosing(true);
    window.setTimeout(() => {
      setInkEditTarget(null);
      setInkPopoverClosing(false);
    }, INK_POPOVER_CLOSE_MS);
  }, []);

  const pushUndoSnapshot = useCallback(() => {
    const snap: InkEditSnapshot = {
      bodyHtml: bodyHtmlRef.current,
      title: titleRef.current,
      artist: artistRef.current,
      titleMarkupHtml: titleMarkupHtmlRef.current,
    };
    const stack = undoStackRef.current;
    const last = stack[stack.length - 1];
    if (last && inkEditSnapshotsEqual(last, snap)) return;
    stack.push(snap);
    if (stack.length > INK_EDIT_UNDO_LIMIT) stack.shift();
    setCanUndoInkEdit(true);
  }, [bodyHtmlRef, titleRef, artistRef, titleMarkupHtmlRef]);

  const handleInkUndo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const prev = stack.pop()!;
    setBodyHtml(prepareBodyHtmlForPreview(prev.bodyHtml));
    setTitle(prev.title);
    setArtist(prev.artist);
    setTitleMarkupHtml(prepareTitleMarkupHtml(prev.titleMarkupHtml));
    setCanUndoInkEdit(stack.length > 0);
    closeInkPopover();
    playPencilScratchSound();
  }, [closeInkPopover, setBodyHtml, setTitle, setArtist, setTitleMarkupHtml]);

  const handleInkOpenTarget = useCallback((target: InkEditTarget) => {
    setInkEditTarget(target);
    setInkPopoverClosing(false);
    if (target.kind === 'title') {
      setInkDraftTitle(target.title);
      setInkDraftArtist(target.artist);
    } else if (target.kind === 'zh') {
      setInkDraftZh(target.text);
    } else {
      setInkDraftKanji(target.kanji);
      setInkDraftKana(target.kana);
    }
  }, []);

  const handleInkConfirm = useCallback(() => {
    if (!inkEditTarget) return;

    pushUndoSnapshot();

    if (inkEditTarget.kind === 'title') {
      setTitle(inkDraftTitle.trim());
      setArtist(inkDraftArtist.trim());
      setTitleMarkupHtml(undefined);
      playPencilScratchSound();
      closeInkPopover();
      return;
    }

    let nextBody = bodyHtml;
    if (inkEditTarget.kind === 'zh') {
      nextBody = applyZhLineEdit(bodyHtml, inkEditTarget.groupIndex, inkDraftZh);
    } else {
      nextBody = applyRubyEdit(
        bodyHtml,
        inkEditTarget.groupIndex,
        inkEditTarget.rubyIndex,
        inkDraftKanji,
        inkDraftKana,
      );
    }

    const normalized = prepareBodyHtmlForPreview(nextBody);
    setBodyHtml(normalized);
    saveInkFineTuneDraft(savedProjectId ?? 'session', normalized);
    playPencilScratchSound();
    closeInkPopover();
  }, [
    inkEditTarget,
    bodyHtml,
    inkDraftZh,
    inkDraftKanji,
    inkDraftKana,
    inkDraftTitle,
    inkDraftArtist,
    savedProjectId,
    closeInkPopover,
    pushUndoSnapshot,
    setBodyHtml,
    setTitle,
    setArtist,
    setTitleMarkupHtml,
  ]);

  const resetInkSession = useCallback(() => {
    setInkToolboxOpen(false);
    setInkEditTarget(null);
    undoStackRef.current = [];
    setCanUndoInkEdit(false);
  }, []);

  const clearInkTarget = useCallback(() => {
    setInkEditTarget(null);
    setInkPopoverClosing(false);
  }, []);

  return {
    inkEditTarget,
    inkPopoverClosing,
    inkToolboxOpen,
    setInkToolboxOpen,
    canUndoInkEdit,
    inkDraftKanji,
    inkDraftKana,
    inkDraftZh,
    inkDraftTitle,
    inkDraftArtist,
    setInkDraftKanji,
    setInkDraftKana,
    setInkDraftZh,
    setInkDraftTitle,
    setInkDraftArtist,
    inkFocusGroupIndex,
    closeInkPopover,
    handleInkUndo,
    handleInkOpenTarget,
    handleInkConfirm,
    resetInkSession,
    setInkPopoverClosing,
    clearInkTarget,
  };
}
