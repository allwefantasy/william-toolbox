import re
from typing import List, Dict
import byzerllm
from docx import Document

def extract_annotations_from_docx(file_path: str) -> List[Dict[str, str]]:
    '''
    Extract annotations from a docx document.
    Args:
        file_path: Path to the docx file
    Returns:
        A list of dictionaries with keys 'text' and 'comment'
    '''
    doc = Document(file_path)
    annotations = []
    
    # Get all comments from the document
    comments = {}
    try:
        # Use doc.part.element to access the root element
        root = doc.part.element
        comments_part = root.xpath('.//w:comment', 
            namespaces={'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'})
        
        for comment in comments_part:
            comment_id = comment.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}id')
            comment_text = ''.join([node.text for node in comment.itertext()])
            comments[comment_id] = comment_text
    except Exception as e:
        print(f"Error extracting comments: {e}")
        return annotations
        
    # Find annotated text with comments
    for paragraph in doc.paragraphs:
        # Get all comment references in this paragraph
        comment_refs = paragraph._element.xpath('.//w:commentReference',
            namespaces={'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'})
        
        for comment_ref in comment_refs:
            try:
                comment_id = comment_ref.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}id')
                if comment_id in comments:
                    # Get the text range that this comment applies to
                    start = comment_ref.getparent()
                    if start is not None:
                        # Collect all text within the same run
                        text_elements = start.xpath('.//w:t',
                            namespaces={'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'})
                        annotated_text = ''.join([elem.text for elem in text_elements if elem.text])
                        
                        if annotated_text and comments[comment_id]:
                            annotations.append({
                                'text': annotated_text.strip(),
                                'comment': comments[comment_id].strip()
                            })
            except Exception as e:
                print(f"Error processing comment reference: {e}")
                continue
    
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

