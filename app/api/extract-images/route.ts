import { NextRequest, NextResponse } from 'next/server';
import { createGeminiClient } from '@/lib/gemini/gemini-client';
import { validateImageApiConfig } from '@/config/gemini';
import { ExtractImagesResponse, ApiConfig } from '@/types';

/**
 * POST /api/extract-images
 * 从裁剪后的图片提取插画
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { croppedImageBase64, apiConfig } = body;

    // 验证输入
    if (!croppedImageBase64) {
      return NextResponse.json(
        { error: '裁剪图片不能为空' } as ExtractImagesResponse,
        { status: 400 }
      );
    }

    // 验证配置
    if (!apiConfig || !validateImageApiConfig(apiConfig as ApiConfig)) {
      return NextResponse.json(
        { error: '图像 API 配置无效' } as ExtractImagesResponse,
        { status: 400 }
      );
    }

    // 创建客户端
    const client = createGeminiClient(apiConfig as ApiConfig);

    // 提取单个插画
    const image = await client.extractSingleImage(croppedImageBase64);

    return NextResponse.json({
      image,
    });

  } catch (error: any) {
    console.error('Image extraction error:', error);

    return NextResponse.json(
      {
        error: error.message || '配图提取失败，请稍后重试',
        images: [],
      } as ExtractImagesResponse,
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
