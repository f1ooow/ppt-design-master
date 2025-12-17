import { NextRequest, NextResponse } from 'next/server';
import { GeneratePreviewResponse, ApiConfig } from '@/types';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

/**
 * POST /api/generate-preview
 * 生成参考预览图 - 使用前端传来的描述生成图片
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { script, description, templateImage, apiConfig, custom_prompt } = body;

    // 验证输入
    if (!script && !description) {
      return NextResponse.json(
        { error: '脚本内容或描述不能为空' } as GeneratePreviewResponse,
        { status: 400 }
      );
    }

    console.log('[Generate Preview API] Generating image...');
    console.log('[Generate Preview API] Template image provided:', !!templateImage);
    console.log('[Generate Preview API] Custom prompt provided:', !!custom_prompt);

    // 直接用描述生成图片，传递 API 配置
    const response = await fetch(`${BACKEND_URL}/api/batch/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        narration: script,
        description: description || '',
        page_type: 'content',
        aspect_ratio: '16:9',
        template_base64: templateImage || null,
        custom_prompt: custom_prompt || null,
        api_config: apiConfig ? {
          api_url: (apiConfig as ApiConfig).image?.apiUrl,
          api_key: (apiConfig as ApiConfig).image?.apiKey,
          model: (apiConfig as ApiConfig).image?.model,
        } : null
      }),
    });

    const result = await response.json();

    if (result.success && result.data?.image_base64) {
      console.log('[Generate Preview API] Image generated successfully');
      return NextResponse.json({
        imageBase64: result.data.image_base64,
      } as GeneratePreviewResponse);
    } else {
      console.error('[Generate Preview API] Backend error:', result.message);
      return NextResponse.json(
        { error: result.message || '图片生成失败' } as GeneratePreviewResponse,
        { status: 500 }
      );
    }

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
