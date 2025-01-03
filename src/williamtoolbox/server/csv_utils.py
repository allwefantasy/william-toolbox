from byzerllm.utils.client import code_utils
from loguru import logger
from fastapi import HTTPException

def extract_csv_from_markdown(content: str) -> dict:
    """Extract CSV content from markdown code block"""
    try:
        code_blocks = code_utils.extract_code(content)
        for code_block in code_blocks:
            if code_block[0] == "csv":
                return {"csv_content": code_block[1]}
        return {"csv_content": ""}
    except Exception as e:
        logger.error(f"Failed to extract CSV: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to extract CSV content")