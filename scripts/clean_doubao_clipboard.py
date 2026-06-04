#!/usr/bin/env python3
"""
清理从豆包粘贴到剪贴板的污染文本。

用途：
  手机端豆包输出的结构化歌词文本可能被错误添加 Python 代码前缀
  （如 "import re"、代码块围栏、校验输出痕迹等），导致粘贴后格式
  无法匹配。本脚本智能识别并定位标准格式起始标记（===BEGIN===），
  自动截断并删除前面的无效前缀，同时清理混入的 Python 执行痕迹，
  输出纯净的结构化文本。
"""

import re
import sys


# ── 标记常量 ──────────────────────────────────────────────
BEGIN_MARKER = "===BEGIN==="
LYRICS_MARKER = "===LYRICS==="
VOCAB_MARKER = "===VOCAB==="
GRAMMAR_MARKER = "===GRAMMAR==="
END_MARKER = "===END==="

ALL_SECTION_MARKERS = (
    BEGIN_MARKER,
    LYRICS_MARKER,
    VOCAB_MARKER,
    GRAMMAR_MARKER,
    END_MARKER,
)

# 豆包校验输出常见痕迹
PYTHON_TRACE_PATTERNS = [
    # Python import 语句
    r'^import\s+\w+\b',
    r'^from\s+\w+\s+import\b',
    # Python 注释
    r'^#\s*(?:TODO|FIXME|HACK|NOTE|import|from|def\s|class\s)',
    # print / 校验输出
    r'^print\s*\(',
    r'^>>>',                       # REPL prompt
    r'^\.\.\.',                    # REPL continuation
    r'^In\s*\[\d+\]:',             # Jupyter prompt
    r'^Out\s*\[\d+\]:',            # Jupyter output
    # 校验失败 / 警告
    r'⚠️\s*校验失败',
    r'⚠️\s*校验',
    r'校验失败',
    r'校验通过',
    r'检测到.*错误',
    r'未通过.*校验',
    # 代码块围栏
    r'^```\w*$',
    # python 文件名
    r'\.py\b',
    # 其他常见 traces
    r'^Traceback\s',
    r'^File\s+"[^"]+\.py"',
    r'^\s*\^+$',                   # syntax error pointer
    r'^SyntaxError',
    r'^TypeError',
    r'^ValueError',
]

# 豆包输出中可能混入的提示句
TRACE_SENTENCES = [
    '以下是处理后的',
    '处理结果如下',
    '校验输出',
    '执行结果',
    '输出内容',
    '导入成功',
    '运行成功',
    '已处理',
    '已校验',
]


def strip_python_prefix(text: str) -> str:
    """
    定位第一个有效标记（===BEGIN=== 或 ===LYRICS===），
    截断其前面的所有内容。

    使用行级精确匹配，避免把 Python 代码字符串中
    出现的片段（如 `===BEGIN===')`）误判为有效标记。
    """
    lines = text.split('\n')

    # 逐行查找第一个标记行
    for i, line in enumerate(lines):
        stripped = line.strip()

        # 精确匹配：行的去空白内容恰好是标记，或标记后跟空白/行尾
        if re.match(r'^===BEGIN===\s*$', stripped, re.IGNORECASE):
            return '\n'.join(lines[i:])

        if re.match(r'^===LYRICS===\s*$', stripped, re.IGNORECASE):
            # 补上 BEGIN 标记
            return BEGIN_MARKER + '\n' + '\n'.join(lines[i:])

    # 都没找到，返回原始文本
    return text


def remove_code_fences(text: str) -> str:
    """移除 Markdown 代码块围栏（```python ... ```）"""
    # 移除开头的 ```python 等
    text = re.sub(r'^```(?:\w+)?\s*\n?', '', text, flags=re.MULTILINE)
    # 移除结尾的 ```
    text = re.sub(r'\n?```\s*$', '', text)
    return text


def remove_python_trace_lines(text: str) -> str:
    """逐行过滤，删除 Python 执行痕迹行"""
    lines = text.split('\n')
    cleaned: list[str] = []
    in_section = False

    for line in lines:
        stripped = line.strip()

        # 一旦进入有效区段，标记 in_section
        if stripped.upper().startswith(('===BEGIN===', '===LYRICS===',
                                          '===VOCAB===', '===GRAMMAR===',
                                          '===END===')):
            in_section = True
            cleaned.append(line)
            continue

        # 在区段外部（还没进入有效内容），跳过一切可疑行
        if not in_section:
            # 跳过 Python 代码行
            if _is_python_trace(stripped):
                continue
            # 跳过提示句
            if _is_trace_sentence(stripped):
                continue
            # 跳过空行或纯符号行
            if not stripped or re.match(r'^[-=_*#]{3,}$', stripped):
                continue
            # 非格式化内容但在有效内容前，保留（可能是标题行）
            cleaned.append(line)
            continue

        # 在有效区段内部，过滤混入的校验输出
        if _is_python_trace(stripped) or _is_trace_sentence(stripped):
            continue

        cleaned.append(line)

    return '\n'.join(cleaned)


def _is_python_trace(line: str) -> bool:
    """判断某行是否为 Python 执行痕迹"""
    if not line:
        return False
    for pattern in PYTHON_TRACE_PATTERNS:
        if re.search(pattern, line, re.IGNORECASE):
            return True
    return False


def _is_trace_sentence(line: str) -> bool:
    """判断某行是否为豆包输出的提示句"""
    if not line:
        return False
    for sentence in TRACE_SENTENCES:
        if sentence in line:
            return True
    return False


def normalize_whitespace(text: str) -> str:
    """规范化空白：合并多余空行，去掉首尾空白"""
    # 3+ 空行 → 2 空行
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def clean(text: str) -> str:
    """
    主清理函数：
    1. 去除 Markdown 代码块围栏
    2. 定位并截断到有效起始标记
    3. 清理 Python 执行痕迹
    4. 规范化空白
    5. 确保结尾有 ===END===
    """
    text = remove_code_fences(text)
    text = strip_python_prefix(text)
    text = remove_python_trace_lines(text)
    text = normalize_whitespace(text)

    # 确保以 ===END=== 结尾（如果内容有效但缺少结尾标记）
    if (BEGIN_MARKER in text.upper() or LYRICS_MARKER in text.upper()) \
            and not text.rstrip().upper().endswith(END_MARKER):
        # 找到最后一个有效块标记的位置
        last_marker_pos = -1
        for marker in ALL_SECTION_MARKERS:
            pos = text.rfind(marker)
            if pos > last_marker_pos:
                last_marker_pos = pos
        # 截断到最后一个合法标记之后，再补 ===END===
        if last_marker_pos > -1:
            last_marker_end = last_marker_pos + len(
                text[last_marker_pos:].split('\n')[0]
            )
            text = text[:last_marker_end].rstrip() + '\n' + END_MARKER

    return text


# ── CLI ────────────────────────────────────────────────────
def main():
    if len(sys.argv) > 1:
        # 从文件读取
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            raw = f.read()
    else:
        # 从 stdin 读取
        print("请粘贴豆包输出的文本，完成后按 Ctrl+D (Linux/Mac) 或 Ctrl+Z (Windows) 结束：\n")
        raw = sys.stdin.read()

    if not raw.strip():
        print('错误：输入为空', file=sys.stderr)
        sys.exit(1)

    result = clean(raw)

    if len(sys.argv) > 2:
        # 输出到文件
        with open(sys.argv[2], 'w', encoding='utf-8') as f:
            f.write(result)
        print(f'✅ 已清理并保存到 {sys.argv[2]}')
    else:
        # 输出到 stdout
        print(result)


if __name__ == '__main__':
    main()
