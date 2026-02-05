import { LitElement, css, nothing } from 'lit';

/**
 * A draggable divider for resizable split views.
 * Dispatches 'resize' events with { splitRatio: number } detail.
 */
export class ResizableDivider extends LitElement {
  static properties = {
    splitRatio: { type: Number },
    minRatio: { type: Number },
    maxRatio: { type: Number }
  };

  static styles = css`
    :host {
      width: 4px;
      cursor: col-resize;
      background: var(--border, #333);
      transition: background 150ms ease-out;
      flex-shrink: 0;
      position: relative;
    }
    :host::before {
      content: "";
      position: absolute;
      top: 0;
      left: -4px;
      right: -4px;
      bottom: 0;
    }
    :host(:hover) {
      background: var(--accent, #007bff);
    }
    :host(.dragging) {
      background: var(--accent, #007bff);
    }
  `;

  constructor() {
    super();
    this.splitRatio = 0.6;
    this.minRatio = 0.4;
    this.maxRatio = 0.7;

    this._isDragging = false;
    this._startX = 0;
    this._startRatio = 0;

    // Bind event handlers so they can be added/removed
    this._handleMouseDown = (e) => {
      this._isDragging = true;
      this._startX = e.clientX;
      this._startRatio = this.splitRatio;
      this.classList.add('dragging');

      document.addEventListener('mousemove', this._handleMouseMove);
      document.addEventListener('mouseup', this._handleMouseUp);

      e.preventDefault();
    };

    this._handleMouseMove = (e) => {
      if (!this._isDragging) {
        return;
      }

      const container = this.parentElement;
      if (!container) {
        return;
      }

      const containerWidth = container.getBoundingClientRect().width;
      const deltaX = e.clientX - this._startX;
      const deltaRatio = deltaX / containerWidth;

      let newRatio = this._startRatio + deltaRatio;
      newRatio = Math.max(this.minRatio, Math.min(this.maxRatio, newRatio));

      this.dispatchEvent(
        new CustomEvent('resize', {
          detail: { splitRatio: newRatio },
          bubbles: true,
          composed: true
        })
      );
    };

    this._handleMouseUp = () => {
      this._isDragging = false;
      this.classList.remove('dragging');

      document.removeEventListener('mousemove', this._handleMouseMove);
      document.removeEventListener('mouseup', this._handleMouseUp);
    };
  }

  render() {
    return nothing;
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('mousedown', this._handleMouseDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('mousedown', this._handleMouseDown);
    document.removeEventListener('mousemove', this._handleMouseMove);
    document.removeEventListener('mouseup', this._handleMouseUp);
  }
}

customElements.define('resizable-divider', ResizableDivider);
