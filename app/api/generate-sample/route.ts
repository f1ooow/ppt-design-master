import { NextRequest, NextResponse } from 'next/server';
import { ApiConfig } from '@/types';
import { validateTextApiConfig } from '@/config/gemini';
import { SYSTEM_PROMPTS } from '@/config/prompts';

export async function POST(request: NextRequest) {
  try {
    const { apiConfig } = await request.json();

    // 验证文本 API 配置
    if (!apiConfig || !validateTextApiConfig(apiConfig)) {
      return NextResponse.json(
        { error: '请先配置文本 API' },
        { status: 400 }
      );
    }

    const textApi = (apiConfig as ApiConfig).text;

    const response = await fetch(`${textApi.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${textApi.apiKey}`,
      },
      body: JSON.stringify({
        model: textApi.model,
        messages: [
          { role: 'user', content: SYSTEM_PROMPTS.generateSample }
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
