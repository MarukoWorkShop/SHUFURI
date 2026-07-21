import type { LangCode } from '../../services/appSettings';

/**
 * 简体相对日文常用字形有独立码位的汉字（搜歌中译 / 简体标题高频）。
 * 含此类字 → 「中文汉字形」走思源宋体；日文歌其余走 KozMin。
 *
 * 刻意不含日文新字体同形字（国/会/学/体/当/党/万/来/内/开…），
 * 避免「紅蓮華」「残酷な天使のテーゼ」等被误判为中文。
 */
/** 仅收录与日文常用字形码位不同的简体字（避免同形字误判） */
const SC_EXCLUSIVE_CHARS =
  '爱碍袄坝摆败颁办绊帮绑镑饱报鲍辈贝钡狈备惫绷笔币毙铋边编贬变辩辫标鳖濒宾缤拨钵铂驳补财惨灿苍舱仓沧厕侧册测层诧搀馋蝉铲产阐颤场尝偿肠厂畅钞彻尘陈衬撑骋迟齿炽宠畴筹绸橱锄雏础储触传疮闯创锤纯绰词辞赐聪丛凑窜错达带贷担单郸胆诞弹挡荡档捣岛祷导盗灯邓敌涤递缔颠点垫电淀钓调迭叠钉顶锭订丢东动栋斗独镀赌段锻队吨顿钝夺堕鹅额讹恶饿儿尔饵贰发罚阀矾钒烦贩饭范泛坊纺飞绯坟愤粪疯锋缝讽凤肤辐抚辅赋缚钙盖秆赶赣冈刚钢纲岗皋镐搁鸽阁铬给龚巩贡钩沟购够蛊顾剐馆惯贯广规诡辊锅骇韩汉阂鹤贺轰红鸿壶沪浒户哗怀坏欢环还缓换唤痪黄谎挥辉贿秽汇讳诲绘荤浑伙货讥击饥机积缉鸡绩辑计记际继纪夹荚颊贾钾驾歼监坚笺间艰拣俭检碱硷见践贱键舰姜浆桨奖讲胶浇骄娇搅铰矫侥阶节疖结诫届紧锦谨烬茎惊鲸颈静镜竞纠厩驹举锯惧剧鹃绢觉凯颗壳课垦恳抠库裤夸块侩宽邝矿旷亏岿馈溃扩阔蜡腊莱赖蓝栏拦篮阑兰澜谰揽览懒烂滥捞涝乐镭垒泪篱鲤丽砾沥隶俩联莲连镰怜炼练粮凉辆谅疗辽镣猎临邻鳞凛赁龄铃馏咙聋笼垄拢陇楼娄搂篓芦卢颅庐炉掳卤虏鲁赂禄录陆驴铝侣缕虑滤绿挛孪滦乱抡轮伦仑沦纶论萝罗逻锣箩骡骆络妈玛码蚂骂吗买麦卖迈脉瞒馒蛮满谩锚铆贸么霉门闷们锰梦谜弥觅绵缅庙灭悯闽鸣铭谬亩钠纳难挠脑恼闹馁拟腻撵捻酿鸟聂啮镊镍柠狞宁拧泞钮纽脓浓疟诺欧鸥殴呕沤盘庞抛赔喷鹏骗飘频贫苹凭评泼颇扑铺谱栖齐骑岂启弃讫牵扦铅迁签谦钱钳潜浅谴堑枪呛墙蔷强抢锹桥乔侨翘峭窍窃钦亲轻氢顷庆琼穷趋躯驱龋颧权劝鹊让饶扰绕热韧认纫荣绒锐闰润洒萨鳃赛伞丧骚扫涩杀纱筛晒删闪陕赡缮伤赏烧绍赊摄慑设绅审婶肾渗声绳圣师狮湿诗蚀识驶势释饰视试寿兽枢输书赎术树竖数帅谁税顺说硕烁丝饲耸怂颂讼诵擞苏诉肃虽绥岁孙损笋缩琐挞抬摊贪瘫滩坛谭谈叹汤烫涛绦誊腾锑屉条贴铁厅听烃铜统头秃图涂团颓蜕脱鸵椭洼袜弯湾顽网韦违围潍维苇伟伪纬谓卫温闻纹稳问瓮挝蜗涡窝呜钨诬芜梧坞雾误锡牺袭习铣戏细虾辖峡侠狭厦锨鲜纤贤衔闲显险现献县馅羡宪线厢镶乡详响项萧销晓啸蝎协挟携胁谐写泻谢锌衅兴汹锈绣虚嘘须许蓄绪续轩喧选癣绚勋询寻驯训讯逊压鸦鸭哑亚讶阉烟盐严颜阎艳厌砚彦验鸯杨扬疡痒养样瑶摇尧遥窑谣药爷页业叶医铱遗仪彝蚁艺亿忆义诣议谊译异绎荫阴银饮樱婴鹰应缨莹萤营蝇颖哟拥佣痈踊优忧邮铀犹游诱舆鱼渔娱屿语吁驭鸳渊员圆缘远愿约跃钥岳粤悦阅云郧陨运蕴酝晕韵杂灾载攒暂赞赃脏凿枣灶责择则泽贼赠轧铡闸诈斋债毡盏斩辗崭栈战绽涨掌账钊沼赵照罩蜇辙辄这贞针侦诊阵挣睁狰帧郑证织职执纸挚掷帜质钟终种肿众诌轴皱猪诸诛烛瞩嘱贮铸筑驻专砖转赚桩装妆状锥赘坠缀谆浊兹资渍踪综总纵邹诅组钻';

const SC_EXCLUSIVE = new Set([...SC_EXCLUSIVE_CHARS]);

const HAN_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const KANA_RE = /[\u3040-\u30ff\u31f0-\u31ff]/;
const HANGUL_RE = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/;

/** 文本是否含简体专形（相对日文常用字形） */
export function textHasSimplifiedChineseForms(text: string): boolean {
  for (const ch of text) {
    if (SC_EXCLUSIVE.has(ch)) return true;
  }
  return false;
}

export function textHasHanzi(text: string): boolean {
  return HAN_RE.test(text);
}

export function textHasKana(text: string): boolean {
  return KANA_RE.test(text);
}

export function textHasHangul(text: string): boolean {
  return HANGUL_RE.test(text);
}

/** 歌名/歌手字段衬线覆盖：source-han | kozmin | 继承语种默认 */
export type TitleSerifOverride = 'source-han' | 'kozmin' | null;

/**
 * - zh：一律思源宋体
 * - jp：简体专形 → 思源；日文汉字/假名等 → KozMin
 * - ko/en：中文标记（简体专形，或纯汉字且无假名/韩文）→ 思源；否则继承
 */
export function resolveTitleFieldSerifOverride(
  lang: LangCode,
  text: string | null | undefined,
): TitleSerifOverride {
  const raw = text?.trim() ?? '';
  if (!raw) return null;

  if (lang === 'zh') return 'source-han';

  if (lang === 'jp') {
    return textHasSimplifiedChineseForms(raw) ? 'source-han' : 'kozmin';
  }

  if (textHasSimplifiedChineseForms(raw)) return 'source-han';
  if (textHasHanzi(raw) && !textHasKana(raw) && !textHasHangul(raw)) {
    return 'source-han';
  }
  return null;
}

export function titleSerifClassName(override: TitleSerifOverride): string {
  if (override === 'source-han') return 'fv-title-serif--source-han';
  if (override === 'kozmin') return 'fv-title-serif--kozmin';
  return '';
}
