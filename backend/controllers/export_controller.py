"""
导出控制器
处理 PPTX 导出等 API
"""
import os
import logging
from flask import Blueprint, request, send_file

from utils.response import success_response, error_response
from services.task_manager import get_task_manager, TaskStatus
from services.export_service import get_export_service

logger = logging.getLogger(__name__)

export_bp = Blueprint('export', __name__)


@export_bp.route('/<task_id>/pptx', methods=['POST'])
def export_pptx(task_id: str):
    """
    导出任务为 PPTX 文件

    Args:
        task_id: 任务 ID

    Request body (optional):
        {
            "include_notes": true,  # 是否包含讲稿备注
            "output_name": "自定义文件名"
        }
    """
    task_manager = get_task_manager()
    task = task_manager.get_task(task_id)

    if not task:
        return error_response("任务不存在", 404)

    if task.status != TaskStatus.COMPLETED:
        return error_response(f"任务未完成，当前状态: {task.status.value}", 400)

    # 获取请求参数
    data = request.get_json() or {}
    include_notes = data.get('include_notes', True)
    output_name = data.get('output_name', task.name or task_id)

    try:
        export_service = get_export_service()

        # 检查是否有图片
        pages_with_images = [p for p in task.pages if p.image_path and os.path.exists(p.image_path)]

        if not pages_with_images:
            return error_response("没有可导出的图片，请先生成图片", 400)

        output_path = export_service.export_to_pptx(
            pages=pages_with_images,
            output_name=output_name,
            include_notes=include_notes
        )

        # 更新任务输出路径
        task.output_path = output_path

        return success_response({
            'output_path': output_path,
            'pages_exported': len(pages_with_images)
        }, "PPTX 导出成功")

    except Exception as e:
        logger.error(f"PPTX 导出失败: {e}")
        return error_response(f"导出失败: {str(e)}", 500)


@export_bp.route('/<task_id>/download', methods=['GET'])
def download_pptx(task_id: str):
    """
    下载 PPTX 文件

    Args:
        task_id: 任务 ID
    """
    task_manager = get_task_manager()
    task = task_manager.get_task(task_id)

    if not task:
        return error_response("任务不存在", 404)

    if not task.output_path or not os.path.exists(task.output_path):
        return error_response("文件不存在，请先导出", 404)

    return send_file(
        task.output_path,
        as_attachment=True,
        download_name=os.path.basename(task.output_path)
    )


@export_bp.route('/<task_id>/images', methods=['POST'])
def export_images(task_id: str):
    """
    仅导出图片到文件夹

    Args:
        task_id: 任务 ID
    """
    task_manager = get_task_manager()
    task = task_manager.get_task(task_id)

    if not task:
        return error_response("任务不存在", 404)

    if task.status != TaskStatus.COMPLETED:
        return error_response(f"任务未完成，当前状态: {task.status.value}", 400)

    try:
        export_service = get_export_service()
        output_dir = export_service.export_images_only(
            pages=task.pages,
            output_name=task.name or task_id
        )

        return success_response({
            'output_dir': output_dir
        }, "图片导出成功")

    except Exception as e:
        logger.error(f"图片导出失败: {e}")
        return error_response(f"导出失败: {str(e)}", 500)
