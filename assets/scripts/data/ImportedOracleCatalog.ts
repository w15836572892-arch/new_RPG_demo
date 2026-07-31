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
前|qian|U524D|教学大纲
后|hou|U540E|教学大纲
里|li|U91CC|教学大纲
江|jiang|U6C5F|教学大纲
湖|hu|U6E56|教学大纲
海|hai|U6D77|教学大纲
爸|ba|U7238|教学大纲
妈|ma|U5988|教学大纲
爷|ye|U7237|教学大纲
奶|nai|U5976|教学大纲
哥|ge|U54E5|教学大纲
姐|jie|U59D0|教学大纲
孩|hai|U5B69|教学大纲
你|ni|U4F60|教学大纲
他|ta|U4ED6|教学大纲
她|ta|U5979|教学大纲
咱|zan|U54B1|教学大纲
们|men|U4EEC|教学大纲
谁|shei|U8C01|教学大纲
这|zhe|U8FD9|教学大纲
那|na|U90A3|教学大纲
哪|na|U54EA|教学大纲
昨|zuo|U6628|教学大纲
冬|dong|U51AC|教学大纲
晚|wan|U665A|教学大纲
时|shi|U65F6|教学大纲
昼|zhou|U663C|教学大纲
眼|yan|U773C|教学大纲
手|shou|U624B|教学大纲
足|zu|U8DB3|教学大纲
毛|mao|U6BDB|教学大纲
齿|chi|U9F7F|教学大纲
胸|xiong|U80F8|教学大纲
腰|yao|U8170|教学大纲
腿|tui|U817F|教学大纲
脚|jiao|U811A|教学大纲
指|zhi|U6307|教学大纲
掌|zhang|U638C|教学大纲
汗|han|U6C57|教学大纲
泪|lei|U6CEA|教学大纲
音|yin|U97F3|教学大纲
饭|fan|U996D|教学大纲
菜|cai|U83DC|教学大纲
瓜|gua|U74DC|教学大纲
果|guo|U679C|教学大纲
茶|cha|U8336|教学大纲
蛋|dan|U86CB|教学大纲
油|you|U6CB9|教学大纲
盐|yan|U76D0|教学大纲
糖|tang|U7CD6|教学大纲
粥|zhou|U7CA5|教学大纲
饼|bing|U997C|教学大纲
汤|tang|U6C64|教学大纲
麦|mai|U9EA6|教学大纲
蔬|shu|U852C|教学大纲
房|fang|U623F|教学大纲
屋|wu|U5C4B|教学大纲
窗|chuang|U7A97|教学大纲
桌|zhuo|U684C|教学大纲
椅|yi|U6905|教学大纲
床|chuang|U5E8A|教学大纲
灯|deng|U706F|教学大纲
楼|lou|U697C|教学大纲
契|qi|U5951|教学大纲
院|yuan|U9662|教学大纲
巷|xiang|U5DF7|教学大纲
路|lu|U8DEF|教学大纲
车|che|U8F66|教学大纲
船|chuan|U8239|教学大纲
桥|qiao|U6865|教学大纲
坡|po|U5761|教学大纲
缸|gang|U7F38|教学大纲
杯|bei|U676F|教学大纲
碗|wan|U7897|教学大纲
勺|shao|U52FA|教学大纲
筷|kuai|U7B77|教学大纲
尺|chi|U5C3A|教学大纲
笔|bi|U7B14|教学大纲
纸|zhi|U7EB8|教学大纲
书|shu|U4E66|教学大纲
本|ben|U672C|教学大纲
烬|jin|U70EC|教学大纲
图|tu|U56FE|教学大纲
册|ce|U518C|教学大纲
校|xiao|U6821|教学大纲
师|shi|U5E08|教学大纲
班|ban|U73ED|教学大纲
课|ke|U8BFE|教学大纲
数|shu|U6570|教学大纲
语|yu|U8BED|教学大纲
英|ying|U82F1|教学大纲
跑|pao|U8DD1|教学大纲
跳|tiao|U8DF3|教学大纲
站|zhan|U7AD9|教学大纲
卧|wo|U5367|教学大纲
飞|fei|U98DE|教学大纲
游|you|U6E38|教学大纲
爬|pa|U722C|教学大纲
看|kan|U770B|教学大纲
听|ting|U542C|教学大纲
说|shuo|U8BF4|教学大纲
读|du|U8BFB|教学大纲
写|xie|U5199|教学大纲
喊|han|U558A|教学大纲
叫|jiao|U53EB|教学大纲
笑|xiao|U7B11|教学大纲
吃|chi|U5403|教学大纲
喝|he|U559D|教学大纲
睡|shui|U7761|教学大纲
扫|sao|U626B|教学大纲
擦|ca|U64E6|教学大纲
开|kai|U5F00|教学大纲
关|guan|U5173|教学大纲
拿|na|U62FF|教学大纲
放|fang|U653E|教学大纲
回|hui|U56DE|教学大纲
到|dao|U5230|教学大纲
攀|pan|U6500|教学大纲
爱|ai|U7231|教学大纲
怒|nu|U6012|教学大纲
悲|bei|U60B2|教学大纲
愁|chou|U6101|教学大纲
思|si|U601D|教学大纲
想|xiang|U60F3|教学大纲
懂|dong|U61C2|教学大纲
记|ji|U8BB0|教学大纲
坏|huai|U574F|教学大纲
假|jia|U5047|教学大纲
低|di|U4F4E|教学大纲
短|duan|U77ED|教学大纲
宽|kuan|U5BBD|教学大纲
窄|zhai|U7A84|教学大纲
薄|bao|U8584|教学大纲
轻|qing|U8F7B|教学大纲
快|kuai|U5FEB|教学大纲
慢|man|U6162|教学大纲
远|yuan|U8FDC|教学大纲
近|jin|U8FD1|教学大纲
红|hong|U7EA2|教学大纲
蓝|lan|U84DD|教学大纲
绿|lv|U7EFF|教学大纲
灰|hui|U7070|教学大纲
粉|fen|U7C89|教学大纲
亮|liang|U4EAE|教学大纲
暗|an|U6697|教学大纲
无|wu|U65E0|教学大纲
会|hui|U4F1A|教学大纲
要|yao|U8981|教学大纲
应|ying|U5E94|教学大纲
该|gai|U8BE5|教学大纲
功|gong|U529F|教学大纲
平|ping|U5E73|教学大纲
福|fu|U798F|教学大纲
忙|mang|U5FD9|教学大纲
禾|he|U79BE|教学大纲
兵|bing|U5175|教学大纲
祀|si|U7940|教学大纲
婚|hun|U5A5A|教学大纲
坐|zuo|U60BBA|合5357`;

const EXISTING_CATALOG_CHARACTERS = new Set(['雨', '日', '河', '云', '星', '木', '月', '水']);

// A card may only be published when its matching, user-supplied oracle image
// is actually bundled in assets/resources/oracle/catalog. RAW_CATALOG also
// contains a larger teaching-word list; those rows are not picture assets and
// must never fall back to modern Hanzi in the learner-facing codex.
const IMAGE_BACKED_CATALOG_CHARACTERS = new Set(Array.from(
  '安八白百鼻朝晨出春大刀道得地登弟豆多儿耳二发分风父敢高骨光好河黑厚画黄昏火基家肩街今金进井九酒旧可刻口哭来劳老力利六马每妹门米面民明母木男能年念女盆皮七气千墙秋去泉人日肉三沙山上少舌身生声十石水顺四岁它天田头土外万往危文我五午夕洗喜下夏小心新星行学血夜一用有右雨月云早长真知中重字走左坐',
));

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

export function makeLesson(modern: string) {
  const gloss = MODERN_MEANING_HINTS[modern] ?? `表示与现代“${modern}”字相关的事物、动作或概念`;
  return {
    meaning: `“${modern}”${gloss}。在甲骨卜辞中，字义还需结合完整句子判断：它可能用于记事、询问、祭祀或说明当时的生活事务。`,
    evolution: '这张字形保留了甲骨书写的线条特征。与今天的楷书相比，早期字形通常更接近事物轮廓；同一个字在不同卜辞中也会有略微不同的写法。',
      history: '商代王室把祭祀、天气、农事、出行、疾病等问题刻写在龟甲或兽骨上。通过这个字，可以把文字学习和商代社会生活联系起来。',
  };
}

// 全部 RAW_CATALOG 行的 modern→pinyin 映射（含「教学大纲」待补字与「图像已收录」字）。
// 用于为 ChapterCharMap 中尚未手录卡面的待补字生成占位卡时填入拼音。
export const RAW_CATALOG_PINYIN: ReadonlyMap<string, string> = new Map(
  RAW_CATALOG.split('\n')
    .filter(row => row.trim().length > 0)
    .map(row => row.split('|'))
    .map(([modern, pinyin]) => [modern, pinyin ?? ''] as [string, string]),
);

export const importedOracleCards: ImportedOracleCard[] = RAW_CATALOG.split('\n')
  .map(row => row.split('|'))
  .filter(([modern]) => !EXISTING_CATALOG_CHARACTERS.has(modern) && IMAGE_BACKED_CATALOG_CHARACTERS.has(modern))
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
