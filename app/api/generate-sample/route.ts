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

    // 使用用户配置的模型
    const sampleModel = textApi.model;

    // 使用 Gemini 原生 API 格式
    const response = await fetch(`${textApi.apiUrl}/v1beta/models/${sampleModel}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': textApi.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: '你只输出纯中文内容，不输出任何英文、思考过程、解释说明。直接给出最终答案。' }]
        },
        contents: [{
          parts: [{ text: SYSTEM_PROMPTS.generateSample }]
        }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 200
        }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API 请求失败: ${error}`);
    }

    const data = await response.json();

    // 从 Gemini 响应中提取文本
    let content = '';
    if (data.candidates?.[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.text) {
          content += part.text;
        }
      }
    }
    content = content.trim();

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
