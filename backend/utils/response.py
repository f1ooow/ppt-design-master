"""
统一响应格式工具
"""
from flask import jsonify
from typing import Any, Optional


def success_response(data: Any = None, message: str = "success") -> tuple:
    """成功响应"""
    return jsonify({
        'success': True,
        'message': message,
        'data': data
    }), 200


def error_response(message: str, code: int = 400, details: Optional[Any] = None) -> tuple:
    """错误响应"""
    response = {
        'success': False,
        'message': message
    }
    if details:
        response['details'] = details
    return jsonify(response), code


def created_response(data: Any = None, message: str = "created") -> tuple:
    """创建成功响应"""
    return jsonify({
        'success': True,
        'message': message,
        'data': data
    }), 201
