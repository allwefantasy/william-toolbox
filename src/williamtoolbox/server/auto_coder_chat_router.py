from fastapi import APIRouter, HTTPException
import os
import yaml
import subprocess
from typing import List, Optional
from datetime import datetime
from pathlib import Path
from pydantic import BaseModel
from loguru import logger
import re
import git
from typing import Optional, Dict, Union, List
from pydantic import BaseModel

import hashlib
import traceback
import json

router = APIRouter()

class Query(BaseModel):
    query: str
    timestamp: Optional[str] = None

class ValidationResponse(BaseModel):
    success: bool
    message: str = ""
    queries: List[Query] = []


class QueryWithFileNumber(BaseModel):
    query: str
    timestamp: Optional[str] = None
    file_number: int  # 新增文件编号字段
    response: Optional[str] = None  # auto_coder_开头的文件名+md5值
    urls: Optional[List[str]] = None  # 添加urls字段

class ValidationResponseWithFileNumbers(BaseModel):
    success: bool
    message: str = ""
    queries: List[QueryWithFileNumber] = []

class FileContentResponse(BaseModel):
    success: bool
    message: str = ""
    content: Optional[str] = None

class FileChange(BaseModel):
    path: str  
    change_type: str   # "added" 或 "modified"

class CommitDiffResponse(BaseModel):
    success: bool
    message: str = ""
    diff: Optional[str] = None
    file_changes: Optional[List[FileChange]] = None

@router.get("/auto-coder-chat/commit-diff/{response_id}", response_model=CommitDiffResponse)
async def get_commit_diff(path: str, response_id: str):
    """根据response_id获取对应的git commit diff"""
    logger.info(f"开始处理commit diff请求 - 路径: {path}, response_id: {response_id}")
    
    if not os.path.exists(path):
        logger.error(f"项目路径不存在: {path}")
        return CommitDiffResponse(
            success=False,
            message="项目路径不存在"
        )

    try:
        logger.info("初始化Git仓库")
        repo = git.Repo(path)
        logger.info(f"Git仓库初始化成功: {repo.git_dir}")

        # 查找包含特定response message的commit
        search_pattern = f"{response_id}"
        logger.info(f"开始搜索commit - 搜索模式: {search_pattern}")
        
        matching_commits = []
        for commit in repo.iter_commits():
            if search_pattern in commit.message:
                matching_commits.append(commit)
                logger.info(f"找到匹配的commit: {commit.hexsha} - {commit.message[:100]}")
        
        if not matching_commits:
            logger.warning(f"未找到匹配的commit: {response_id}")
            return CommitDiffResponse(
                success=False,
                message=f"找不到对应的commit: {response_id}"
            )
        
        # 使用第一个匹配的commit
        target_commit = matching_commits[0]
        logger.info(f"使用commit: {target_commit.hexsha}")
        
        # 获取diff
        # 获取变更的文件列表
        file_changes = []
        if target_commit.parents:
            parent = target_commit.parents[0]
            logger.info(f"对比commit {target_commit.hexsha[:8]} 与其父commit {parent.hexsha[:8]}")
            diff = repo.git.diff(parent.hexsha, target_commit.hexsha)
            
            # 获取变更的文件
            diff_index = parent.diff(target_commit)
            
            for diff_item in diff_index:
                if diff_item.new_file:
                    file_changes.append(FileChange(
                        path=diff_item.b_path,
                        change_type="added"
                    ))
                else:
                    file_changes.append(FileChange(
                        path=diff_item.b_path,
                        change_type="modified"
                    ))
        else:
            logger.info("这是初始commit，获取完整diff")
            diff = repo.git.show(target_commit.hexsha)
            
            # 对于初始commit,所有文件都是新增的
            for item in target_commit.tree.traverse():
                if item.type == 'blob':  # 只处理文件,不处理目录
                    file_changes.append(FileChange(
                        path=item.path,
                        change_type="added"
                    ))
        
        logger.info("成功获取diff内容和文件变更列表")
        logger.debug(f"Diff内容预览: {diff[:200]}...")
        logger.debug(f"变更文件数量: {len(file_changes)}")
        
        return CommitDiffResponse(
            success=True,
            diff=diff,
            file_changes=file_changes
        )
        
    except git.exc.GitCommandError as e:
        error_msg = f"Git命令执行错误: {str(e)}"
        logger.error(error_msg)
        logger.error(f"Git命令详细错误: {e.stderr}")
        return CommitDiffResponse(
            success=False,
            message=error_msg
        )
    except Exception as e:
        error_msg = f"获取commit diff时出错: {str(e)}"
        logger.error(error_msg)
        logger.error(f"详细错误信息: {traceback.format_exc()}")
        return CommitDiffResponse(
            success=False,
            message=error_msg
        )

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
                                    
                                    # 从yaml内容中获取urls字段,如果不存在则为空列表
                                    urls = yaml_content.get('urls', [])
                                    
                                    queries.append(QueryWithFileNumber(
                                        query=yaml_content['query'],
                                        timestamp=timestamp,
                                        file_number=file_number,
                                        response=response_str,
                                        urls=urls
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

@router.get("/auto-coder-chat/json-history")
async def get_json_chat_history(path: str):
    """
    Retrieve and return the chat history JSON from an auto-coder project
    """
    try:
        # Validate the path
        if not os.path.isdir(path):
            return {"success": False, "message": "无效的目录路径"}
        
        # Check for .auto-coder directory
        history_path = os.path.join(path, ".auto-coder", "memory", "chat_history.json")
        if not os.path.isfile(history_path):
            return {"success": False, "message": "未找到聊天历史文件"}
        
        # Read and parse the JSON file
        with open(history_path, 'r', encoding='utf-8') as f:
            chat_history = json.load(f)
        
        return {"success": True, "chatHistory": chat_history}
    except Exception as e:
        return {"success": False, "message": str(e)}