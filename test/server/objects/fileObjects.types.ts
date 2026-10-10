import type AudioFile from '../../../server/objects/files/AudioFile'
import type LibraryFile from '../../../server/objects/files/LibraryFile'
import type EBookFile from '../../../server/objects/files/EBookFile'
import type FileMetadata from '../../../server/objects/metadata/FileMetadata'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

export type FileObjectsContract = [
  Assert<Equal<AudioFile['index'], number | null | undefined>>,
  Assert<Equal<Extract<AudioFile['chapters'], undefined>, undefined>>,
  Assert<Equal<ReturnType<AudioFile['toJSON']>['index'], number | null | undefined>>,
  Assert<Equal<LibraryFile['ino'], string | null | undefined>>,
  Assert<Equal<EBookFile['addedAt'], number | null | undefined>>,
  Assert<Equal<FileMetadata['filename'], string | null | undefined>>,
  Assert<Equal<ReturnType<FileMetadata['toJSON']>['size'], number | null | undefined>>
]
