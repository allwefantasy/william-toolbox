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

@router.get("/auto-coder-chat/validate-and-load", response_model=ValidationResponse)
async def validate_and_load_queries(path: str):
    # 验证路径是否存在
    if not os.path.exists(path):
        return ValidationResponse(
            success=False,
            message="项目路径不存在"
        )
    
    # 检查必要的目录
    if not os.path.exists(os.path.join(path, "actions")) or \
       not os.path.exists(os.path.join(path, ".auto-coder")):
        return ValidationResponse(
            success=False,
            message="无效的 auto-coder.chat 项目：缺少 actions 或 .auto-coder 目录"
        )
    
    queries = []
    auto_coder_dir = os.path.join(path, "actions")
    
    # 遍历actions目录下的所有yaml文件
    try:
        for root, _, files in os.walk(auto_coder_dir):
            for file in files:
                if file.endswith(('chat_action.yml')):
                    file_path = os.path.join(root, file)
                    with open(file_path, 'r', encoding='utf-8') as f:
                        try:
                            yaml_content = yaml.safe_load(f)
                            if isinstance(yaml_content, dict) and 'query' in yaml_content:
                                # 使用文件修改时间作为时间戳
                                timestamp = datetime.fromtimestamp(
                                    os.path.getmtime(file_path)
                                ).strftime('%Y-%m-%d %H:%M:%S')
                                
                                queries.append(Query(
                                    query=yaml_content['query'],
                                    timestamp=timestamp
                                ))
                        except yaml.YAMLError:
                            continue
    
        # 按时间戳排序
        queries.sort(key=lambda x: x.timestamp or '', reverse=True)
        
        return ValidationResponse(
            success=True,
            queries=queries
        )
    
    except Exception as e:
        return ValidationResponse(
            success=False,
            message=f"读取项目文件时出错: {str(e)}"
        )