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

    # CORS - 生产环境应通过环境变量配置具体域名
    # 开发环境默认允许 localhost，生产环境必须显式配置
    _cors_env = os.getenv('CORS_ORIGINS', '')
    if _cors_env:
        CORS_ORIGINS = _cors_env.split(',')
    elif DEBUG:
        # 开发环境允许本地访问
        CORS_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000']
    else:
        # 生产环境如果未配置则禁止跨域
        CORS_ORIGINS = []

    # 文字处理 API (Gemini 原生 API)
    # 注意：必须通过环境变量配置，不要在代码中硬编码密钥
    TEXT_API_KEY = os.getenv('TEXT_API_KEY', '')
    TEXT_API_BASE = os.getenv('TEXT_API_BASE', '')
    TEXT_MODEL = os.getenv('TEXT_MODEL', 'gemini-3-flash-preview')

    # 图片生成 API (Gemini 原生 API)
    IMAGE_API_KEY = os.getenv('IMAGE_API_KEY', '')
    IMAGE_API_BASE = os.getenv('IMAGE_API_BASE', '')
    IMAGE_MODEL = os.getenv('IMAGE_MODEL', 'gemini-3-pro-image-preview')

    # 并发配置
    MAX_DESCRIPTION_WORKERS = int(os.getenv('MAX_DESCRIPTION_WORKERS', 5))
    MAX_IMAGE_WORKERS = int(os.getenv('MAX_IMAGE_WORKERS', 4))

    # 文件上传
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB

    # 输出目录
    OUTPUT_FOLDER = os.getenv('OUTPUT_FOLDER', 'outputs')
