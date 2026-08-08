import './HomeFaqSection.css';

/**
 * HomeFaqSection · 首页「常见答疑」内容区块
 *
 * 胶囊（Q&A / SHUFURI · Q&A + 折叠按钮）由 HomeScreen 在随机歌词区下方渲染，
 * 本组件只负责展开态的内容列表渲染。
 * 默认全部收起折叠，明暗主题通过 theme.css 变量自动反色。
 */

type FaqItem = {
  q: string;
  a: string;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Q1. 为什么要让我从外部 AI 找歌词？SHUFURI 不能内部调用大模型吗？',
    a: '很多人以为大模型就像一个超级巨大的数据库，把全网所有的歌词都"死记硬背"存下来了。但实际上，它在预训练时虽然"看过"海量的数据，但它真正学到脑子里的，是词语和词语之间连接的"概率"。这也是为什么，如果用内部 API 调用，很容易出现"一本正经地胡说八道"，给你现编一段并不存在的歌词。\n\n那为什么你在用豆包、Kimi 或者 Gemini 的网页端（Chat UI）时，让它找一首歌的歌词，它又能相对找得准确？这是因为消费级 AI 的联网搜索和 RAG（检索增强生成）机制更像一个超级熟练的资料员，先自己跑去搜索引擎里查资料，把找到的准确原文"抓"回来放在工作台上，然后再根据这些可靠的参考资料，把歌词整理好端给你。\n\n既然有大厂提供的这些免费且强大的消费级大模型（智能体），我们为什么不充分利用呢？不过，哪怕是联网搜索，偶尔也会抓错信息。如果遇到不准的情况，最简单的办法就是多换几家模型试试，或者在输入框里给它下个"死命令"——比如加上一句"请务必联网搜索原版歌词，绝对不要自己编造"，效果往往会更好。找到准确歌词后，回到 SHUFURI 即可一键加假名注音、翻译并排版导出。',
  },
  {
    q: 'Q2. 这个工具是免费的吗？以后会收费吗？',
    a: '目前上线的版本主要服务于个人学习者，核心的 Prompt 生成与笔记排版功能是完全免费的，您可以零成本快速制作自己的专属学习材料。\n\n当前版本对 AI 能力的调用设有轻量的每日限额：考虑到算力的成本，AI 划词讲解每天 20 次，生成词解与语法每天 5 次（首）。对大多数个人学习者来说，这个额度足够支撑每天的日常学习。如果您需要大量生成词解与语法，又不介意自己在常用的 AI 对话工具里多复制一次 Prompt 来生成，那么这部分其实也可以做到每天无限量使用。\n\n随着 SHUFURI 的进化，我们未来可能会推出付费的进阶版本。付费版主要面向对效率有极致要求的重度用户、外语教师及培训机构。届时将解锁诸如"互动式教学白板"、"批量教研素材导出"、"AI生成图像和排版"等高阶生产力工具。',
  },
  {
    q: 'Q3. AI 生成的歌词注音、翻译和语法解析准确率高吗？',
    a: '我们的 AI 引擎能为您处理 95% 以上的繁杂查词与排版工作，是极具效率的学习助手。但请注意，歌词是一种高度浓缩且充满艺术加工的文学体裁。\n\n为了押韵或营造意境，词作者常常会使用不合常规的发音（如日语的特殊读音/熟字训）、跳跃的语法结构或深度的隐喻。这些艺术性的表达有时会超出 AI 的常规理解范畴，导致假名注音或翻译的细微偏差。因此，AI 讲解更适合作为辅助理解的参考工具。\n\n为此，我们提供了全交互式的极速编辑功能。发现偏差时，您可以随时点击修改注音或翻译，将这份粗加工的素材，亲手打磨成 100% 契合您理解的专属完美笔记。',
  },
  {
    q: 'Q4. 我的歌词笔记和学习数据安全吗？会被收集吗？',
    a: '请绝对放心，您的数据 100% 安全。\n\n为了最大程度保护您的隐私，SHUFURI 当前采用"免登录、纯本地"的设计。这意味着，您粘贴的所有歌词、微调的注音以及个人的学习笔记，都仅仅安全地存储在您当前使用的这台设备（浏览器本地）中，我们绝不会将其上传或收集到任何云端服务器。\n\n💡 友情提示： 既然数据留在本地，当您清理浏览器缓存或更换设备时，这些记录也会随之消失。为了防止心血丢失，建议您养成好习惯，在学习完成后，及时将重要的歌词卡片导出为 PDF 或备忘录进行备份哦。',
  },
];

/**
 * 纯内容渲染组件。胶囊与折叠交互由 HomeScreen 管理。
 */
export default function HomeFaqSection() {
  return (
    <section className="home-faq" aria-label="常见答疑">
      <h2 className="sr-only">常见问题</h2>

      <p className="home-faq__sub">关于 SHUFURI，你可能想问的问题。</p>

      <div className="home-faq__list">
        {FAQ_ITEMS.map((item) => (
          <details className="home-faq__item" key={item.q}>
            <summary className="home-faq__q">
              <span>{item.q}</span>
              <svg className="home-faq__chevron" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            {item.a.split('\n\n').map((para, i) => (
              <p className="home-faq__a" key={i}>{para}</p>
            ))}
          </details>
        ))}
      </div>

      <p className="home-faq__contact">
        还有问题？写信给我们{' '}
        <a className="home-faq__mail" href="mailto:hello@shufuri.com">hello@shufuri.com</a>
      </p>
    </section>
  );
}
