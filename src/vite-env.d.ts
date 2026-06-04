/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** lib.dom 已有 FileSystem* 类型，此处仅补充 Window.showDirectoryPicker */
interface Window {
  showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
}
