import { Container, Text, isKeyRelease, matchesKey } from "@earendil-works/pi-tui";

export interface ChoiceOption {
  label: string;
  description?: string;
  value: string;
}

export interface ChoiceParams {
  question: string;
  options: ChoiceOption[];
  allowCustomResponse?: boolean;
}

export interface ChoiceSelection {
  value: string;
  label: string;
  index: number;
}

export class SimpleChoiceList extends Container {
  private selectedIndex = 0;
  private readonly items: ChoiceOption[];
  private readonly onSelect: (selection: ChoiceSelection) => void;
  private readonly onCancel: () => void;

  constructor(
    items: ChoiceOption[],
    question: string,
    onSelect: (selection: ChoiceSelection) => void,
    onCancel: () => void
  ) {
    super();
    this.items = items;
    this.onSelect = onSelect;
    this.onCancel = onCancel;

    this.addChild(new Text(`\n? ${question}\n`, 1, 0));
    this.updateRender();
  }

  private updateRender(): void {
    // Clear dynamic children after the question
    while (this.children.length > 1) {
      this.children.pop();
    }

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const isSelected = i === this.selectedIndex;
      const prefix = isSelected ? "  > " : "    ";
      const desc = item.description ? ` - ${item.description}` : "";
      const text = `${prefix}[${i + 1}] ${item.label}${desc}`;
      this.addChild(new Text(text, 1, 0));
    }

    this.addChild(new Text("\n(Use arrow keys [↑/↓] or numbers [1-4] to choose, Enter to select)\n", 1, 0));
  }

  handleInput(data: string): void {
    if (isKeyRelease(data)) return;

    if (matchesKey(data, "escape") || data === "\u001b") {
      this.onCancel();
      return;
    }

    if (matchesKey(data, "enter") || data === "\r" || data === "\n") {
      const selected = this.items[this.selectedIndex];
      if (selected) {
        this.onSelect({
          value: selected.value,
          label: selected.label,
          index: this.selectedIndex,
        });
      }
      return;
    }

    if (matchesKey(data, "up") || data === "\u001b[A") {
      this.selectedIndex = (this.selectedIndex - 1 + this.items.length) % this.items.length;
      this.updateRender();
      this.invalidate();
      return;
    }

    if (matchesKey(data, "down") || data === "\u001b[B") {
      this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
      this.updateRender();
      this.invalidate();
      return;
    }

    // Direct number selection 1-9
    const num = parseInt(data, 10);
    if (!isNaN(num) && num >= 1 && num <= this.items.length) {
      this.selectedIndex = num - 1;
      const selected = this.items[this.selectedIndex];
      this.onSelect({
        value: selected.value,
        label: selected.label,
        index: this.selectedIndex,
      });
      return;
    }
  }
}
