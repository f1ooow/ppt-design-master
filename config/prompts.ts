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
  generateSample: `你是一个电商微课内容创作专家。请随机生成一小段电商相关的微课知识点文段（50-100字），主题可以是：
- 用户推广与拉新
- 店铺运营技巧
- 商品详情页优化
- 直播带货技巧
- 私域流量运营
- 数据分析与复盘
- 客户服务与售后
- 活动策划与促销

要求：
1. 内容专业、实用
2. 语言简洁明了
3. 包含具体的知识点或技巧
4. 适合做成PPT展示

直接输出知识点内容，不要加任何前缀或标题。`,
};

// 默认提示词配置
export const DEFAULT_PROMPTS: PromptConfig = {
  // 整体脚本分析提示词（一次性分析整个脚本，拆分镜头+生成描述）
  analyzeFullScript: `你是一位资深的PPT视觉设计师和课程设计专家。请**整体分析**这份分镜脚本，为每一页设计画面。

**【重要原则】**
1. **全局视角**：站在整个课程的角度思考，确保所有页面形成完整的视觉叙事
2. **连贯性**：相邻页面之间的风格、配色、元素要协调呼应
3. **节奏感**：根据内容的轻重缓急，设计画面的视觉张力（重点页面更丰富，过渡页面更简洁）
4. **避免重复**：不同页面要有不同的构图和设计，避免视觉疲劳

---

**【脚本内容】**
{{scriptContent}}

---

**【任务】**
1. **提取课程元信息**（如果能从脚本中识别出来）：
   - 课程名称、教材名称、章节/单元、院校/专业等

2. **智能拆分镜头**：
   - 如果脚本已有明确的分镜/镜号/段落，按脚本拆分
   - 如果没有，根据内容逻辑自动拆分（一个知识点或一段完整的讲述作为一页）

3. **为每个镜头设计画面**：
   - 考虑这一页在整体课程中的位置和作用
   - 设计具体的画面元素（标题、内容、插画等）
   - 如果是封面页或结束页，要特别设计

---

**【输出格式】**
返回 JSON（只返回JSON，不要其他内容）：
{
  "courseMetadata": {
    "courseName": "课程名称",
    "textbookName": "教材名称",
    "chapterName": "章节名称",
    "unitName": "单元名称",
    "school": "学校名称",
    "major": "专业名称",
    "teacher": "教师姓名",
    "extraInfo": "其他信息"
  },
  "pages": [
    {
      "segment": "环节名称（如：片头、知识讲解、案例分析、总结等）",
      "narration": "该页的台词/讲稿原文",
      "description": "【画面设计】详细描述这一页的视觉设计方案，包括：\\n- 页面标题和核心内容\\n- 主要视觉元素（插画、图表等的具体描述）\\n- 与前后页面的视觉关联",
      "pageType": "cover/content/ending（页面类型）"
    }
  ]
}

注意：
- courseMetadata 中找不到的字段留空字符串即可
- 每个 page 的 description 要详细具体，能直接指导图片生成
- pageType 只有第一页可能是 cover，最后一页可能是 ending，其他都是 content`,

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

  generateDescription: `你是一位资深的PPT视觉设计师。请根据讲稿内容，设计这一页PPT的画面。

**核心原则：图文并茂**
- 每一页必须有精美的插画/信息图，不能只有文字和简单图标
- 视觉元素要与内容逻辑紧密结合，用图形化方式呈现信息
- 可以设计信息图、流程图、关系图等有逻辑的视觉表达

**在你设计之前，请先完成以下思考（不需要输出给我看）：**

1. **分析脚本，提炼核心概念和逻辑关系**
2. **构思视觉化方案**：如何用图形化方式呈现这些信息

---

**【讲稿内容】**：
{{narration}}

---

请输出画面设计方案，包含：
- 【页面标题】从讲稿提炼的简短标题
- 【视觉化方案】如何用图形/信息图/插画呈现内容（自由发挥）
- 【文字内容】从讲稿提炼的精简文字要点

直接输出设计方案，不要解释。`,

  generateDescriptionWithTemplate: `你是一位资深的PPT视觉设计师。根据讲稿内容设计画面。

**参考模板图片的整体风格**：配色、背景、装饰元素、字体风格。

**核心原则：图文并茂**
- 每一页必须有精美的插画/信息图，不能只有文字和简单图标
- 视觉元素要与内容逻辑紧密结合，用图形化方式呈现信息
- 可以设计信息图、流程图、关系图等有逻辑的视觉表达

**在你设计之前，请先完成以下思考（不需要输出给我看）：**

1. **分析脚本，提炼核心概念和逻辑关系**
2. **构思视觉化方案**：如何用图形化方式呈现这些信息

---

**【讲稿内容】**：
{{narration}}

---

请输出画面设计方案，包含：
- 【页面标题】从讲稿提炼的简短标题
- 【视觉化方案】如何用图形/信息图/插画呈现内容（自由发挥）
- 【文字内容】从讲稿提炼的精简文字要点

直接输出设计方案，不要解释。`,

  // ========== 图片生成提示词（单页和批量统一使用）==========

  // 内容页图片生成（有模板）
  generateImage: `生成一张PPT页面图片。

**【强制要求 - 背景和边框必须完全复制】**
仔细观察模板图片，以下元素必须与模板保持一致：
1. 背景设计（纯色/渐变/图案）- 完全复制，不能改变
2. 边框样式（如果有）- 完全复制，不能省略或修改
3. 页面角落/边缘的固定装饰元素 - 完全复制

把模板当作"画框"，画框必须一模一样，只有里面的内容可以变化。

**【可以灵活变化的部分】**
- 标题和正文的具体文字
- 插画的具体内容（但风格要与模板统一）
- 文字和插画的布局位置

**【内容质量要求】**
1. 图文并茂：必须有精美的插画配图
2. 禁止简陋：不能只有文字框、方块图、简单图标
3. 插画要求：具体的、有细节的插画，与内容主题相关

**页面内容**
{{description}}

16:9比例，直接生成图片。`,

  // 内容页图片生成（无模板）
  generateImageNoTemplate: `生成一张专业的PPT页面图片。

**核心原则 - 必须严格遵守**
1. **图文并茂**：必须有精美的插画配图，文字和图片各占约50%
2. **禁止简陋设计**：不能只有文字框、方块图、简单图标，必须有精美插画
3. **插画要求**：具体的、有细节的插画（人物、场景、物品），与内容主题相关

**页面内容**
{{description}}

16:9比例，直接生成图片。`,

  // 封面页图片生成
  generateImageCover: `生成一张专业的PPT课程封面页图片。

**课程信息**
{{courseInfo}}

**封面设计要求 - 必须严格遵守**
1. **这是正式的课程PPT封面**，要体现学术性和专业性
2. **标题设计**：
   - 课程名称要大、醒目
   - 使用专业的字体效果（可以用渐变色、阴影）
   - 副标题（章节/单元等）字号小一些
3. **背景设计**：
   - 使用纯色渐变或抽象几何图形背景
   - **不要用真实照片做背景**
   - 配色要专业（蓝色系、绿色系等学术感的颜色）
4. **装饰元素**：
   - 可以有与课程主题相关的扁平化插画或图标
   - 插画风格要统一，不要混搭
   - 装饰不要太多太杂，保持简洁大气
5. **整体风格**：
   - 像正规教材/慕课的封面
   - 专业、简洁、大气
   - 不要花哨、不要卡通、不要用真实照片

16:9比例，直接生成图片。`,

  // 片尾页图片生成
  generateImageEnding: `生成一张专业的PPT结束页图片。

**结束页设计要求**
1. 显示"感谢观看"或"谢谢"等结束语
2. 使用纯色渐变或抽象几何背景，不要用真实照片
3. 可以有简洁的装饰元素
4. 整体风格要与课程PPT协调，专业大气

16:9比例，直接生成图片。`,
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
