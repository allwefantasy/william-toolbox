from fastapi import APIRouter, HTTPException
import os
import yaml
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

router = APIRouter()

class Query(BaseModel):
    query: str
    timestamp: Optional[str] = None

class ValidationResponse(BaseModel):
    success: bool
    message: str = ""
    queries: List[Query] = []

import re
from typing import Optional, Dict, Union, List
from pydantic import BaseModel

import hashlib

class QueryWithFileNumber(BaseModel):
    query: str
    timestamp: Optional[str] = None
    file_number: int  # 新增文件编号字段
    response: Optional[str] = None  # auto_coder_开头的文件名+md5值

class ValidationResponseWithFileNumbers(BaseModel):
    success: bool
    message: str = ""
    queries: List[QueryWithFileNumber] = []

class FileContentResponse(BaseModel):
    success: bool
    message: str = ""
    content: Optional[str] = None

@router.get("/auto-coder-chat/validate-and-load", response_model=ValidationResponseWithFileNumbers)
async def validate_and_load_queries(path: str):
    # 验证路径是否存在
    if not os.path.exists(path):
        return ValidationResponseWithFileNumbers(
            success=False,
            message="项目路径不存在"
        )
    
    # 检查必要的目录
    if not os.path.exists(os.path.join(path, "actions")) or \
       not os.path.exists(os.path.join(path, ".auto-coder")):
        return ValidationResponseWithFileNumbers(
            success=False,
            message="无效的 auto-coder.chat 项目：缺少 actions 或 .auto-coder 目录"
        )
    
    queries = []
    auto_coder_dir = os.path.join(path, "actions")
    
    # 遍历actions目录下的所有yaml文件
    try:
        for root, _, files in os.walk(auto_coder_dir):
            for file in files:
                if file.endswith('chat_action.yml'):
                    file_path = os.path.join(root, file)
                    # 提取文件名中的数字部分
                    match = re.match(r'(\d+)_chat_action\.yml', file)
                    if match:
                        file_number = int(match.group(1))
                        with open(file_path, 'r', encoding='utf-8') as f:
                            try:
                                yaml_content = yaml.safe_load(f)
                                if isinstance(yaml_content, dict) and 'query' in yaml_content:
                                    # 使用文件修改时间作为时间戳
                                    timestamp = datetime.fromtimestamp(
                                        os.path.getmtime(file_path)
                                    ).strftime('%Y-%m-%d %H:%M:%S')
                                    
                                    # 计算文件内容的md5值
                                    file_md5 = hashlib.md5(open(file_path, 'rb').read()).hexdigest()
                                    response_str = f"auto_coder_{file}_{file_md5}"
                                    
                                    queries.append(QueryWithFileNumber(
                                        query=yaml_content['query'],
                                        timestamp=timestamp,
                                        file_number=file_number,
                                        response=response_str
                                    ))
                            except yaml.YAMLError:
                                continue
    
        # 按时间戳排序
        queries.sort(key=lambda x: x.timestamp or '', reverse=True)
        
        return ValidationResponseWithFileNumbers(
            success=True,
            queries=queries
        )
    
    except Exception as e:
        return ValidationResponseWithFileNumbers(
            success=False,
            message=f"读取项目文件时出错: {str(e)}"
        )

@router.get("/auto-coder-chat/file-content/{file_number}", response_model=FileContentResponse)
async def get_file_content(path: str, file_number: int):
    """获取指定编号文件的完整内容"""
    if not os.path.exists(path):
        return FileContentResponse(
            success=False,
            message="项目路径不存在"
        )
        
    auto_coder_dir = os.path.join(path, "actions")
    file_name = f"{file_number}_chat_action.yml"
    file_path = ""
    
    # 搜索文件
    for root, _, files in os.walk(auto_coder_dir):
        if file_name in files:
            file_path = os.path.join(root, file_name)
            break
            
    if not file_path:
        return FileContentResponse(
            success=False,
            message=f"找不到文件: {file_name}"
        )
        
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return FileContentResponse(
            success=True,
            content=content
        )
    except Exception as e:
        return FileContentResponse(
            success=False, 
            message=f"读取文件出错: {str(e)}"
        )