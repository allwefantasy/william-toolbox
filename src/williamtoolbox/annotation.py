import re
from typing import List, Dict
import byzerllm
from docx.oxml import parse_xml
from docx import Document
from pydantic import BaseModel


class Annotation(BaseModel):    
    text: str
    comment: str
class DocText(BaseModel):
    doc_text: str
    annotations: List[Annotation]

def extract_text_from_docx(file_path: str) -> str:
    doc = Document(file_path)    
    return '\n'.join([paragraph.text for paragraph in doc.paragraphs])


def extract_annotations_from_docx(file_path: str) -> List[Dict[str, str]]:  
    # Define namespace manually
    NAMESPACE = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    COMMENTS_REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments"

    document = Document(file_path)
    annotations = []

    # Extract comments from the document
    comments = {}
    if document.part.rels:
        for rel in document.part.rels.values():
            if rel.reltype == COMMENTS_REL_TYPE:
                comments_part = rel.target_part
                comments_xml = parse_xml(comments_part.blob)
                for comment in comments_xml.findall(".//w:comment", namespaces=NAMESPACE):
                    comment_id = comment.attrib.get(f'{{{NAMESPACE["w"]}}}id')
                    if comment_id:
                        comment_text = ''.join(comment.itertext()).strip()
                        comments[comment_id] = comment_text

    # Match comments to paragraphs
    for paragraph in document.paragraphs:
        paragraph_xml = paragraph._element
        for comment_start in paragraph_xml.findall(".//w:commentRangeStart", namespaces=NAMESPACE):
            comment_id = comment_start.attrib.get(f'{{{NAMESPACE["w"]}}}id')
            if comment_id and comment_id in comments:
                annotations.append({
                    'text': paragraph.text.strip(),
                    'comment': comments[comment_id]
                })

    return annotations

def extract_annotations(text: str) -> List[Dict[str, str]]:
    '''
    Extract annotations from the text.
    Args:
        text: The text with annotations in the format [[[text]]] and <<<comment>>>
    Returns:
        A list of dictionaries with keys 'text' and 'comment'
    '''
    annotations = []
    pattern = r'\[\[\[(.*?)\]\]\]\s*<<<(.*?)>>>'
    matches = re.finditer(pattern, text)
    
    for match in matches:
        annotations.append({
            'text': match.group(1).strip(),
            'comment': match.group(2).strip()
        })
    
    return annotations


@byzerllm.prompt()
def generate_annotations(text: str,examples: List[DocText]) -> str:
    '''
    给定一个文本，我们会对里面的特定内容做批注。
    
    下面是历史批注内容：

    <history>
    {% for example in examples %}
    原始文本：
    <text>
    {{ example.doc_text }}
    </text>
    
    批注：
    {% for annotation in example.annotations %} 
    [[[{{ annotation.text }}]]]<<<{{ annotation.comment }}>>>
    {% endfor %}
    {% endfor %}
    </history>


    请参考历史批注，模仿批注的：
    1. 语气和风格
    2. 批注的角度
    3. 关注的内容点      

    下面是等待批注的文本：
    <text>
    {{ text }}
    </text>

    请你理解文本的含义，模仿上面示例生成对带批注的内容进行批注。
    规则：
    1. 用 [[[]]] 括住需要批注的文本
    2. 紧跟着用 <<<>>> 括住对该文本的批注内容
    3. 批注要简明扼要，突出重点  
    '''


from typing import List, Dict, Any
from pathlib import Path
import asyncio
from concurrent.futures import ThreadPoolExecutor
from loguru import logger

async def process_directory(directory_path: str) -> List[Dict[str, Any]]:
    """
    处理指定目录中的所有 .docx 文件，返回包含文档内容和注释的集合
    
    Args:
        directory_path: 要处理的目录路径
        
    Returns:
        包含所有文档内容和注释的列表，每个元素是一个字典，包含 full_text 和 comments
    """
    docx_files = list(Path(directory_path).glob("*.docx"))
    if not docx_files:
        logger.warning(f"No .docx files found in directory: {directory_path}")
        return []

    results = []
    executor = ThreadPoolExecutor(max_workers=4)
    loop = asyncio.get_event_loop()

    try:
        # 使用线程池并发处理所有 .docx 文件
        tasks = []
        for docx_file in docx_files:
            task = loop.run_in_executor(
                executor,
                _process_single_docx,
                str(docx_file)
            )
            tasks.append(task)

        # 等待所有任务完成
        results = await asyncio.gather(*tasks)
    except Exception as e:
        logger.error(f"Error processing directory {directory_path}: {str(e)}")
        raise
    finally:
        executor.shutdown(wait=True)

    return results

def _process_single_docx(file_path: str) -> Dict[str, Any]:
    """
    处理单个 .docx 文件
    
    Args:
        file_path: .docx 文件路径
        
    Returns:
        包含文档内容和注释的字典
    """
    try:
        full_text = extract_text_from_docx(file_path)
        comments = extract_annotations_from_docx(file_path)
        return {
            "file_path": file_path,
            "full_text": full_text,
            "comments": comments
        }
    except Exception as e:
        logger.error(f"Error processing file {file_path}: {str(e)}")
        raise