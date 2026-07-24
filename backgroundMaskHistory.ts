/**
 * Undo/Redo stack manager for Background Mask Editing
 */

export class MaskHistoryManager {
  private stack: ImageData[] = [];
  private currentIndex: number = -1;
  private maxHistory: number = 20;

  constructor(maxHistory: number = 20) {
    this.maxHistory = maxHistory;
  }

  public pushState(imageData: ImageData) {
    // Truncate redo stack if any
    if (this.currentIndex < this.stack.length - 1) {
      this.stack = this.stack.slice(0, this.currentIndex + 1);
    }

    // Clone ImageData
    const cloned = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    this.stack.push(cloned);

    if (this.stack.length > this.maxHistory) {
      this.stack.shift();
    } else {
      this.currentIndex++;
    }
  }

  public canUndo(): boolean {
    return this.currentIndex > 0;
  }

  public canRedo(): boolean {
    return this.currentIndex < this.stack.length - 1;
  }

  public undo(): ImageData | null {
    if (!this.canUndo()) return null;
    this.currentIndex--;
    const state = this.stack[this.currentIndex];
    return new ImageData(
      new Uint8ClampedArray(state.data),
      state.width,
      state.height
    );
  }

  public redo(): ImageData | null {
    if (!this.canRedo()) return null;
    this.currentIndex++;
    const state = this.stack[this.currentIndex];
    return new ImageData(
      new Uint8ClampedArray(state.data),
      state.width,
      state.height
    );
  }

  public getCurrent(): ImageData | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.stack.length) return null;
    const state = this.stack[this.currentIndex];
    return new ImageData(
      new Uint8ClampedArray(state.data),
      state.width,
      state.height
    );
  }

  public clear() {
    this.stack = [];
    this.currentIndex = -1;
  }
}
