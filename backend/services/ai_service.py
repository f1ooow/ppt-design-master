"""
AI 服务 - 文字使用 cottonapi，图片使用 nanobana (privnode)
提示词统一由前端管理并通过 custom_prompt 参数传递
"""
import re
import logging
import base64
import httpx
from typing import Optional
from openai import OpenAI

from config import Config

logger = logging.getLogger(__name__)


class AIService:
    """AI 服务类"""

    def __init__(self):
        """初始化 AI 服务"""
        # 文字处理客户端 (cottonapi)
        self.text_client = OpenAI(
            api_key=Config.TEXT_API_KEY,
            base_url=Config.TEXT_API_BASE,
            timeout=120.0
        )
        self.text_model = Config.TEXT_MODEL

        # 图片生成配置 (nanobana/privnode)
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
        logger.info(f"[文字API] 生成页面描述，镜号: {shot_number}, 有模板: {template_base64 is not None}")

        try:
            # 如果有模板图片，使用多模态消息
            if template_base64:
                messages = [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": template_base64}
                            }
                        ]
                    }
                ]
            else:
                messages = [{"role": "user", "content": prompt}]

            response = self.text_client.chat.completions.create(
                model=self.text_model,
                messages=messages
            )
            description = response.choices[0].message.content
            logger.info(f"[文字API] 描述生成成功，长度: {len(description)}")
            return description
        except Exception as e:
            logger.error(f"[文字API] 生成页面描述失败: {e}")
            raise

    def generate_image(self, prompt: str, aspect_ratio: str = "16:9",
                       template_base64: str = None) -> Optional[str]:
        """
        使用 nanobana API 生成图片

        Args:
            prompt: 图片描述
            aspect_ratio: 宽高比
            template_base64: 模板图片的 base64 数据（可选）

        Returns:
            base64 编码的图片数据
        """
        url = f"{self.image_api_base}/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.image_api_key}",
            "Content-Type": "application/json"
        }

        # 构建消息内容
        if template_base64:
            # 有模板：使用多模态消息，让 AI 参考模板生成
            logger.info(f"[图片API] 使用模板生成图片")
            message_content = [
                {
                    "type": "text",
                    "text": f"""生成一张PPT页面图片。

【强制要求 - 背景和边框必须完全复制】
仔细观察模板图片，以下元素必须与模板保持一致：
1. 背景设计（纯色/渐变/图案）- 完全复制，不能改变
2. 边框样式（如果有）- 完全复制，不能省略或修改
3. 页面角落/边缘的固定装饰元素 - 完全复制

把模板当作"画框"，画框必须一模一样，只有里面的内容可以变化。

【可以灵活变化的部分】
- 标题和正文的具体文字
- 插画的具体内容（但风格要与模板统一）
- 文字和插画的布局位置

【内容质量要求】
1. 图文并茂：必须有精美的插画配图
2. 禁止简陋：不能只有文字框、方块图、简单图标
3. 插画要求：具体的、有细节的插画，与内容主题相关

【页面内容】
{prompt}

16:9比例，直接生成图片。"""
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": template_base64
                    }
                }
            ]
        else:
            # 无模板：纯文本提示
            message_content = f"""生成一张专业的PPT幻灯片图片，16:9比例。

【核心原则 - 必须严格遵守】
1. **图文并茂是第一原则**：页面必须包含精美的插画/配图，文字和图片各占约50%视觉比重
2. **禁止纯文字页面**：绝对不能只有文字框、方块图、简单图标，必须有真实的、精美的插画
3. **插画要求**：使用具体的、有细节的插画（人物、场景、物品），不要简单图标

【内容要求】
{prompt}

直接生成图片，不要输出文字。"""

        payload = {
            "model": self.image_model,
            "messages": [
                {
                    "role": "user",
                    "content": message_content
                }
            ],
            "aspect_ratio": aspect_ratio
        }

        logger.info(f"[图片API] 生成图片，prompt长度: {len(prompt)}, 比例: {aspect_ratio}, 有模板: {template_base64 is not None}")

        try:
            with httpx.Client(timeout=None) as client:  # 无超时限制
                response = client.post(url, json=payload, headers=headers)
                response.raise_for_status()

                result = response.json()

                # 从响应中提取图片
                if "choices" in result and len(result["choices"]) > 0:
                    content = result["choices"][0]["message"]["content"]

                    # 提取 base64 图片数据
                    base64_match = re.search(
                        r'data:image/(jpeg|png|jpg|webp);base64,([A-Za-z0-9+/=]+)',
                        content
                    )

                    if base64_match:
                        image_format = base64_match.group(1)
                        base64_data = base64_match.group(2)
                        logger.info(f"[图片API] 图片生成成功，格式: {image_format}")
                        return f"data:image/{image_format};base64,{base64_data}"

                    # 尝试 URL 格式
                    url_match = re.search(r'!\[.*?\]\((https?://[^\s\)]+)\)', content)
                    if url_match:
                        image_url = url_match.group(1)
                        logger.info(f"[图片API] 下载图片: {image_url[:50]}...")
                        img_response = client.get(image_url)
                        img_response.raise_for_status()
                        image_data = base64.b64encode(img_response.content).decode('utf-8')
                        return f"data:image/png;base64,{image_data}"

                    logger.error(f"[图片API] 无法从响应中提取图片: {content[:200]}")
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
        prompt = custom_prompt.replace('{{script}}', narration)
        if description:
            prompt = prompt.replace('{{description}}', description)
        logger.info(f"[图片API] 使用自定义提示词生成PPT图片，类型: {page_type}")

        return self.generate_image(prompt, aspect_ratio, template_base64)

    def extract_illustration(self, cropped_image_base64: str) -> Optional[str]:
        """
        从裁剪的图片中提取插画并重新生成

        Args:
            cropped_image_base64: 裁剪后的图片 base64 数据

        Returns:
            生成的插画 base64 数据
        """
        url = f"{self.image_api_base}/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.image_api_key}",
            "Content-Type": "application/json"
        }

        prompt = """请仔细观察这张PPT中被裁剪出的插画区域，然后重新生成一张相似风格但更精美的插画。

要求：
1. 保持与原图相似的主题和内容
2. 提升画面质量和细节
3. 保持扁平化/矢量风格
4. 输出正方形图片
5. 背景透明或简洁

直接生成图片，不要输出任何文字说明。"""

        payload = {
            "model": self.image_model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": cropped_image_base64}}
                    ]
                }
            ],
            "aspect_ratio": "1:1"
        }

        logger.info(f"[图片API] 提取插画")

        try:
            with httpx.Client(timeout=None) as client:
                response = client.post(url, json=payload, headers=headers)
                response.raise_for_status()

                result = response.json()

                if "choices" in result and len(result["choices"]) > 0:
                    content = result["choices"][0]["message"]["content"]

                    # 提取 base64 图片数据
                    base64_match = re.search(
                        r'data:image/(jpeg|png|jpg|webp);base64,([A-Za-z0-9+/=]+)',
                        content
                    )

                    if base64_match:
                        image_format = base64_match.group(1)
                        base64_data = base64_match.group(2)
                        logger.info(f"[图片API] 插画提取成功，格式: {image_format}")
                        return f"data:image/{image_format};base64,{base64_data}"

                    # 尝试 URL 格式
                    url_match = re.search(r'!\[.*?\]\((https?://[^\s\)]+)\)', content)
                    if url_match:
                        image_url = url_match.group(1)
                        logger.info(f"[图片API] 下载提取的插画: {image_url[:50]}...")
                        img_response = client.get(image_url)
                        img_response.raise_for_status()
                        image_data = base64.b64encode(img_response.content).decode('utf-8')
                        return f"data:image/png;base64,{image_data}"

                    logger.error(f"[图片API] 无法从响应中提取插画: {content[:200]}")
                    return None
                else:
                    logger.error(f"[图片API] 非预期响应格式: {result}")
                    return None

        except httpx.HTTPStatusError as e:
            logger.error(f"[图片API] HTTP 错误 {e.response.status_code}: {e.response.text[:200]}")
            raise
        except Exception as e:
            logger.error(f"[图片API] 提取插画失败: {e}")
            raise


# 单例实例
_ai_service: Optional[AIService] = None


def get_ai_service() -> AIService:
    """获取 AI 服务单例"""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service
