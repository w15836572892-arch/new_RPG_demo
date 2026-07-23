export type DivinationPromptSource = {
  id: string;
  modern: string;
  meaning: string;
};

export type GeneratedDivinationQuestion = {
  villager: string;
  prompt: string;
  answerId: string;
  portrait: 'farmer' | 'woman';
};

const VILLAGERS: Array<{ name: string; portrait: 'farmer' | 'woman' }> = [
  { name: '阿禾', portrait: 'farmer' },
  { name: '妣青', portrait: 'woman' },
  { name: '田伯', portrait: 'farmer' },
  { name: '姜娘', portrait: 'woman' },
  { name: '石叔', portrait: 'farmer' },
  { name: '阿绢', portrait: 'woman' },
];

// These scenarios make common life questions read naturally. All remaining
// catalog entries still receive a clear, generated semantic prompt below.
const SCENARIOS: Record<string, string> = {
  '雨': '田里久旱，明日能否迎来雨水，禾苗会不会得到滋润？',
  '日': '连日阴云遮天，明天能否见到太阳，方便大家下田？',
  '田': '今年新开的田地能否带来好收成？',
  '水': '村边水源是否充足，够不够全村取用？',
  '河': '渡河出行是否平安，水路会不会阻断？',
  '泉': '山脚的泉眼会不会继续出水？',
  '火': '灶火与祭火能否顺利燃旺？',
  '风': '风势会不会太大，影响屋舍和庄稼？',
  '云': '天上的云会不会聚来，带来天气变化？',
  '星': '夜空星象是否清晰，便于辨认时令？',
  '月': '月色是否明朗，夜里出行可否顺利？',
  '天': '近日天时是否适合举行祭礼？',
  '春': '春耕的时机是否已经到了？',
  '秋': '秋收时节是否会有好收成？',
  '晨': '清晨出发是否吉利？',
  '夜': '夜里守望是否安稳？',
  '山': '进山采集是否平安？',
  '土': '这片土地是否适合播种？',
  '木': '伐下的木材是否够用来修屋？',
  '米': '仓中的米粮能否支撑到下一季？',
  '马': '外出时马匹是否健壮、能否顺利赶路？',
  '人': '这次派人出行能否平安归来？',
  '女': '家中女子近日是否安好？',
  '父': '父亲外出办事是否顺利？',
  '母': '母亲的身体能否安康？',
  '家': '全家人能否安居无忧？',
  '安': '家宅近日是否安宁？',
  '子': '孩子是否能平安成长？',
  '小': '家中年幼的孩子近日是否安稳？',
  '少': '家里人手不多，能否顺利完成这次劳作？',
  '生': '新生的幼儿是否能够平安长大？',
  '病': '家人身体不适，病情是否会好转？',
  '心': '心中所忧之事能否得到安定的结果？',
  '学': '孩子学习礼法与文字是否会有进步？',
  '行': '这趟行路是否平安顺利？',
  '走': '派人前往邻村是否顺利？',
  '进': '此时前进办事是否合适？',
  '出': '今日外出是否吉利？',
  '来': '等候的人是否会按时到来？',
  '去': '离开此地办事是否顺利？',
  '门': '家门出入是否平安？',
  '道': '前往市集的道路是否通畅？',
  '井': '井水是否清洁充足？',
  '酒': '祭礼所用的酒是否足够？',
  '肉': '祭礼所需的肉食是否备齐？',
  '骨': '这片甲骨是否适合用于占问？',
  '金': '新铸的金属器是否坚固好用？',
  '刀': '这把刀是否锋利，适合劳作？',
  '力': '大家是否有足够的力气完成劳作？',
  '劳': '这段辛劳是否能换来好结果？',
  '好': '这件亲事是否会有好结果？',
  '喜': '筹备的庆事是否顺利？',
  '哭': '家中悲伤之事能否早日平息？',
  '大': '眼前的大事是否适合立刻办理？',
  '多': '所备物资是否足够多？',
  '一': '此事能否一心办成？',
  '二': '两家的约定是否能顺利达成？',
  '三': '三日之内能否完成这件事？',
  '五': '五日后的祭礼是否顺利？',
  '十': '十日之内能否收到好消息？',
  '百': '储备的大量粮食是否足够？',
  '年': '今年能否风调雨顺、收成丰足？',
};

function generatedPrompt(card: DivinationPromptSource) {
  const scenario = SCENARIOS[card.modern];
  if (scenario) return `村民求问：“${scenario}”请从三片甲骨中选出语义最相符的一字。`;

  const firstMeaning = card.meaning.split('。')[0].replace(/^“([^”]+)”/, '“$1”');
  return `村民求问：“我想占问${firstMeaning}所指的事情是否顺利。”请从三片甲骨中选出语义最相符的一字。`;
}

/** Build one divination question for every supplied oracle character. */
export function buildDivinationQuestions(cards: DivinationPromptSource[]): GeneratedDivinationQuestion[] {
  return cards.map((card, index) => {
    const villager = VILLAGERS[index % VILLAGERS.length];
    return {
      villager: villager.name,
      portrait: villager.portrait,
      prompt: generatedPrompt(card),
      answerId: card.id,
    };
  });
}
