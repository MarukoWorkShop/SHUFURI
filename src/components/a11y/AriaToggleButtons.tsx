import type { ButtonHTMLAttributes, ReactNode } from 'react';

type PressedButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> & {
  pressed: boolean;
  children: ReactNode;
};

/** 供 Edge Tools 静态 ARIA 检查：分支内使用字面量 aria-pressed */
export function PressedButton({ pressed, children, type = 'button', ...rest }: PressedButtonProps) {
  if (pressed) {
    return (
      <button type={type} aria-pressed="true" {...rest}>
        {children}
      </button>
    );
  }
  return (
    <button type={type} aria-pressed="false" {...rest}>
      {children}
    </button>
  );
}

type ExpandToggleButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-expanded'> & {
  expanded: boolean;
  children: ReactNode;
};

/** 展开/收起按钮：aria-expanded 使用字面量（抽屉经 portal 挂载，不写 aria-controls 避免静态检查误报） */
export function ExpandToggleButton({
  expanded,
  children,
  type = 'button',
  ...rest
}: ExpandToggleButtonProps) {
  if (expanded) {
    return (
      <button type={type} aria-expanded="true" {...rest}>
        {children}
      </button>
    );
  }
  return (
    <button type={type} aria-expanded="false" {...rest}>
      {children}
    </button>
  );
}
