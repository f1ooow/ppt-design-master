"""
后端配置文件
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """应用配置"""

    # Flask
    SECRET_KEY = os.getenv('SECRET_KEY', 'ppt-designer-secret-key')
    DEBUG = os.getenv('FLASK_ENV', 'production') == 'development'

    # 服务端口
    PORT = int(os.getenv('PORT', 5000))

    # CORS
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*').split(',')

    # 文字处理 API (cottonapi)
    TEXT_API_KEY = os.getenv('TEXT_API_KEY', 'sk-V5qeMJn0hTs1zr205WO6Zu0D29Y6VM1y4kGbZ9f31HFLj4i5')
    TEXT_API_BASE = os.getenv('TEXT_API_BASE', 'https://cottonapi.cloud/v1')
    TEXT_MODEL = os.getenv('TEXT_MODEL', 'gemini-2.0-flash-exp')

    # 图片生成 API (nanobana/privnode)
    IMAGE_API_KEY = os.getenv('IMAGE_API_KEY', 'sk-oSyrVIvzQNs0A6XNpGhes2BNe8xNZgiZq6ZCJfHiO0jvMlkA')
    IMAGE_API_BASE = os.getenv('IMAGE_API_BASE', 'https://privnode.com')
    IMAGE_MODEL = os.getenv('IMAGE_MODEL', 'gemini-3-pro-image-preview-2k')

    # 并发配置
    MAX_DESCRIPTION_WORKERS = int(os.getenv('MAX_DESCRIPTION_WORKERS', 5))
    MAX_IMAGE_WORKERS = int(os.getenv('MAX_IMAGE_WORKERS', 4))

    # 文件上传
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB

    # 输出目录
    OUTPUT_FOLDER = os.getenv('OUTPUT_FOLDER', 'outputs')
