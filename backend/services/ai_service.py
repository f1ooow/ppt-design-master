"""
AI 服务 - 文字和图片统一使用 Gemini 原生 API
提示词统一由前端管理并通过 custom_prompt 参数传递
"""
import re
import logging
import base64
import httpx
from typing import Optional

from config import Config

logger = logging.getLogger(__name__)


def extract_chinese_content(text: str) -> str:
    """
    从模型输出中提取纯中文内容，过滤掉英文思考过程
    """
    if not text:
        return text

    # 按行分割
    lines = text.strip().split('\n')
    chinese_lines = []

    for line in lines:
        line = line.strip()
        if not line:
            continue
        # 跳过纯英文行（包括 markdown 标题）
        if re.match(r'^[\*#\s]*[A-Za-z][A-Za-z\s\-\*#:,\.\'\"]+$', line):
            continue
        # 跳过以英文开头的句子（思考过程）
        if re.match(r'^(Okay|So|Let|I\'m|The|That|Here|This|Now|First|But|It|Done|Alright)', line):
            continue
        # 保留包含中文的行
        if re.search(r'[\u4e00-\u9fff]', line):
            chinese_lines.append(line)

    return '\n'.join(chinese_lines).strip() if chinese_lines else text


class AIService:
    """AI 服务类"""

    def __init__(self):
        """初始化 AI 服务"""
        # 文字处理配置 (Gemini 原生 API)
        self.text_api_base = Config.TEXT_API_BASE
        self.text_api_key = Config.TEXT_API_KEY
        self.text_model = Config.TEXT_MODEL

        # 图片生成配置 (Gemini 原生 API)
        self.image_api_base = Config.IMAGE_API_BASE
        self.image_api_key = Config.IMAGE_API_KEY
        self.image_model = Config.IMAGE_MODEL

    def generate_page_description(self, shot_number: str, segment: str,
                                   narration: str, visual_hint: str = None,
                                   full_context: str = None, current_index: int = None,
                                   custom_prompt: str = None, template_base64: str = None) -> str:
        """
        生成页面描述

        Args:
            shot_number: 镜号
            segment: 环节
            narration: 讲稿内容
            visual_hint: 画面提示（可选）
            full_context: 完整脚本上下文（可选）
            current_index: 当前页索引（可选）
            custom_prompt: 自定义提示词（必须由前端传递）
            template_base64: 模板图片base64（可选，有模板时分析风格）

        Returns:
            生成的页面描述
        """
        # 必须提供自定义提示词
        if not custom_prompt:
            raise ValueError("必须提供 custom_prompt 参数，提示词由前端统一管理")

        # 使用自定义提示词并替换变量
        prompt = custom_prompt.replace('{{narration}}', narration)
        if visual_hint:
            prompt = prompt.replace('{{visual_hint}}', visual_hint)

        # 在 prompt 开头添加强制指令
        prompt = f"【重要】直接输出最终结果，禁止输出任何思考过程、分析步骤、英文内容。\n\n{prompt}"
        logger.info(f"[文字API] 生成页面描述，镜号: {shot_number}, 有模板: {template_base64 is not None}")

        # 使用配置的模型
        desc_model = self.text_model
        url = f"{self.text_api_base}/v1beta/models/{desc_model}:generateContent"
        headers = {
            "x-goog-api-key": self.text_api_key,
            "Content-Type": "application/json"
        }

        # 构建请求内容
        parts = [{"text": prompt}]

        # 如果有模板图片，添加到 parts
        if template_base64:
            if template_base64.startswith('data:'):
                match = re.match(r'data:(image/[^;]+);base64,(.+)', template_base64)
                if match:
                    mime_type = match.group(1)
                    image_data = match.group(2)
                    parts.append({
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": image_data
                        }
                    })
                else:
                    logger.warning(f"[文字API] 模板图片 data URL 格式无效，跳过模板")

        payload = {
            "systemInstruction": {
                "parts": [{"text": "你只输出最终结果，不输出任何思考过程、分析步骤或英文内容。直接给出答案。"}]
            },
            "contents": [{"parts": parts}],
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 2048
            }
        }

        try:
            with httpx.Client(timeout=120.0) as client:
                response = client.post(url, json=payload, headers=headers)
                response.raise_for_status()

                result = response.json()

                # 提取文本响应
                if "candidates" in result and len(result["candidates"]) > 0:
                    candidate = result["candidates"][0]
                    if "content" in candidate and "parts" in candidate["content"]:
                        for part in candidate["content"]["parts"]:
                            if "text" in part:
                                description = part["text"]
                                logger.info(f"[文字API] 描述生成成功，长度: {len(description)}")
                                return description

                logger.error(f"[文字API] 响应中没有文本数据")
                raise ValueError("API 响应中没有文本数据")

        except httpx.HTTPStatusError as e:
            logger.error(f"[文字API] HTTP 错误 {e.response.status_code}: {e.response.text[:200]}")
            raise
        except Exception as e:
            logger.error(f"[文字API] 生成页面描述失败: {e}")
            raise

    def generate_image(self, prompt: str, aspect_ratio: str = "16:9",
                       template_base64: str = None) -> Optional[str]:
        """
        使用 Gemini 原生 API 生成图片

        Args:
            prompt: 图片描述
            aspect_ratio: 宽高比
            template_base64: 模板图片的 base64 数据（可选）

        Returns:
            base64 编码的图片数据
        """
        url = f"{self.image_api_base}/v1beta/models/{self.image_model}:generateContent"
        headers = {
            "x-goog-api-key": self.image_api_key,
            "Content-Type": "application/json"
        }

        # 构建 Gemini 原生格式的请求
        parts = []

        # 构建提示词
        if template_base64:
            logger.info(f"[图片API] 使用模板生成图片")
            text_prompt = f"""生成一张PPT页面图片。

【强制要求 - 背景和边框必须完全复制】
仔细观察模板图片，以下元素必须与模板保持一致：
1. 背景设计（纯色/渐变/图案）- 完全复制，不能改变
2. 边框样式（如果有）- 完全复制，不能省略或修改
3. 页面角落/边缘的固定装饰元素 - 完全复制

把模板当作"画框"，画框必须一模一样，只有里面的内容可以变化。

【文字排版要有设计感】
- 标题用醒目字体，可以有色块背景
- 要点文字用卡片/色块/圆角框/标签承载，不要裸露直接打字
- 每个要点配小图标
- 文字不要直接打在空白处

【内容质量要求】
1. 图文并茂：必须有精美的配图/图示
2. 禁止简陋：不能只有文字框、简单方块
3. 插画风格要与模板统一

【页面内容】
{prompt}

16:9比例，直接生成图片。"""

            parts.append({"text": text_prompt})

            # 添加模板图片
            if template_base64.startswith('data:'):
                # 提取 mime_type 和 base64 数据
                match = re.match(r'data:(image/[^;]+);base64,(.+)', template_base64)
                if match:
                    mime_type = match.group(1)
                    image_data = match.group(2)
                    parts.append({
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": image_data
                        }
                    })
                else:
                    logger.warning(f"[图片API] 模板图片 data URL 格式无效，跳过模板")
        else:
            text_prompt = f"""生成一张专业的PPT幻灯片图片，16:9比例。

【文字排版要有设计感】
- 标题用醒目字体，可以有色块背景
- 要点文字用卡片/色块/圆角框/标签承载，不要裸露直接打字
- 每个要点配小图标
- 文字不要直接打在空白处

【内容质量要求】
1. 图文并茂：页面必须包含精美的配图/图示，文字和图片各占约50%
2. 禁止纯文字页面：绝对不能只有文字框、简单图标
3. 使用具体的、有细节的插画（人物、场景、物品）

【内容要求】
{prompt}

直接生成图片，不要输出文字。"""
            parts.append({"text": text_prompt})

        payload = {
            "contents": [{
                "parts": parts
            }],
            "generationConfig": {
                "responseModalities": ["TEXT", "IMAGE"],
                "imageConfig": {
                    "aspectRatio": "16:9",
                    "imageSize": "2K"
                }
            }
        }

        logger.info(f"[图片API] 生成图片，prompt长度: {len(prompt)}, 比例: {aspect_ratio}, 有模板: {template_base64 is not None}")

        try:
            # 图片生成可能需要较长时间，设置 5 分钟超时
            with httpx.Client(timeout=300.0) as client:
                response = client.post(url, json=payload, headers=headers)
                response.raise_for_status()

                result = response.json()

                # 从 Gemini 响应中提取图片
                if "candidates" in result and len(result["candidates"]) > 0:
                    candidate = result["candidates"][0]
                    if "content" in candidate and "parts" in candidate["content"]:
                        for part in candidate["content"]["parts"]:
                            if "inlineData" in part:
                                mime_type = part["inlineData"].get("mimeType", "image/png")
                                image_data = part["inlineData"]["data"]
                                logger.info(f"[图片API] 图片生成成功，格式: {mime_type}")
                                return f"data:{mime_type};base64,{image_data}"

                    logger.error(f"[图片API] 响应中没有图片数据")
                    return None
                else:
                    logger.error(f"[图片API] 非预期响应格式: {result}")
                    return None

        except httpx.HTTPStatusError as e:
            logger.error(f"[图片API] HTTP 错误 {e.response.status_code}: {e.response.text[:200]}")
            raise
        except Exception as e:
            logger.error(f"[图片API] 生成图片失败: {e}")
            raise

    def generate_ppt_image(self, narration: str, description: str = None,
                           page_type: str = "content",
                           aspect_ratio: str = "16:9",
                           template_base64: str = None,
                           custom_prompt: str = None) -> Optional[str]:
        """
        生成 PPT 页面图片

        Args:
            narration: 讲稿内容
            description: 页面描述（可选，如果没有则根据 narration 生成）
            page_type: 页面类型 (cover/content/ending)
            aspect_ratio: 宽高比
            template_base64: 模板图片的 base64 数据（可选）
            custom_prompt: 自定义提示词（必须由前端传递）

        Returns:
            base64 编码的图片
        """
        # 必须提供自定义提示词
        if not custom_prompt:
            raise ValueError("必须提供 custom_prompt 参数，提示词由前端统一管理")

        # 使用自定义提示词并替换变量
        # 同时支持 {{script}} 和 {{narration}} 两种变量名
        prompt = custom_prompt.replace('{{script}}', narration).replace('{{narration}}', narration)
        if description:
            prompt = prompt.replace('{{description}}', description)
        logger.info(f"[图片API] 使用自定义提示词生成PPT图片，类型: {page_type}")

        return self.generate_image(prompt, aspect_ratio, template_base64)

    def _call_gemini_image_api(self, prompt: str, image_base64: str = None,
                                 log_action: str = "处理图片") -> Optional[str]:
        """
        通用的 Gemini 图片生成 API 调用

        Args:
            prompt: 提示词
            image_base64: 输入图片的 base64 数据（可选）
            log_action: 日志中的操作描述

        Returns:
            生成的图片 base64 数据
        """
        url = f"{self.image_api_base}/v1beta/models/{self.image_model}:generateContent"
        headers = {
            "x-goog-api-key": self.image_api_key,
            "Content-Type": "application/json"
        }

        parts = [{"text": prompt}]

        # 如果有输入图片，添加到 parts
        if image_base64:
            if image_base64.startswith('data:'):
                match = re.match(r'data:(image/[^;]+);base64,(.+)', image_base64)
                if match:
                    mime_type = match.group(1)
                    image_data = match.group(2)
                    parts.append({
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": image_data
                        }
                    })
                else:
                    logger.warning(f"[图片API] 输入图片 data URL 格式无效，跳过图片")

        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {
                "responseModalities": ["TEXT", "IMAGE"],
                "imageConfig": {
                    "aspectRatio": "16:9",
                    "imageSize": "2K"
                }
            }
        }

        logger.info(f"[图片API] {log_action}")

        try:
            # 图片生成可能需要较长时间，设置 5 分钟超时
            with httpx.Client(timeout=300.0) as client:
                response = client.post(url, json=payload, headers=headers)
                response.raise_for_status()

                result = response.json()

                if "candidates" in result and len(result["candidates"]) > 0:
                    candidate = result["candidates"][0]
                    if "content" in candidate and "parts" in candidate["content"]:
                        for part in candidate["content"]["parts"]:
                            if "inlineData" in part:
                                mime_type = part["inlineData"].get("mimeType", "image/png")
                                image_data = part["inlineData"]["data"]
                                logger.info(f"[图片API] {log_action}成功，格式: {mime_type}")
                                return f"data:{mime_type};base64,{image_data}"

                    logger.error(f"[图片API] 响应中没有图片数据")
                    return None
                else:
                    logger.error(f"[图片API] 非预期响应格式: {result}")
                    return None

        except httpx.HTTPStatusError as e:
            logger.error(f"[图片API] HTTP 错误 {e.response.status_code}: {e.response.text[:200]}")
            raise
        except Exception as e:
            logger.error(f"[图片API] {log_action}失败: {e}")
            raise

    def extract_illustration(self, cropped_image_base64: str) -> Optional[str]:
        """
        从裁剪的图片中提取插画并重新生成

        Args:
            cropped_image_base64: 裁剪后的图片 base64 数据

        Returns:
            生成的插画 base64 数据
        """
        prompt = """请仔细观察这张PPT中被裁剪出的插画区域，然后重新生成一张相似风格但更精美的插画。

要求：
1. 保持与原图相似的主题和内容
2. 提升画面质量和细节
3. 保持扁平化/矢量风格
4. 输出正方形图片
5. 背景透明或简洁

直接生成图片，不要输出任何文字说明。"""

        return self._call_gemini_image_api(prompt, cropped_image_base64, "提取插画")

    def remove_template_background(self, image_base64: str) -> Optional[str]:
        """
        去除PPT图片中的模板背景元素，只保留核心设计内容

        Args:
            image_base64: 原始PPT图片的 base64 数据

        Returns:
            去除背景后的图片 base64 数据
        """
        prompt = """请仔细观察这张PPT图片，然后重新生成一张只包含核心内容的图片。

要求：
1. 去除所有模板装饰元素：外框、标题栏装饰、背景图案、边框、角落装饰等
2. 保留所有核心内容：标题文字、正文内容、插图、图标、数据图表
3. 背景改为纯白色
4. 保持原有内容的布局位置和大小
5. 保持原有的字体风格和颜色
6. 保持16:9比例

直接生成图片，不要输出任何文字说明。"""

        return self._call_gemini_image_api(prompt, image_base64, "去除模板背景")

    def clean_slide_image(self, image_base64: str) -> Optional[str]:
        """
        清洗PPT图片：去除模板装饰和文字，保留核心内容

        Args:
            image_base64: 原始PPT图片的 base64 数据

        Returns:
            清洗后的图片 base64 数据
        """
        prompt = """请仔细观察这张PPT图片，然后重新生成一张干净的图片。

【必须去除的内容】
1. PPT模板装饰：页眉页脚、角落装饰、边框线条、标题栏装饰
2. 所有文字内容：标题、正文、标签、说明文字等
3. 背景图案：渐变背景、纹理背景、装饰性背景

【必须保留的内容】
1. 核心插图：人物、场景、物品等主体插画
2. 图标元素：功能图标、示意图标
3. 数据可视化：图表、流程图、示意图（去掉其中的文字标签）
4. 文本框/色块框架：保留文本框的形状和颜色，只去除里面的文字
5. 装饰性插画元素

【输出要求】
1. 整体背景改为纯白色
2. 保持原有插图和元素的位置、大小
3. 保持原有的风格和色彩
4. 保持16:9比例
5. 如果页面只有文字没有任何插图，则输出纯白图片

直接生成图片，不要输出任何文字说明。"""

        return self._call_gemini_image_api(prompt, image_base64, "清洗PPT图片")


# 单例实例和锁
_ai_service: Optional[AIService] = None
_ai_service_lock = __import__('threading').Lock()


def get_ai_service() -> AIService:
    """获取 AI 服务单例（线程安全）"""
    global _ai_service
    if _ai_service is None:
        with _ai_service_lock:
            # 双重检查锁定
            if _ai_service is None:
                _ai_service = AIService()
    return _ai_service
