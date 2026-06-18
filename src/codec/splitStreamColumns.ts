/** 仅切分「未被反斜杠修饰」的管道符；切分后再还原字段内字面量 */
export function splitStreamColumns(line: string): string[] {
  return line
    .split(/(?<!\\)\|/)
    .map((col) => col.replace(/\\\|/g, '|'));
}
