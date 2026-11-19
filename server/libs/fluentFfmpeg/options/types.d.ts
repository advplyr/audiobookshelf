import type Ffmpeg from '../../fluentFfmpeg';

export interface MediaArguments {
  (...args: (string | number)[]): void;
  (args: (string | number)[]): void;
  clear(): void;
}

export type CommandWithMediaOutput = Ffmpeg.FfmpegCommand & {
  _currentOutput: {
    audio: MediaArguments;
    audioFilters: MediaArguments;
    video: MediaArguments;
    videoFilters: MediaArguments;
  };
};

export type MediaFilter = string | {
  filter: string;
  inputs?: string | string[];
  outputs?: string | string[];
  options?: unknown;
};
