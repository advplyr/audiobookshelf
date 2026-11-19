import type Ffmpeg from '../../fluentFfmpeg';

export interface MediaArguments<Value = string | number> {
  (...args: Value[]): void;
  (args: Value[]): void;
  clear(): void;
  get(): Value[];
  find(arg: Value, count?: number): Value[] | undefined;
  remove(arg: Value, count?: number): void;
  clone(): MediaArguments<Value>;
}

export interface CommandInputStream {
  readable: boolean;
  pause(): unknown;
  resume(): unknown;
  pipe(target: NodeJS.WritableStream): unknown;
  unpipe(target?: NodeJS.WritableStream): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
}

export interface CommandInput {
  source: string | CommandInputStream;
  isFile?: boolean;
  isStream?: boolean;
  options: MediaArguments;
}

export type CommandWithInput = Ffmpeg.FfmpegCommand & {
  _inputs: CommandInput[];
  _currentInput?: CommandInput;
};

export interface PipeOptions {
  end?: boolean;
}

export interface CommandOutput {
  audio: MediaArguments;
  audioFilters: MediaArguments;
  video: MediaArguments;
  videoFilters: MediaArguments;
  sizeFilters: MediaArguments<MediaFilter>;
  options: MediaArguments;
  target?: Parameters<Ffmpeg.FfmpegCommand['output']>[0];
  isFile?: boolean;
  flags: { flvmeta?: boolean };
  pipeopts?: PipeOptions;
  sizeData?: VideoSizeData;
}

export interface VideoSizeData {
  size?: string;
  aspect?: number;
  pad?: string | false;
}

export type CommandWithMediaOutput = Ffmpeg.FfmpegCommand & {
  _outputs: CommandOutput[];
  _currentOutput: CommandOutput;
};

export type MediaFilter = string | {
  filter: string;
  inputs?: string | string[];
  outputs?: string | string[];
  options?: FilterValue | FilterValue[] | Record<string, FilterValue>;
};

type FilterValue = string | number | boolean | null | undefined;
