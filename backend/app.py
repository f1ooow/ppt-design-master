"""
PPT设计大师 后端 - Flask 应用入口
"""
import os
import logging
from flask import Flask
from flask_cors import CORS
from config import Config

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def create_app():
    """创建 Flask 应用"""
    app = Flask(__name__)
    app.config.from_object(Config)

    # CORS 配置
    CORS(app, origins=Config.CORS_ORIGINS, supports_credentials=True)

    # 确保上传和输出目录存在
    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(Config.OUTPUT_FOLDER, exist_ok=True)

    # 注册蓝图
    from controllers.batch_controller import batch_bp
    from controllers.export_controller import export_bp

    app.register_blueprint(batch_bp, url_prefix='/api/batch')
    app.register_blueprint(export_bp, url_prefix='/api/export')

    # 健康检查端点
    @app.route('/health')
    def health():
        return {'status': 'ok', 'service': 'ppt-designer-backend'}

    # 根路由
    @app.route('/')
    def index():
        return {
            'name': 'PPT设计大师 Backend',
            'version': '1.0.0',
            'endpoints': {
                'health': '/health',
                'batch': '/api/batch/*',
                'export': '/api/export/*'
            }
        }

    return app


if __name__ == '__main__':
    app = create_app()
    port = Config.PORT
    logger.info(f"Starting PPT设计大师 backend on port {port}")
    app.run(host='0.0.0.0', port=port, debug=Config.DEBUG)
