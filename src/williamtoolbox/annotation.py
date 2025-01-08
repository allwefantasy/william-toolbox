import re
from typing import List, Dict
import byzerllm
from docx import Document

import zipfile
import xml.etree.ElementTree as ET
from typing import List, Dict

def extract_annotations_from_docx(file_path: str) -> List[Dict[str, str]]:
    '''
    Extract annotations from a docx document using zipfile and xml parsing.
    Args:
        file_path: Path to the docx file
    Returns:
        A list of dictionaries with keys 'text' and 'comment'
    '''
    annotations = []
    
    try:
        # Open the docx file as a zip archive
        with zipfile.ZipFile(file_path, 'r') as docx:
            # Read comments.xml from the docProps folder
            comments_xml = docx.read('docProps/comments.xml')
            # Read document.xml from the word folder
            document_xml = docx.read('word/document.xml')
            
        # Parse comments
        comments_root = ET.fromstring(comments_xml)
        comments = {}
        for comment in comments_root.findall('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}comment'):
            comment_id = comment.get('id')
            comment_text = ''.join(comment.itertext())
            comments[comment_id] = comment_text.strip()
            
        # Parse document to find comment references
        doc_root = ET.fromstring(document_xml)
        for comment_ref in doc_root.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}commentReference'):
            comment_id = comment_ref.get('id')
            if comment_id in comments:
                # Find the parent run and get its text
                parent_run = comment_ref.getparent()
                if parent_run is not None:
                    text_elements = parent_run.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t')
                    annotated_text = ''.join([elem.text for elem in text_elements if elem.text])
                    
                    if annotated_text:
                        annotations.append({
                            'text': annotated_text.strip(),
                            'comment': comments[comment_id]
                        })
                        
    except Exception as e:
        print(f"Error extracting annotations: {e}")
    
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
def generate_annotations(text: str,examples: List[Dict[str, str]]) -> str:
    '''
    根据输入的内容，帮我生成批注。请你理解文本的含义，对重要的部分进行批注。
    规则：
    1. 用 [[[]]] 括住需要批注的文本
    2. 紧跟着用 <<<>>> 括住对该文本的批注内容
    3. 批注要简明扼要，突出重点
    4. 每段文字可以有多个批注
    
    示例：
    输入：Python是一个高级编程语言，以其简洁的语法和丰富的生态系统而闻名。
    输出：Python是一个高级编程语言，以其[[[简洁的语法和丰富的生态系统]]]<<<Python的两个主要特点>>>而闻名。

    下面是历史批注内容：

    <history>
    {% for example in examples %}
    
    {% endfor %}
    </history>

    下面是等待批注的文本：
    <text>
    {{ text }}
    </text>

    请根据历史批注内容，生成新的批注内容。
    '''

