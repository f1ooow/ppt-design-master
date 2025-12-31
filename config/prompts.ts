import { PromptConfig } from '@/types';

// 提示词元数据接口（用于 UI 展示）
export interface PromptMeta {
  key: keyof PromptConfig;
  label: string;           // 中文名称
  description: string;     // 功能说明
  variables: string[];     // 可用变量
  category: 'analysis' | 'description' | 'image' | 'utility';
}

// 提示词元数据（按分类组织）
export const PROMPT_METADATA: PromptMeta[] = [
  // 脚本分析类
  {
    key: 'analyzeFullScript',
    label: '脚本整体分析',
    description: '分析整个脚本，智能拆分镜头并生成画面描述',
    variables: ['{{scriptContent}}'],
    category: 'analysis',
  },

  // 描述生成类
  {
    key: 'generateDescription',
    label: '画面描述（无模板）',
    description: '根据讲稿内容生成PPT画面设计方案',
    variables: ['{{narration}}'],
    category: 'description',
  },
  {
    key: 'generateDescriptionWithTemplate',
    label: '画面描述（有模板）',
    description: '参考模板风格，根据讲稿生成画面描述',
    variables: ['{{narration}}'],
    category: 'description',
  },
  {
    key: 'generateDescriptionCover',
    label: '封面页描述',
    description: '根据课程信息设计封面/片头画面',
    variables: ['{{courseInfo}}', '{{segment}}', '{{narration}}'],
    category: 'description',
  },
  {
    key: 'generateDescriptionEnding',
    label: '片尾页描述',
    description: '设计片尾/结束页画面',
    variables: ['{{courseInfo}}', '{{narration}}'],
    category: 'description',
  },

  // 图片生成类（单页和批量统一使用）
  {
    key: 'generateImage',
    label: '内容页图片（有模板）',
    description: '参考模板风格生成PPT内容页',
    variables: ['{{description}}'],
    category: 'image',
  },
  {
    key: 'generateImageNoTemplate',
    label: '内容页图片（无模板）',
    description: 'AI自主设计风格生成PPT内容页',
    variables: ['{{description}}'],
    category: 'image',
  },
  {
    key: 'generateImageDirect',
    label: '直接生图（NotebookLM风格）',
    description: '跳过画面描述，直接根据脚本生成高质量信息图',
    variables: ['{{narration}}'],
    category: 'image',
  },
  {
    key: 'generateImageDirectWithTemplate',
    label: '直接生图+模板（NotebookLM风格）',
    description: '跳过画面描述，根据脚本+模板生成高质量信息图',
    variables: ['{{narration}}'],
    category: 'image',
  },
  {
    key: 'generateImageCover',
    label: '封面页图片',
    description: '生成课程封面图',
    variables: ['{{courseInfo}}'],
    category: 'image',
  },
  {
    key: 'generateImageEnding',
    label: '片尾页图片',
    description: '生成课程结束页图',
    variables: [],
    category: 'image',
  },

  // 工具类
  {
    key: 'extractImage',
    label: '提取插画',
    description: '从裁剪区域重新生成独立插画',
    variables: [],
    category: 'utility',
  },
];

// 系统级提示词（不可由用户编辑）
export const SYSTEM_PROMPTS = {
  generateSample: `随机生成一小段电商微课知识点（50-80字中文），主题随机选择：推广拉新、店铺运营、商品详情页优化、直播带货、私域流量、数据分析、客户服务、活动促销。

要求：直接输出知识点内容，不要任何前缀、标题、解释、思考过程。只要纯中文内容。

示例输出格式：
直播带货要抓住开播前30分钟的黄金流量期，提前预热引导粉丝进入直播间。开播时用限时秒杀款引爆人气，中间穿插福利抽奖维持互动热度，结尾用压轴爆款促进转化成交。`,
};

// 默认提示词配置
export const DEFAULT_PROMPTS: PromptConfig = {
  // 整体脚本分析提示词（一次性分析整个脚本，拆分镜头+生成描述）
  analyzeFullScript: `你是一位资深的信息可视化设计师。请分析脚本内容，为每一页设计**信息图风格**的画面方案。

**【设计理念：信息图式PPT】**
参考 NotebookLM、McKinsey 报告、TED 演讲 PPT 的风格：
- 每页都是一个**完整的信息单元**，有清晰的主题和结构
- 用**图文结合**的方式呈现：结构化文字 + 可视化图示
- 观众看一眼就能理解这页在讲什么

**【如果提供了模板图片】**
请仔细分析模板：
- 识别模板的整体布局结构（哪里是标题区、内容区、插画区等）
- 识别各个可填充区域的位置（页码位置、标题栏、要点列表区等）
- 在设计每页时，明确说"[位置]填写：xxx"

**【如果没有模板图片】**
请自由设计创意布局：
- 用信息可视化思维，根据内容逻辑设计构图
- 可以使用：中心辐射、流程展示、对比并列、场景叙事、卡片平铺等布局
- 在设计时说明各元素的位置关系

**【每页必须包含的内容层次】**
1. **标题**（8-15字）：概括这页的核心观点
2. **结构化要点**（2-4条）：
   - 每条要点 8-20 字，言之有物
   - 用序号、bullet point 或卡片形式组织
   - 这些文字是观众理解内容的主要载体
3. **可视化图示**（选择适合内容的形式）：
   - 流程/步骤 → 流程图、时间线
   - 分类/组成 → 图标+标签、饼图、树状图
   - 对比/关系 → 对比表格、关系图、矩阵
   - 概念/场景 → 场景插画、示意图
   - 数据 → 图表、数字标注

**【内容提炼原则】**
- 从讲稿中提炼核心信息，不要照搬原文
- 要点要具体、有信息量，不要空泛
- 好的要点示例："订单超48小时未发货 → 系统自动标记"
- 差的要点示例："注意时间管理"（太空泛）

**【图文配比原则】**
- 文字内容占页面 40-60%，视觉元素占 40-60%
- 文字是内容的骨架，图示是辅助理解的工具
- 不要做成"一张大图配一行小字"的纯插画页

---

**【脚本内容】**
{{scriptContent}}

---

**【输出格式】**
返回 JSON（只返回JSON，不要其他内容）：
{
  "courseMetadata": {
    "courseName": "课程名称",
    "textbookName": "教材名称",
    "chapterName": "章节名称",
    "unitName": "单元名称"
  },
  "pages": [
    {
      "segment": "环节名称（如：片头、知识讲解、案例分析、总结等）",
      "narration": "该页的台词/讲稿原文",
      "pageType": "cover/content/ending",
      "description": "完整的画面设计描述（见下方格式要求）"
    }
  ]
}

**【description 字段的格式要求】**
用清晰的自然语言，必须包含以下内容：

1. **页面标题**：
   - 示例："标题：异常订单的三种常见类型"

2. **结构化要点内容**（2-4条，每条要具体）：
   - 有模板时格式："[位置]填写：xxx"
   - 无模板时格式："要点1：xxx（说明）" "要点2：xxx（说明）"
   - 示例："要点1：超时未发货 - 订单创建48小时后仍未发货"
   - 示例："要点2：物流异常 - 快递信息超72小时未更新"
   - 示例："要点3：地址错误 - 收货地址信息不完整或无效"

3. **可视化图示的详细描述**：
   - 说明用什么形式（流程图/关系图/场景插画等）
   - 具体描述图示内容和各元素
   - 示例："左侧用三个卡片垂直排列展示三种异常类型，每个卡片包含图标和文字标签。右侧绘制一位女客服角色，戴耳机，正在查看电脑屏幕，屏幕上显示订单列表。三个卡片用虚线箭头指向客服，表示这些问题都需要处理。"

4. **布局说明**：
   - 示例："左右分栏布局：左侧60%放文字要点，右侧40%放场景插画"

**【重要】**
- 每页都要有实质性的文字内容，不能只有标题+大图
- 要点文字要具体、有信息量，让观众能学到东西
- 图示是辅助理解的工具，不能喧宾夺主
- pageType: 第一页通常是 cover，最后一页可能是 ending，其他都是 content`,

  // 片头/封面页专用提示词（根据课程信息设计封面）
  generateDescriptionCover: `你是一位资深的PPT视觉设计师。请根据课程信息，设计这一页**封面/片头**的画面。

**设计要求：**
封面页是整个课程PPT的"门面"，需要：
1. 突出课程主题，让观众一眼知道这是什么课
2. 体现专业性和设计感
3. 可以包含课程名称、教材信息、院校/专业等元素

---

**【课程信息】**：
{{courseInfo}}

**【环节】**：{{segment}}

**【讲稿内容】**（可能为空或仅是开场白）：
{{narration}}

---

请输出封面设计方案，包含：
- 【页面标题】课程名称或主题（4-12字）
- 【副标题】教材/单元/专业等信息（可选）
- 【主要元素】背景、装饰图形、插画等设计描述
- 【视觉风格】如：学术风、科技感、简约商务等

直接输出设计方案，不要解释。`,

  // 片尾/结束页专用提示词
  generateDescriptionEnding: `你是一位资深的PPT视觉设计师。请设计这一页**片尾/结束页**的画面。

**设计要求：**
片尾页是课程的收尾，需要：
1. 给人"完整收尾"的感觉
2. 可以包含感谢语、联系方式、二维码等
3. 设计要与整体风格协调

---

**【课程信息】**：
{{courseInfo}}

**【讲稿内容】**：
{{narration}}

---

请输出片尾设计方案，包含：
- 【页面标题】如："谢谢观看"/"感谢聆听"等
- 【主要元素】装饰图形、插画等
- 【附加信息】是否需要联系方式、二维码等占位

直接输出设计方案，不要解释。`,

  extractImage: `请根据这张裁剪后的图片，重新生成一个独立的、超高清质量的插画。

**重要任务：**
1. 识别图片中的主要视觉元素（插画、图标、图形、图表等）
2. **完全忽略并去除图片中的所有文字内容**（包括乱码、英文、中文等任何文字）
3. 只保留视觉图形元素（形状、图标、插画、装饰等）
4. 重新绘制这些视觉元素，保持原有的风格、配色和构图
5. **背景必须使用纯白色（#FFFFFF），绝对不要使用透明背景！这是强制要求！**
6. **输出超高清图片（1024x1024 或更高分辨率），确保细节清晰锐利**
7. 确保插画清晰、干净、独立、可直接使用

**关键要求（必须严格遵守）：**
- 生成的插画中不能包含任何文字！
- 背景必须是**纯白色**（#FFFFFF），绝对不要使用透明背景或其他颜色！
- 必须是**超高清**画质，边缘清晰，细节丰富！
- 图片要足够大，分辨率至少 1024x1024！

直接生成图片，不要输出文字描述。`,

  generateDescription: `你是一位有创意的信息可视化设计师。根据讲稿内容，构思一页有设计感的PPT画面。

**【讲稿】**
{{narration}}

**【设计原则】**
- 不要套用固定模式（不要总是"几个并排卡片"、"流程图"）
- 根据内容特点灵活设计：数据就画图表，对比就左右分栏，概念就用创意图形
- 画面要有主次、有焦点，不是元素平铺

**【输出】**
用自然语言描述你构思的画面，要具体、有画面感。直接描述，不要用"标题："这类标签。`,

  generateDescriptionWithTemplate: `你是一位有创意的信息可视化设计师。根据讲稿内容构思一页有设计感的PPT画面。

**【讲稿】**
{{narration}}

**【设计原则】**
- 不要套用固定模式（不要总是"几个并排卡片"、"流程图"）
- 根据内容特点灵活设计：数据就画图表，对比就左右分栏，概念就用创意图形
- 画面要有主次、有焦点，不是元素平铺

**【输出】**
用自然语言描述你构思的画面，要具体、有画面感。直接描述，不要用"标题："这类标签。`,

  // ========== 图片生成提示词（单页和批量统一使用）==========

  // 内容页图片生成（有模板）
  generateImage: `参考模板，生成一张专业的PPT页面。

{{description}}

风格参考NotebookLM、TED演讲、麦肯锡报告：布局灵活自然，不死板；有真实的图表或插画；层次分明，重点突出。

16:9，直接生成图片。`,

  // 内容页图片生成（无模板）
  generateImageNoTemplate: `生成一张专业的PPT页面。

{{description}}

风格参考NotebookLM、TED演讲、麦肯锡报告：布局灵活自然，不死板；有真实的图表或插画；层次分明，重点突出。

16:9，直接生成图片。`,

  // 封面页图片生成
  generateImageCover: `生成一张专业的PPT课程封面页图片。

**课程信息**
{{courseInfo}}

设计一张专业、简洁、有设计感的课程封面。课程名称作为大标题醒目呈现，章节/单元名称作为副标题。背景可以用渐变或抽象几何图形，配上与主题相关的扁平化图标装饰。配色生动活泼、协调。

16:9比例，直接生成图片。`,

  // 片尾页图片生成
  generateImageEnding: `生成一张专业的PPT结束页图片。

设计一张简洁大气的结束页，显示"感谢观看"或"谢谢"。背景可以用渐变或抽象几何图形，配上简洁的装饰元素。文字居中，留白充足。配色生动活泼、协调。

16:9比例，直接生成图片。`,

  // ========== 直接生图 ==========

  // 直接生图（无模板）
  generateImageDirect: `根据以下讲稿，生成一张专业的PPT页面。

{{narration}}

提炼核心信息，用最恰当的视觉形式呈现。风格参考NotebookLM、TED演讲、麦肯锡报告：布局灵活自然，不死板；根据内容需要使用图表、插画或创意图形；层次分明，重点突出。

16:9，直接生成图片。`,

  // 直接生图（有模板）
  generateImageDirectWithTemplate: `参考模板，根据以下讲稿生成一张专业的PPT页面。

{{narration}}

提炼核心信息，用最恰当的视觉形式呈现。风格参考NotebookLM、TED演讲、麦肯锡报告：布局灵活自然，不死板；根据内容需要使用图表、插画或创意图形；层次分明，重点突出。

16:9，直接生成图片。`,
};

// 从localStorage加载用户自定义提示词
export function loadPromptConfig(): PromptConfig {
  if (typeof window === 'undefined') {
    return DEFAULT_PROMPTS;
  }

  try {
    const saved = localStorage.getItem('ppt-master-prompts');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_PROMPTS,
        ...parsed,
      };
    }
  } catch (error) {
    console.error('Failed to load prompt config:', error);
  }

  return DEFAULT_PROMPTS;
}

// 保存用户自定义提示词到localStorage
export function savePromptConfig(config: PromptConfig): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem('ppt-master-prompts', JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save prompt config:', error);
  }
}

// 重置为默认提示词
export function resetPromptConfig(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem('ppt-master-prompts');
  } catch (error) {
    console.error('Failed to reset prompt config:', error);
  }
}
