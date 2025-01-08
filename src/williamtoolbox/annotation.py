import re
from typing import List, Dict
import byzerllm


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
def generate_annotations(text: str) -> str:
    '''
    根据输入的内容，帮我生成批注。请你理解文本的含义，对重要的部分进行批注。
    规则：
    1. 用 [[[]]] 括住需要批注的文本
    2. 紧跟着用 <<<>>> 括住对该文本的批注内容
    3. 批注要简明扼要，突出重点
    4. 每段文字可以有多个批注
    
    示例：
    输入：Python是一个高级编程语言，以其简洁的语法和丰富的生态系统而闻名。
    输出：[[[Python]]] <<<一个高级编程语言>>> [[[简洁的语法和丰富的生态系统]]] <<<Python的两个主要特点>>>

    输入文本如下：
    {{ text }}
    '''

@byzerllm.prompt()
def generate_summary_from_annotations(annotations: List[Dict[str, str]]) -> str:
    '''
    根据提供的批注生成一个总结。
    Args:
        annotations: A list of dictionaries with keys 'text' and 'comment'

    对以下批注生成一个总结：
    {% for anno in annotations %}
    - 原文: {{ anno.text }}
    - 批注: {{ anno.comment }}
    {% endfor %}    
    '''    