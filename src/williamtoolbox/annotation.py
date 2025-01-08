import re
import os
from typing import List, Dict, Optional
import byzerllm
from docx.oxml import parse_xml
from docx import Document
from pydantic import BaseModel
import json


class Annotation(BaseModel):
    text: str
    comment: str


class DocText(BaseModel):
    doc_name: str
    doc_text: str
    annotations: List[Annotation]


class DocPath(BaseModel):
    doc_path: str


def extract_text_from_docx(file_path: str) -> str:
    doc = Document(file_path)
    return '\n'.join([paragraph.text for paragraph in doc.paragraphs])


def extract_annotations_from_docx(file_path: str) -> List[Dict[str, str]]:
    # Define namespace manually
    NAMESPACE = {
        'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
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


def process_docx_files(directory: str) -> List[DocText]:
    """
    遍历指定目录中的所有 .docx 文件，提取文本和注释

    Args:
        directory: 要遍历的目录路径

    Returns:
        包含所有文档文本和注释的 DocText 对象列表
    """
    doc_texts = []

    for root, _, files in os.walk(directory):
        for file in files:
            # 跳过隐藏文件
            if file.startswith(('.', '~$')):
                continue

            if file.endswith('.docx'):
                file_path = os.path.join(root, file)
                try:
                    text = extract_text_from_docx(file_path)
                    annotations = extract_annotations_from_docx(file_path)
                    doc_texts.append(DocText(
                        doc_name=file_path,
                        doc_text=text,
                        annotations=[Annotation(**a) for a in annotations]
                    ))
                except Exception as e:
                    print(f"Error processing file {file_path}: {str(e)}")
                    continue

    return doc_texts


@byzerllm.prompt()
def generate_annotations(text: str, examples: List[DocText]) -> str:
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


@byzerllm.prompt()
def query_rag(text: str):
    '''
    给定一个带标准的文档，返回和该文档最像的文档对应的路径。

    下面是等待查询的文档：
    <text>
    {{ text }}
    </text>

    请返回和该文档最像的文档对应的路径，返回格式为：

    ```json
    [
        {
            "doc_path": "path/to/doc.docx"
        }
    ]
    ```

    最多只返回一条记录。
    '''


from fastapi import HTTPException
from openai import AsyncOpenAI
from loguru import logger
from ..server.json_file import load_config

async def auto_generate_annotations(rag_name: str, doc: str) -> List[DocText]:
    # 获取配置
    config = await load_config()
    
    # 获取RAG信息
    rags = await load_rags_from_json()
    if rag_name not in rags:
        raise HTTPException(status_code=404, detail=f"RAG {rag_name} not found")
    
    rag_info = rags[rag_name]
    
    # 初始化OpenAI客户端
    host = rag_info.get("host", "localhost")
    port = rag_info.get("port", 8000)
    if host == "0.0.0.0":
        host = "127.0.0.1"

    base_url = f"http://{host}:{port}/v1"
    client = AsyncOpenAI(base_url=base_url, api_key="xxxx")

    try:
        # 调用RAG服务生成批注
        response = await client.chat.completions.create(
            model=rag_info.get("model", "deepseek_chat"),
            messages=[{"role": "user", "content": doc}],
            stream=False,
            max_tokens=4096
        )
        
        # 处理响应
        result = response.choices[0].message.content
        annotations = extract_annotations(result)
        return DocText(doc_name="", doc_text=doc, annotations=annotations)
        
    except Exception as e:
        logger.error(f"Error generating annotations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
