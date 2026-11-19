import type Ffmpeg from '../../fluentFfmpeg';

export interface MediaArguments {
  (...args: (string | number)[]): void;
  (args: (string | number)[]): void;
  clear(): void;
}

export interface CommandInput {
  source: string | { readable: boolean; pause(): unknown };
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
  sizeFilters: MediaArguments;
  options: MediaArguments;
  target?: Parameters<Ffmpeg.FfmpegCommand['output']>[0];
  isFile?: boolean;
  flags: { flvmeta?: boolean };
  pipeopts?: PipeOptions;
}

export type CommandWithMediaOutput = Ffmpeg.FfmpegCommand & {
  _outputs: CommandOutput[];
  _currentOutput: CommandOutput;
};

export type MediaFilter = string | {
  filter: string;
  inputs?: string | string[];
  outputs?: string | string[];
  options?: unknown;
};
