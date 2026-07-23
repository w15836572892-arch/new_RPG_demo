export type ImportedOracleCard = {
  id: string;
  glyph: string;
  modern: string;
  pinyin: string;
  quality: 'blue';
  meaning: string;
  evolution: string;
  history: string;
  asset: string;
  imageBounds: readonly [number, number, number, number];
  excavatable: true;
  catalogOnlyWhenUnlocked: true;
};

// modern character | pinyin from the supplied reference | oracle-bone code | plate reference
// The supplied image for every entry is retained as the glyph shown on the card.
const RAW_CATALOG = `安|an|U60B5A|合5373
八|ba|U6158D|合8996正
白|bai|U6055B|合293
百|bai|U6055D|合102
鼻|bi|U6039A|合8189
朝|zhao,chao|U60764|合33130,合29092,合23148
晨|chen,nong|U60CD2|合22610
出|chu|U60409|合6122
春|chun|U607AB|合11533
大|da|U600E1|合8425
刀|dao|U60DF7|合32625
道|dao,kan|U60D01|屯4562
得|de|U61946|合3734
地|地名|U6020D|屯4049
登|deng|U60FFB|合475
弟|di|U6130D|英2674正
豆|dou|U61008|合29364
多|duo|U61397|合585正
儿|er,ni|U6004D|合1075正,英2674正
耳|er|U60376|合13630
二|er|U6157F|合6057正
发|fa|U60EE3|合10405正
分|fen|U60DFD|合11398
风|feng|U6094C|合1166甲
父|fu|U6049C|合2128
敢|gan|U6104C|合10705正屯3035
高|gao|U60B09|合18643
骨|gua|？|屯912
光|guang|U6067F|合6566反
好|hao|U60240|合684
河|he|U606EB|合10085正
黑|hei,jin,han,jian|U6012D|合10171正
厚|hou|U613AD|合19723(三博12）
画|hua|U61222|合3397
黄|huang|U60EAD|合3475
昏|hun|U605CF|合29092
火|huo|U60642|合11503反
基|ji|U61048|合6574
家|jia|U60B3A|合13584正甲（乙1047）
肩|gua,jian|U60C91|合23247
街|jie|U60D5A|合4908
今|jin|U60AC9|合37
金|jin,jinshan|U60AD0|合26862,合23573
进|jin|U60956|合32535
井|jing|U610A0|合2757
九|jiu|U61590|合378正
酒|you|U60F8E|花53
旧|jiu|U6097C|合3522正
可|ke|U60F03|合30355
刻|ke|U6079F|合7938(合補5704=東文研168）,合21477(甲3575）
口|kou|U603A9|合31570
哭|ku|U6002C|合23705
来|lai|U60814|合2367
劳|lao|U60AAC|合24283
老|lao|U6003C|合21054,合20293
力|li|U61370|英751
利|li|U607EC|合35346
六|liu|U61587|合22713
马|ma|U608C1|合584正甲
每|mei|U60214|合29185
妹|mei|U60221|合38217
门|men|U60C08|合34220
米|mi|U60A4C|屯1126
面|mian|U60314|屯2462,合21427,合21428
民|min|U60312|合13629
明|ming|U605E4|合19608（甲3079）
母|mu|U6020C|合19969
木|mu|U6076C|合33298,合32806
男|nan|U60C5E|合3456
能|xiong|U60933|合19703正
年|nian|U6080A|合9705
念|nian|U60A99|合9471
女|nv|U6020B|合536
盆|pen,wen|U60F34|合28167
皮|pi|U603C8|花149,花550
七|qi|U6158B|合6057正
气|qi|U613FE|合43
千|qian|U6000B|合17911
墙|qiang|U6120B|合36481正,合27888
秋|qiu|U61992|合33233正
去|qu|U600FF|合5151,合7312
泉|quan|U60BEC|合8371
人|ren|U60000|合43
日|ri|U605C4|合6057正
肉|rou|U61394|合18250
三|san|U61581|合20045
沙|sha|U606C0|合27996
山|shan|U60641|合6571正
上|shang|U60583|合809
少|xiao,shao|U61403|合5595
舌|she|U603AD|合14398
身|shen|U6000F|合376正（乙4071）
生|sheng|U60739|合5165,合5845
声|sheng|U60CC7|屯3551
十|shi|U613EE|合137正
石|shi|U60CA6|合33916
水|shui|U606B4|合10151正
顺|shun|U6034B|屯2080
四|si|U61583|合34210
岁|sui|U60DB8|合9659
它|ta|U609FF|合10060
天|tian|U61863|合22453（山博8.43.4）
田|tian|U60C37|合9784
头|shi|U616A2|合31993（屯附3）
土|tu|U6062F|合6354正
外|bu|U60C9B|合34189
万|wan,mian|U6124A|屯825
往|wang|U60439|合7943
危|wei|U61387|合6427
文|wen|U61341|合36154
我|wo|U60DEC|合6057正
五|wu|U61585|合137正
午|wu|U614AC|合5760正
夕|xi,yue|U605E1|合94正
洗|xi|U6045C|合1380
喜|xi|U6102B|合21207
下|xia|U60584|合809
夏|xu|U6035F|合27722
小|xiao|U61402|合15344
心|xin|U60A96|合11424正,合6
新|xin|U60E62|合30799
星|xing|U6075E|合11497正
行|xing|U60CDC|合5457
学|xue|U61333|合27712,花474,花450
血|meng,xue|U60F09|合18548(上博2426.1392）,合21126
夜|yi|U60101|合1075反
一|yi|U6157E|合6834正
用|yong|U61091|合5349
有|you|U60491|合19837
右|you|U60491|合19837
雨|yu|U60601|合94正
月|yue,xi|U605E0|合137正
云|yun|U605F4|合13404
早|zao|U60770|合6543
长|chang|U60034|合28195,合27641
真|zhen|U60FA4|合27226
知|zhi|U602FC|合32563
中|zhong|U61117|合7363正
重|zhong|U61172|村中南483
字|zi|U61972|合2495正
走|zou|U60154|合27939(甲2810）,合17993
左|zuo|U60492|合386
坐|zuo|U60BBA|合5357`;

const EXISTING_CATALOG_CHARACTERS = new Set(['雨', '日', '河', '云', '星', '木', '月', '水']);

const MODERN_MEANING_HINTS: Record<string, string> = {
  '小': '表示细小、数量少或程度轻', '少': '表示数量不多，也可表示年少', '大': '表示大小中的大，也可表示重要',
  '人': '表示人的侧立形象', '女': '表示女性形象', '子': '表示子女或幼小的人', '父': '表示父亲，也可联系家族关系', '母': '表示母亲',
  '日': '表示太阳和白天', '月': '表示月亮，也常用于记时', '星': '表示星辰和夜空天象', '雨': '表示降雨和天气', '风': '表示风和气候变化', '云': '表示天空中聚散变化的云气',
  '水': '表示水流和水源', '河': '表示河流和水道', '泉': '表示从地下涌出的水源', '火': '表示火焰和用火', '土': '表示土地、土壤', '山': '表示山岭、山地', '木': '表示树木、木材',
  '田': '表示田地和耕作', '米': '表示稻米等谷物', '马': '表示马，是交通、战争和祭祀中的重要动物', '骨': '表示骨骼，也与甲骨材料直接相关',
  '安': '表示安定、安居', '家': '表示居所和家庭', '学': '表示学习、受教', '字': '表示文字，也可联系生育、养育的古义', '文': '表示纹理、文饰，后发展为文字、文章',
  '心': '表示内心、心意和思考', '念': '表示思念、记挂', '知': '表示知道、认识', '真': '表示真实、确实', '明': '表示明亮、清楚', '新': '表示新旧中的新', '旧': '表示过去、旧有',
  '出': '表示从里面向外出现、离开', '进': '表示向前进入', '来': '表示来到、到来', '去': '表示离开、过去', '行': '表示行走，也可表示道路或行为', '走': '表示奔走、行动', '道': '表示道路，后引申为方法和道理',
  '口': '表示人的口，也可表示开口、言说', '耳': '表示耳朵和听闻', '鼻': '表示鼻子和嗅觉', '舌': '表示舌头和言语', '面': '表示脸面、表面', '身': '表示人的身体', '肩': '表示肩部',
  '一': '表示一个、开始或统一的数量概念', '二': '表示两个或成对', '三': '表示三这个数目', '四': '表示四这个数目', '五': '表示五这个数目', '六': '表示六这个数目', '七': '表示七这个数目', '八': '表示八这个数目', '九': '表示九这个数目', '十': '表示十这个数目', '百': '表示百这个数目', '千': '表示较大的数目', '万': '表示数量极多，后也成为数词单位'
};

function makeLesson(modern: string) {
  const gloss = MODERN_MEANING_HINTS[modern] ?? `表示与现代“${modern}”字相关的事物、动作或概念`;
  return {
    meaning: `“${modern}”${gloss}。在甲骨卜辞中，字义还需结合完整句子判断：它可能用于记事、询问、祭祀或说明当时的生活事务。`,
    evolution: '这张字形保留了甲骨书写的线条特征。与今天的楷书相比，早期字形通常更接近事物轮廓；同一个字在不同卜辞中也会有略微不同的写法。',
    history: '商代王室把祭祀、天气、农事、出行、疾病等问题刻写在龟甲或兽骨上。通过这个字，可以把文字学习和商代社会生活联系起来。',
  };
}

export const importedOracleCards: ImportedOracleCard[] = RAW_CATALOG.split('\n')
  .map(row => row.split('|'))
  .filter(([modern]) => !EXISTING_CATALOG_CHARACTERS.has(modern))
  .map(([modern, pinyin]) => {
    const unicode = modern.codePointAt(0)?.toString(16).padStart(4, '0') ?? '0000';
    const lesson = makeLesson(modern);
    return {
      id: `catalog-u${unicode}`,
      glyph: modern,
      modern,
      pinyin,
      quality: 'blue',
      meaning: lesson.meaning,
      evolution: lesson.evolution,
      history: lesson.history,
      asset: `catalog/ob-u${unicode}`,
      imageBounds: [0, 0, 199, 199] as const,
      excavatable: true,
      catalogOnlyWhenUnlocked: true,
    };
  });
