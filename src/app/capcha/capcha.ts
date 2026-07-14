import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  inject,
  signal
} from '@angular/core';

type ValidationState = 'idle' | 'success' | 'error';

interface CaptchaGlyph {
  character: string;
  x: number;
  y: number;
  rotation: number;
  size: number;
  weight: number;
}

@Component({
  selector: 'app-capcha',
  templateUrl: './capcha.html',
  styleUrl: './capcha.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Capcha implements AfterViewInit {
  private static readonly captchaLength = 6;
  private static readonly refreshSeconds = 120;
  private static readonly characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  private static readonly canvasWidth = 456;
  private static readonly canvasHeight = 149;

  private readonly destroyRef = inject(DestroyRef);
  private readonly captchaValue = signal('');
  private autoRefreshId: ReturnType<typeof window.setInterval> | null = null;
  private countdownId: ReturnType<typeof window.setInterval> | null = null;

  protected readonly captchaInput = signal('');
  protected readonly secondsRemaining = signal(Capcha.refreshSeconds);
  protected readonly validationMessage = signal('');
  protected readonly validationState = signal<ValidationState>('idle');

  @ViewChild('captchaCanvas', { static: true })
  private readonly captchaCanvas?: ElementRef<HTMLCanvasElement>;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearTimers();
    });
  }

  ngAfterViewInit(): void {
    this.resetCaptchaState();
  }

  protected onCaptchaInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitizedValue = this.sanitizeCaptchaInput(input.value);

    if (input.value !== sanitizedValue) {
      input.value = sanitizedValue;
    }

    this.captchaInput.set(sanitizedValue);
    this.clearValidationMessage();
  }

  protected onCaptchaPaste(event: ClipboardEvent): void {
    event.preventDefault();

    const pastedValue = event.clipboardData?.getData('text') ?? '';
    const sanitizedValue = this.sanitizeCaptchaInput(`${this.captchaInput()}${pastedValue}`);

    this.captchaInput.set(sanitizedValue);
    this.clearValidationMessage();
  }

  protected verifyCaptcha(): void {
    const enteredCaptcha = this.captchaInput();

    if (!enteredCaptcha) {
      this.validationState.set('error');
      this.validationMessage.set('Please enter the CAPTCHA');
      return;
    }

    if (enteredCaptcha === this.captchaValue()) {
      this.validationState.set('success');
      this.validationMessage.set('Verified');
      return;
    }

    this.validationState.set('error');
    this.validationMessage.set('Wrong CAPTCHA');
  }

  protected refreshCaptcha(): void {
    this.resetCaptchaState();
  }

  private resetCaptchaState(): void {
    this.captchaValue.set(this.generateCaptchaValue());
    this.captchaInput.set('');
    this.clearValidationMessage();
    this.secondsRemaining.set(Capcha.refreshSeconds);
    this.drawCaptcha();
    this.startTimers();
  }

  private startTimers(): void {
    this.clearTimers();

    this.countdownId = window.setInterval(() => {
      this.secondsRemaining.update((currentValue) => Math.max(currentValue - 1, 0));
    }, 1000);

    this.autoRefreshId = window.setInterval(() => {
      this.resetCaptchaState();
    }, Capcha.refreshSeconds * 1000);
  }

  private clearTimers(): void {
    if (this.countdownId !== null) {
      window.clearInterval(this.countdownId);
      this.countdownId = null;
    }

    if (this.autoRefreshId !== null) {
      window.clearInterval(this.autoRefreshId);
      this.autoRefreshId = null;
    }
  }

  private clearValidationMessage(): void {
    if (this.validationState() === 'idle' && !this.validationMessage()) {
      return;
    }

    this.validationState.set('idle');
    this.validationMessage.set('');
  }

  private generateCaptchaValue(): string {
    const randomValues = new Uint32Array(Capcha.captchaLength);
    crypto.getRandomValues(randomValues);

    return Array.from(randomValues, (randomValue) => {
      const characterIndex = randomValue % Capcha.characters.length;
      return Capcha.characters.charAt(characterIndex);
    }).join('');
  }

  private sanitizeCaptchaInput(value: string): string {
    return value.replace(/[^a-zA-Z0-9]/g, '').slice(0, Capcha.captchaLength);
  }

  private drawCaptcha(): void {
    const canvas = this.captchaCanvas?.nativeElement;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Capcha.canvasWidth * pixelRatio;
    canvas.height = Capcha.canvasHeight * pixelRatio;
    canvas.style.width = `${Capcha.canvasWidth}px`;
    canvas.style.height = `${Capcha.canvasHeight}px`;

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, Capcha.canvasWidth, Capcha.canvasHeight);

    this.drawBackground(context);
    this.drawInterferenceLines(context);
    this.drawNoiseDots(context, 130);
    this.drawGlyphs(context);
    this.drawForegroundNoise(context);
  }

  private drawBackground(context: CanvasRenderingContext2D): void {
    const gradient = context.createLinearGradient(0, 0, Capcha.canvasWidth, Capcha.canvasHeight);
    gradient.addColorStop(0, '#fbfbf7');
    gradient.addColorStop(0.55, '#f7f6f0');
    gradient.addColorStop(1, '#fbf8ef');

    context.fillStyle = gradient;
    context.fillRect(0, 0, Capcha.canvasWidth, Capcha.canvasHeight);

    context.lineWidth = 0.55;
    context.strokeStyle = 'rgba(220, 214, 197, 0.42)';

    for (let y = 8; y < Capcha.canvasHeight; y += 9) {
      context.beginPath();
      context.moveTo(0, y + this.randomBetween(-1, 1));
      context.lineTo(Capcha.canvasWidth, y + this.randomBetween(-1, 1));
      context.stroke();
    }
  }

  private drawInterferenceLines(context: CanvasRenderingContext2D): void {
    const lineColors = [
      'rgba(129, 137, 205, 0.27)',
      'rgba(106, 161, 217, 0.22)',
      'rgba(222, 166, 92, 0.19)'
    ];

    for (let index = 0; index < 10; index += 1) {
      context.beginPath();
      context.lineWidth = this.randomBetween(1, 1.8);
      context.strokeStyle = lineColors[this.randomInt(0, lineColors.length - 1)];
      context.moveTo(this.randomBetween(-20, 35), this.randomBetween(12, 137));

      const controlOneX = this.randomBetween(80, 170);
      const controlOneY = this.randomBetween(-10, 160);
      const controlTwoX = this.randomBetween(265, 350);
      const controlTwoY = this.randomBetween(-10, 160);
      const endX = this.randomBetween(410, 486);
      const endY = this.randomBetween(10, 140);

      context.bezierCurveTo(controlOneX, controlOneY, controlTwoX, controlTwoY, endX, endY);
      context.stroke();
    }

    for (let index = 0; index < 4; index += 1) {
      context.beginPath();
      context.lineWidth = this.randomBetween(0.8, 1.4);
      context.strokeStyle = 'rgba(207, 167, 105, 0.18)';
      context.moveTo(this.randomBetween(-15, 60), this.randomBetween(96, 145));
      context.lineTo(this.randomBetween(390, 482), this.randomBetween(8, 54));
      context.stroke();
    }
  }

  private drawNoiseDots(context: CanvasRenderingContext2D, count: number): void {
    for (let index = 0; index < count; index += 1) {
      const alpha = this.randomBetween(0.1, 0.32);
      const radius = this.randomBetween(0.7, 1.8);

      context.beginPath();
      context.fillStyle = `rgba(99, 116, 139, ${alpha})`;
      context.arc(
        this.randomBetween(4, Capcha.canvasWidth - 4),
        this.randomBetween(4, Capcha.canvasHeight - 4),
        radius,
        0,
        Math.PI * 2
      );
      context.fill();
    }
  }

  private drawGlyphs(context: CanvasRenderingContext2D): void {
    const glyphs = this.buildGlyphLayout();

    context.textBaseline = 'middle';
    context.textAlign = 'center';
    context.shadowColor = 'rgba(15, 23, 42, 0.2)';
    context.shadowBlur = 2;
    context.shadowOffsetY = 1;

    for (const glyph of glyphs) {
      context.save();
      context.translate(glyph.x, glyph.y);
      context.rotate((glyph.rotation * Math.PI) / 180);
      context.font = `${glyph.weight} ${glyph.size}px Arial, Helvetica, sans-serif`;
      context.fillStyle = 'rgba(15, 23, 42, 0.93)';
      context.fillText(glyph.character, 0, 0);
      context.restore();
    }

    context.shadowColor = 'transparent';
    context.shadowBlur = 0;
    context.shadowOffsetY = 0;
  }

  private buildGlyphLayout(): CaptchaGlyph[] {
    const basePositions = [71, 126, 184, 242, 300, 357];

    return this.captchaValue().split('').map((character, index) => ({
      character,
      x: basePositions[index] + this.randomBetween(-9, 9),
      y: this.randomBetween(72, 84),
      rotation: this.randomBetween(-7, 8),
      size: this.randomInt(48, 61),
      weight: this.randomInt(600, 760)
    }));
  }

  private drawForegroundNoise(context: CanvasRenderingContext2D): void {
    context.globalCompositeOperation = 'source-over';
    this.drawNoiseDots(context, 45);

    context.lineWidth = 1;
    context.strokeStyle = 'rgba(148, 163, 184, 0.14)';

    for (let index = 0; index < 3; index += 1) {
      context.beginPath();
      context.moveTo(0, this.randomBetween(22, 124));
      context.quadraticCurveTo(
        this.randomBetween(150, 310),
        this.randomBetween(0, 149),
        Capcha.canvasWidth,
        this.randomBetween(22, 124)
      );
      context.stroke();
    }
  }

  private randomInt(minimum: number, maximum: number): number {
    const minimumCeiled = Math.ceil(minimum);
    const maximumFloored = Math.floor(maximum);
    const randomRange = maximumFloored - minimumCeiled + 1;
    const randomValue = new Uint32Array(1);
    crypto.getRandomValues(randomValue);

    return minimumCeiled + (randomValue[0] % randomRange);
  }

  private randomBetween(minimum: number, maximum: number): number {
    const randomValue = new Uint32Array(1);
    crypto.getRandomValues(randomValue);

    return minimum + (randomValue[0] / 0xffffffff) * (maximum - minimum);
  }
}
