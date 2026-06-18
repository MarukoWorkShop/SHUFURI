export type InkEditSnapshot = {
  bodyHtml: string;
  title: string;
  artist: string;
  titleMarkupHtml?: string;
};

export function inkEditSnapshotsEqual(a: InkEditSnapshot, b: InkEditSnapshot): boolean {
  return (
    a.bodyHtml === b.bodyHtml &&
    a.title === b.title &&
    a.artist === b.artist &&
    a.titleMarkupHtml === b.titleMarkupHtml
  );
}

export const INK_EDIT_UNDO_LIMIT = 50;
