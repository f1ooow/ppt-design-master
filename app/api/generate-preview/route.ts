import { NextRequest, NextResponse } from 'next/server';
import { createOpenAIClient } from '@/lib/gemini/openai-client';
import { validateGeminiConfig } from '@/config/gemini';
import { GeneratePreviewResponse, GeminiConfig } from '@/types';

/**
 * POST /api/generate-preview
 * 生成参考预览图
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { script, templateImage, geminiConfig } = body;

    // 验证输入
    if (!script) {
      return NextResponse.json(
        { error: '脚本内容不能为空' } as GeneratePreviewResponse,
        { status: 400 }
      );
    }

    // 验证配置
    if (!geminiConfig || !validateGeminiConfig(geminiConfig as GeminiConfig)) {
      return NextResponse.json(
        { error: 'API 配置无效' } as GeneratePreviewResponse,
        { status: 400 }
      );
    }

    console.log('[Generate Preview API] Template image provided:', !!templateImage);

    // 创建 OpenAI 兼容客户端
    const client = createOpenAIClient(geminiConfig as GeminiConfig);

    // 生成参考图（直接使用脚本和模板图片）
    const imageBase64 = await client.generatePreviewImage(script, templateImage);

    return NextResponse.json({
      imageBase64,
    } as GeneratePreviewResponse);

  } catch (error: any) {
    console.error('Preview generation error:', error);

    return NextResponse.json(
      {
        error: error.message || '参考图生成失败，请稍后重试',
      } as GeneratePreviewResponse,
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
