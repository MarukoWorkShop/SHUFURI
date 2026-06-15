/**
 * 排版特征配置系统 — 可扩展的日文杂志排版识别架构
 *
 * ## 设计理念
 *
 * 不为每种排版写独立识别逻辑，而是将排版特征抽象为可配置的参数，
 * 通过通用 Prompt 工厂 + 排版配置驱动差异化行为。
 *
 * ## 架构层级
 *
 *   LayoutProfile (排版配置)
 *     ├── RegionSchema[]   — 页面区域布局模板（位置、方向、语义角色）
 *     ├── LayoutTraits     — 排版特征参数（文字方向、注音、分栏等）
 *     └── PreprocessHints  — 预处理建议（CLAHE 参数、色彩策略等）
 *
 *   LayoutRegistry (配置注册表)
 *     ├── 预定义配置：magazine-standard / newspaper-column / textbook / novel-vertical
 *     └── 自定义配置：用户可通过 registerLayoutProfile() 注册新样式
 *
 *   PromptFactory (Prompt 工厂)
 *     ├── 通用基础模板（不变的核心能力描述）
 *     ├── 配置驱动的差异化部分（区域布局图、扫描规则、特殊标点）
 *     └── 统一输出格式（===OCR=== / ===TITLE=== / ===SECTION=== / ===END===）
 */

// ---- 基础类型 ----

/** 文字方向 */
export type TextDirection = 'horizontal' | 'vertical' | 'mixed';

/** 区域语义角色 */
export type RegionRole =
  | 'brand'           // 品牌/来源标识
  | 'title'           // 主标题
  | 'subtitle'        // 副标题/题记/导语
  | 'sidebar'         // 侧栏/独立区块
  | 'body'            // 主体正文
  | 'footer'          // 页脚元数据
  | 'image-caption'   // 图片说明
  | 'pull-quote'      // 引用块
  | 'custom';         // 自定义角色

/** 区域扫描优先级（数字越小越先扫描） */
export type RegionPriority = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

// ---- 区域布局模板 ----

/** 页面区域的布局描述 */
export interface RegionSchema {
  /** 区域唯一标识 */
  id: string;
  /** 语义角色 */
  role: RegionRole;
  /** 扫描优先级（A=1, B=2, ...） */
  priority: RegionPriority;
  /** 区域的典型位置描述（给 AI 的提示，如 "顶部居中"、"右上角"） */
  positionHint: string;
  /** 该区域的预期文字方向 */
  textDirection: TextDirection;
  /** 是否必须存在（如标题缺失时也要确认） */
  required?: boolean;
  /** 该区域的额外识别提示 */
  extraHints?: string;
  /** 输出时的 SECTION 标签（默认为 role 名） */
  outputLabel?: string;
}

// ---- 排版特征参数 ----

/** 排版特征集 */
export interface LayoutTraits {
  /** 主体文字方向 */
  primaryDirection: TextDirection;
  /** 是否含注音假名（ルビ/furigana） */
  hasFurigana: boolean;
  /** 是否多栏排版 */
  multiColumn: boolean;
  /** 竖排列数（0 表示不适用） */
  verticalColumnCount?: number;
  /** 横排行数特征（如 "每页约 15-20 行"） */
  horizontalRowHint?: string;
  /** 字号特征（如 "正文 10pt，标题 24pt"） */
  fontSizeHint?: string;
  /** 特殊排版特征描述 */
  specialFeatures?: string[];
}

// ---- 预处理提示 ----

/** 预处理参数建议 */
export interface PreprocessHints {
  /** 建议的 CLAHE clipLimit */
  claheClipLimit: number;
  /** 建议的 CLAHE 网格尺寸 [cols, rows] */
  claheGrid: [number, number];
  /** 是否保留色彩（杂志彩色排版为 true，纯文字为 false） */
  keepColor: boolean;
  /** 建议的输入图片最小宽度（px） */
  minInputWidth: number;
  /** 建议的 JPEG 输出质量 */
  jpegQuality: number;
  /** 额外预处理步骤 */
  extraSteps?: string[];
}

// ---- 排版配置（Profile） ----

/** 完整的排版配置 */
export interface LayoutProfile {
  /** 配置唯一标识 */
  id: string;
  /** 人类可读的名称 */
  name: string;
  /** 简短描述 */
  description: string;
  /** 适用场景 */
  appliesTo: string[];
  /** 区域布局模板（按 priority 排序） */
  regions: RegionSchema[];
  /** 排版特征 */
  traits: LayoutTraits;
  /** 预处理建议 */
  preprocess: PreprocessHints;
  /** 额外的系统提示词片段（追加到通用模板后） */
  extraSystemPrompt?: string;
  /** 额外的用户提示词片段（追加到通用引导后） */
  extraUserPrompt?: string;
}

// ---- 预定义排版配置 ----

/**
 * 标准杂志排版（默认配置）
 *
 * 典型特征：
 * - 横排标题 + 竖排正文混合
 * - 含品牌标识、独立侧栏、页脚信息
 * - 彩色印刷，需要保留色彩作为分区线索
 */
export const MAGAZINE_STANDARD: LayoutProfile = {
  id: 'magazine-standard',
  name: '标准杂志排版',
  description: '日文杂志常见排版：横排标题 + 竖排正文混合，含品牌标识、独立区块、页脚',
  appliesTo: ['杂志内页', '旅行指南', '美食推荐', '生活方式杂志'],
  regions: [
    {
      id: 'brand',
      role: 'brand',
      priority: 1,
      positionHint: '顶部左上角或顶部居中',
      textDirection: 'horizontal',
      extraHints: '通常为小字品牌名或栏目名',
    },
    {
      id: 'title',
      role: 'title',
      priority: 2,
      positionHint: '页面中上部，居中或偏左，字号最大',
      textDirection: 'horizontal',
      required: true,
      extraHints: '可能是单个大标题或多行标题',
      outputLabel: '标题',
    },
    {
      id: 'subtitle',
      role: 'subtitle',
      priority: 3,
      positionHint: '标题正下方，横排短段落',
      textDirection: 'horizontal',
      extraHints: '可能是题记、导语或摘要，字号小于标题但大于正文',
    },
    {
      id: 'sidebar',
      role: 'sidebar',
      priority: 4,
      positionHint: '右上角或右侧，独立的区块',
      textDirection: 'horizontal',
      extraHints: '可能是广告文案、小贴士、引用框、价格信息等',
    },
    {
      id: 'body',
      role: 'body',
      priority: 5,
      positionHint: '占据页面最大面积的主体区域',
      textDirection: 'vertical',
      required: true,
      extraHints: '竖排多列，严格按右列→左列顺序逐列读取',
    },
    {
      id: 'footer',
      role: 'footer',
      priority: 6,
      positionHint: '页面最底部',
      textDirection: 'horizontal',
      extraHints: '地址、电话号码、营业时间、版权信息等小字',
    },
  ],
  traits: {
    primaryDirection: 'mixed',
    hasFurigana: true,
    multiColumn: true,
    verticalColumnCount: 2,
    fontSizeHint: '正文约 10-12pt，标题约 24-36pt',
    specialFeatures: ['竖排正文', '横排标题', '彩色分区'],
  },
  preprocess: {
    claheClipLimit: 2.0,
    claheGrid: [8, 8],
    keepColor: true,
    minInputWidth: 2048,
    jpegQuality: 0.94,
  },
};

/**
 * 报纸专栏排版
 *
 * 典型特征：
 * - 竖排多列正文为主
 * - 标题可能是竖排或横排
 * - 黑白印刷为主，对比度可能较低
 */
export const NEWSPAPER_COLUMN: LayoutProfile = {
  id: 'newspaper-column',
  name: '报纸专栏排版',
  description: '日文报纸常见排版：竖排多列正文，标题可能是横排或竖排',
  appliesTo: ['报纸专栏', '新闻社论', '连载小说'],
  regions: [
    {
      id: 'title',
      role: 'title',
      priority: 1,
      positionHint: '页面顶部，可能横排也可能竖排',
      textDirection: 'mixed',
      required: true,
      extraHints: '报纸标题可能横跨多列，或位于第一列顶部',
    },
    {
      id: 'body',
      role: 'body',
      priority: 2,
      positionHint: '占据页面绝大部分的主体区域',
      textDirection: 'vertical',
      required: true,
      extraHints: '竖排多列（通常 3-5 列），严格按右列→左列顺序逐列读取。注意：报纸竖排标点符号位置与横排不同',
    },
    {
      id: 'footer',
      role: 'footer',
      priority: 3,
      positionHint: '页面底部或最后一列末尾',
      textDirection: 'horizontal',
      extraHints: '作者名、日期、版次等',
    },
  ],
  traits: {
    primaryDirection: 'vertical',
    hasFurigana: false,
    multiColumn: true,
    verticalColumnCount: 4,
    fontSizeHint: '正文约 8-10pt，标题约 18-24pt',
    specialFeatures: ['竖排多列', '黑白印刷', '高密度排版'],
  },
  preprocess: {
    claheClipLimit: 3.0, // 报纸对比度通常较低，需要更强的 CLAHE
    claheGrid: [6, 6],   // 更细的网格以适应小字
    keepColor: false,    // 报纸通常黑白
    minInputWidth: 2560, // 报纸小字需要更高分辨率
    jpegQuality: 0.95,
  },
};

/**
 * 教科书/教材排版
 *
 * 典型特征：
 * - 横排正文为主
 * - 含注音假名（ルビ）
 * - 可能有插图说明
 */
export const TEXTBOOK: LayoutProfile = {
  id: 'textbook',
  name: '教科书/教材排版',
  description: '日语教科书常见排版：横排正文，含注音假名和插图说明',
  appliesTo: ['日语教科书', '学习资料', '儿童读物'],
  regions: [
    {
      id: 'title',
      role: 'title',
      priority: 1,
      positionHint: '页面顶部，横排',
      textDirection: 'horizontal',
      required: true,
    },
    {
      id: 'body',
      role: 'body',
      priority: 2,
      positionHint: '占据页面主要区域',
      textDirection: 'horizontal',
      required: true,
      extraHints: '横排段落，可能包含注音假名（汉字上方小字）',
    },
    {
      id: 'image-caption',
      role: 'image-caption',
      priority: 3,
      positionHint: '插图旁边或下方',
      textDirection: 'horizontal',
      extraHints: '插图说明文字，字号较小',
    },
    {
      id: 'footer',
      role: 'footer',
      priority: 4,
      positionHint: '页面底部',
      textDirection: 'horizontal',
      extraHints: '页码、章节名等',
    },
  ],
  traits: {
    primaryDirection: 'horizontal',
    hasFurigana: true,
    multiColumn: false,
    fontSizeHint: '正文约 12-14pt，标题约 20-28pt',
    specialFeatures: ['注音假名', '插图说明'],
  },
  preprocess: {
    claheClipLimit: 1.5,
    claheGrid: [8, 8],
    keepColor: true,
    minInputWidth: 2048,
    jpegQuality: 0.92,
  },
};

/**
 * 小说竖排版
 *
 * 典型特征：
 * - 纯竖排正文
 * - 无标题、无广告
 * - 段落分明，可能有插图
 */
export const NOVEL_VERTICAL: LayoutProfile = {
  id: 'novel-vertical',
  name: '小说竖排版',
  description: '日文小说传统竖排版：纯竖排正文，段落分明',
  appliesTo: ['小说', '散文', '和歌集', '古典文学'],
  regions: [
    {
      id: 'title',
      role: 'title',
      priority: 1,
      positionHint: '页面顶部或第一列起始处',
      textDirection: 'vertical',
      extraHints: '小说标题可能在竖排第一列的顶部，字号略大于正文',
    },
    {
      id: 'body',
      role: 'body',
      priority: 2,
      positionHint: '占据页面绝大部分',
      textDirection: 'vertical',
      required: true,
      extraHints: '纯竖排正文，段落之间可能有空行或缩进。注意：竖排中「」的引号方向、句号位置与横排不同',
    },
    {
      id: 'footer',
      role: 'footer',
      priority: 3,
      positionHint: '页面底部',
      textDirection: 'horizontal',
      extraHints: '页码',
    },
  ],
  traits: {
    primaryDirection: 'vertical',
    hasFurigana: true,
    multiColumn: false,
    verticalColumnCount: 1,
    fontSizeHint: '正文约 10-12pt',
    specialFeatures: ['纯竖排', '古典排版', '特殊标点符号'],
  },
  preprocess: {
    claheClipLimit: 2.0,
    claheGrid: [8, 8],
    keepColor: false,
    minInputWidth: 2048,
    jpegQuality: 0.92,
  },
};

/**
 * 广告/海报排版
 *
 * 典型特征：
 * - 标题大而醒目
 * - 图文混合
 * - 文字方向多变
 */
export const AD_POSTER: LayoutProfile = {
  id: 'ad-poster',
  name: '广告/海报排版',
  description: '日文广告海报排版：大标题、图文混合、方向多变',
  appliesTo: ['广告海报', '促销传单', '活动公告'],
  regions: [
    {
      id: 'title',
      role: 'title',
      priority: 1,
      positionHint: '页面最醒目位置，字号最大',
      textDirection: 'mixed',
      required: true,
      extraHints: '广告标题可能横排、竖排或倾斜排列',
    },
    {
      id: 'body',
      role: 'body',
      priority: 2,
      positionHint: '标题下方或周围',
      textDirection: 'mixed',
      required: true,
      extraHints: '广告正文，可能横排竖排混合，文字大小不一',
    },
    {
      id: 'footer',
      role: 'footer',
      priority: 3,
      positionHint: '页面底部或边角',
      textDirection: 'horizontal',
      extraHints: '联系方式、价格、日期等',
    },
  ],
  traits: {
    primaryDirection: 'mixed',
    hasFurigana: false,
    multiColumn: false,
    fontSizeHint: '大小不一，标题极大',
    specialFeatures: ['图文混合', '字体多变', '装饰性文字'],
  },
  preprocess: {
    claheClipLimit: 1.5,
    claheGrid: [8, 8],
    keepColor: true,
    minInputWidth: 2048,
    jpegQuality: 0.94,
  },
};

// ---- 配置注册表 ----

/** 所有预定义排版配置 */
const PREDEFINED_PROFILES: LayoutProfile[] = [
  MAGAZINE_STANDARD,
  NEWSPAPER_COLUMN,
  TEXTBOOK,
  NOVEL_VERTICAL,
  AD_POSTER,
];

/** 排版配置注册表 */
class LayoutRegistry {
  private profiles = new Map<string, LayoutProfile>();

  constructor() {
    // 注册所有预定义配置
    for (const profile of PREDEFINED_PROFILES) {
      this.register(profile);
    }
  }

  /** 注册一个排版配置 */
  register(profile: LayoutProfile): void {
    if (this.profiles.has(profile.id)) {
      console.warn(`[layout-registry] 配置 "${profile.id}" 已存在，将被覆盖`);
    }
    this.profiles.set(profile.id, { ...profile });
  }

  /** 获取指定配置 */
  get(id: string): LayoutProfile | undefined {
    return this.profiles.get(id);
  }

  /** 列出所有可用配置 */
  list(): LayoutProfile[] {
    return Array.from(this.profiles.values());
  }

  /** 根据场景关键词推荐配置 */
  suggest(keywords: string[]): LayoutProfile[] {
    const lower = keywords.map((k) => k.toLowerCase());
    return this.list().filter((p) =>
      p.appliesTo.some((label) =>
        lower.some((kw) => label.toLowerCase().includes(kw)),
      ),
    );
  }

  /** 默认配置 */
  getDefault(): LayoutProfile {
    return this.profiles.get('magazine-standard')!;
  }
}

/** 全局单例 */
export const layoutRegistry = new LayoutRegistry();

/**
 * 注册自定义排版配置。
 *
 * @example
 * ```ts
 * registerLayoutProfile({
 *   id: 'my-magazine',
 *   name: '我的杂志',
 *   description: '自定义排版',
 *   appliesTo: ['自定义'],
 *   regions: [ ... ],
 *   traits: { ... },
 *   preprocess: { ... },
 * });
 * ```
 */
export function registerLayoutProfile(profile: LayoutProfile): void {
  layoutRegistry.register(profile);
}
