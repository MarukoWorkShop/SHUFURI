/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ARK_API_KEY?: string;
  readonly VITE_ARK_HOME_MODEL?: string;
  readonly ARK_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** lib.dom 已有 FileSystem* 类型，此处仅补充 Window.showDirectoryPicker */
interface Window {
  showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
}
