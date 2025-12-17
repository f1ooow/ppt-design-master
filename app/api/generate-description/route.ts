import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

/**
 * POST /api/generate-description
 * 生成画面描述（分析脚本内容）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { script, custom_prompt, template_base64 } = body;

    if (!script) {
      return NextResponse.json(
        { error: '脚本内容不能为空' },
        { status: 400 }
      );
    }

    console.log('[Generate Description API] Generating description, hasTemplate:', !!template_base64);

    const response = await fetch(`${BACKEND_URL}/api/batch/generate-description`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        narration: script,
        visual_hint: '',
        full_context: null,
        current_index: 1,
        custom_prompt: custom_prompt || null,
        template_base64: template_base64 || null,
      }),
    });

    const result = await response.json();

    if (!result.success || !result.data?.description) {
      console.error('[Generate Description API] Failed:', result.message);
      return NextResponse.json(
        { error: result.message || '描述生成失败' },
        { status: 500 }
      );
    }

    console.log('[Generate Description API] Success');
    return NextResponse.json({
      description: result.data.description,
    });

  } catch (error: any) {
    console.error('Description generation error:', error);
    return NextResponse.json(
      { error: error.message || '描述生成失败，请稍后重试' },
      { status: 500 }
    );
  }
}
