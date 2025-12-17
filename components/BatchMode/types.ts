// 批量模式类型定义
import { CourseMetadata } from '@/types';

export interface ScriptPage {
  id: string;
  index: number;
  shot_number: string;
  segment: string;
  narration: string;
  visual_hint: string;
  description: string;
  image_path: string;
  image_base64?: string;  // 当前选中的图片 base64
  image_versions?: string[];  // 所有版本的图片
  selected_version?: number;  // 当前选中的版本索引（从0开始）
  status: 'pending' | 'generating_desc' | 'generating_image' | 'completed' | 'error';
  error_message: string;
  pageType?: 'cover' | 'ending' | 'content';  // 页面类型：封面、片尾、正文
}

// Excel解析结果（包含课程元信息）
export interface ParsedExcelResult {
  pages: ScriptPage[];
  courseMetadata: CourseMetadata;
}

export interface BatchTask {
  id: string;
  name: string;
  status: 'pending' | 'parsing' | 'generating_descriptions' | 'generating_images' | 'completed' | 'error' | 'cancelled';
  pages: ScriptPage[];
  total_pages: number;
  completed_pages: number;
  current_phase: string;
  created_at: string;
  updated_at: string;
  error_message: string;
  output_path: string;
  progress: number;
}

// 步骤类型
export type BatchStep = 'upload' | 'description' | 'image';
