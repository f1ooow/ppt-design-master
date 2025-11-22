import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { geminiConfig } = await request.json();

    if (!geminiConfig?.apiUrl || !geminiConfig?.apiKey) {
      return NextResponse.json(
        { error: '请先配置 API' },
        { status: 400 }
      );
    }

    const prompt = `你是一个电商微课内容创作专家。请随机生成一小段电商相关的微课知识点文段（50-100字），主题可以是：
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

直接输出知识点内容，不要加任何前缀或标题。`;

    const response = await fetch(`${geminiConfig.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${geminiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gemini-2.0-flash',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API 请求失败: ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error('生成内容为空');
    }

    return NextResponse.json({ content });
  } catch (error: any) {
    console.error('Generate sample error:', error);
    return NextResponse.json(
      { error: error.message || '生成失败' },
      { status: 500 }
    );
  }
}
