"""
任务队列管理器
使用 ThreadPoolExecutor 实现并发控制
参考 banana-slides 架构
"""
import uuid
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import List, Dict, Any, Optional, Callable
from threading import Lock

from config import Config
from .file_parser import ScriptPage, PageStatus

logger = logging.getLogger(__name__)


class TaskStatus(str, Enum):
    """任务状态"""
    PENDING = "pending"
    PARSING = "parsing"
    GENERATING_DESCRIPTIONS = "generating_descriptions"
    GENERATING_IMAGES = "generating_images"
    COMPLETED = "completed"
    ERROR = "error"
    CANCELLED = "cancelled"


@dataclass
class BatchTask:
    """批量任务"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    status: TaskStatus = TaskStatus.PENDING
    pages: List[ScriptPage] = field(default_factory=list)
    total_pages: int = 0
    completed_pages: int = 0
    current_phase: str = ""  # 当前阶段描述
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    error_message: str = ""
    output_path: str = ""  # 导出文件路径

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'id': self.id,
            'name': self.name,
            'status': self.status.value,
            'pages': [p.to_dict() for p in self.pages],
            'total_pages': self.total_pages,
            'completed_pages': self.completed_pages,
            'current_phase': self.current_phase,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'error_message': self.error_message,
            'output_path': self.output_path,
            'progress': self.progress
        }

    @property
    def progress(self) -> float:
        """计算进度百分比"""
        if self.total_pages == 0:
            return 0.0
        return round(self.completed_pages / self.total_pages * 100, 1)


class TaskManager:
    """任务管理器"""

    def __init__(self):
        self._tasks: Dict[str, BatchTask] = {}
        self._lock = Lock()
        self._desc_executor = ThreadPoolExecutor(
            max_workers=Config.MAX_DESCRIPTION_WORKERS,
            thread_name_prefix="desc_worker"
        )
        self._image_executor = ThreadPoolExecutor(
            max_workers=Config.MAX_IMAGE_WORKERS,
            thread_name_prefix="image_worker"
        )

    def create_task(self, name: str, pages: List[ScriptPage]) -> BatchTask:
        """创建新任务"""
        task = BatchTask(
            name=name,
            pages=pages,
            total_pages=len(pages)
        )
        with self._lock:
            self._tasks[task.id] = task
        logger.info(f"创建任务: {task.id}, 共 {len(pages)} 页")
        return task

    def get_task(self, task_id: str) -> Optional[BatchTask]:
        """获取任务"""
        return self._tasks.get(task_id)

    def get_all_tasks(self) -> List[BatchTask]:
        """获取所有任务"""
        return list(self._tasks.values())

    def update_task_status(self, task_id: str, status: TaskStatus,
                           phase: str = "", error: str = ""):
        """更新任务状态"""
        task = self.get_task(task_id)
        if task:
            task.status = status
            task.current_phase = phase
            task.error_message = error
            task.updated_at = datetime.now()
            logger.info(f"任务 {task_id} 状态更新: {status.value}, {phase}")

    def update_page_status(self, task_id: str, page_index: int,
                           status: PageStatus, **kwargs):
        """更新页面状态"""
        task = self.get_task(task_id)
        if task and 0 <= page_index < len(task.pages):
            page = task.pages[page_index]
            page.status = status
            for key, value in kwargs.items():
                if hasattr(page, key):
                    setattr(page, key, value)

            # 更新完成计数
            if status == PageStatus.COMPLETED:
                task.completed_pages = sum(
                    1 for p in task.pages if p.status == PageStatus.COMPLETED
                )
            task.updated_at = datetime.now()

    def run_descriptions_generation(self, task_id: str,
                                     generate_func: Callable[[ScriptPage], str]):
        """
        并发生成页面描述

        Args:
            task_id: 任务 ID
            generate_func: 描述生成函数，接收 ScriptPage 返回描述文本
        """
        task = self.get_task(task_id)
        if not task:
            return

        self.update_task_status(task_id, TaskStatus.GENERATING_DESCRIPTIONS,
                                "正在生成页面描述...")

        def process_page(page: ScriptPage) -> tuple:
            """处理单个页面"""
            try:
                page.status = PageStatus.GENERATING_DESC
                description = generate_func(page)
                page.description = description
                page.status = PageStatus.PENDING  # 等待图片生成
                return page.index, True, description
            except Exception as e:
                page.status = PageStatus.ERROR
                page.error_message = str(e)
                return page.index, False, str(e)

        # 提交所有任务
        futures = {
            self._desc_executor.submit(process_page, page): page
            for page in task.pages
        }

        # 收集结果
        completed = 0
        for future in as_completed(futures):
            idx, success, result = future.result()
            completed += 1
            task.current_phase = f"生成描述中 ({completed}/{task.total_pages})"
            if success:
                logger.debug(f"页面 {idx} 描述生成成功")
            else:
                logger.warning(f"页面 {idx} 描述生成失败: {result}")

        task.updated_at = datetime.now()
        logger.info(f"任务 {task_id} 描述生成完成")

    def run_images_generation(self, task_id: str,
                               generate_func: Callable[[ScriptPage], str]):
        """
        并发生成图片

        Args:
            task_id: 任务 ID
            generate_func: 图片生成函数，接收 ScriptPage 返回图片路径
        """
        task = self.get_task(task_id)
        if not task:
            return

        self.update_task_status(task_id, TaskStatus.GENERATING_IMAGES,
                                "正在生成图片...")

        def process_page(page: ScriptPage) -> tuple:
            """处理单个页面"""
            try:
                page.status = PageStatus.GENERATING_IMAGE
                image_path = generate_func(page)
                page.image_path = image_path
                page.status = PageStatus.COMPLETED
                return page.index, True, image_path
            except Exception as e:
                page.status = PageStatus.ERROR
                page.error_message = str(e)
                return page.index, False, str(e)

        # 只处理有描述的页面
        pages_to_process = [p for p in task.pages if p.description]

        # 提交所有任务
        futures = {
            self._image_executor.submit(process_page, page): page
            for page in pages_to_process
        }

        # 收集结果
        completed = 0
        for future in as_completed(futures):
            idx, success, result = future.result()
            completed += 1
            task.completed_pages = completed
            task.current_phase = f"生成图片中 ({completed}/{len(pages_to_process)})"
            if success:
                logger.debug(f"页面 {idx} 图片生成成功: {result}")
            else:
                logger.warning(f"页面 {idx} 图片生成失败: {result}")

        task.updated_at = datetime.now()
        self.update_task_status(task_id, TaskStatus.COMPLETED, "任务完成")
        logger.info(f"任务 {task_id} 图片生成完成")

    def cancel_task(self, task_id: str):
        """取消任务"""
        task = self.get_task(task_id)
        if task and task.status not in [TaskStatus.COMPLETED, TaskStatus.CANCELLED]:
            self.update_task_status(task_id, TaskStatus.CANCELLED, "任务已取消")

    def delete_task(self, task_id: str) -> bool:
        """删除任务"""
        with self._lock:
            if task_id in self._tasks:
                del self._tasks[task_id]
                return True
        return False

    def shutdown(self):
        """关闭执行器"""
        self._desc_executor.shutdown(wait=False)
        self._image_executor.shutdown(wait=False)


# 单例实例
_task_manager: Optional[TaskManager] = None


def get_task_manager() -> TaskManager:
    """获取任务管理器单例"""
    global _task_manager
    if _task_manager is None:
        _task_manager = TaskManager()
    return _task_manager
