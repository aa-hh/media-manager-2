import { isRecord } from './result.js';

export type Image = { coverType: string; url: string | null; remoteUrl: string | null };

export type FileDetail = {
  id: number | null;
  // Absolute, as Sonarr or Radarr sees it.
  path: string | null;
  relativePath: string | null;
  size: number;
  dateAdded: string | null;
  quality: string | null;
  revision: { version: number | null; real: number | null; isRepack: boolean };
  releaseGroup: string | null;
  languages: string[];
  customFormats: string[];
  customFormatScore: number | null;
  qualityCutoffNotMet: boolean;
  mediaInfo: {
    videoCodec: string | null;
    videoDynamicRangeType: string | null;
    resolution: string | null;
    audioCodec: string | null;
    audioChannels: number | null;
    audioLanguages: string | null;
    subtitles: string | null;
  } | null;
};

export const text = (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);
export const finiteNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
export const count = (value: unknown) => finiteNumber(value) ?? 0;
export const positiveInteger = (value: unknown) => (
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
);
export const records = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.filter(isRecord) : []);
export const names = (value: unknown): string[] => records(value).flatMap((item) => {
  const name = text(item.name);
  return name === null ? [] : [name];
});
export const stringList = (value: unknown): string[] => (Array.isArray(value) ? value.flatMap((item) => {
  const entry = text(item);
  return entry === null ? [] : [entry];
}) : []);
// Sonarr repeats an alternate title once per scene season; each comes through once, and never the main title.
export const otherTitles = (value: unknown, title: string): string[] => (
  [...new Set(records(value).flatMap((item) => text(item.title) ?? []))].filter((entry) => entry !== title)
);
export const idList = (value: unknown): number[] => (Array.isArray(value) ? value.flatMap((item) => {
  const id = positiveInteger(item);
  return id === null ? [] : [id];
}) : []);

export const parseImages = (value: unknown): Image[] => records(value).flatMap((image) => {
  const coverType = text(image.coverType);
  return coverType === null ? [] : [{ coverType, url: text(image.url), remoteUrl: text(image.remoteUrl) }];
});

export const parseFile = (value: unknown): FileDetail | null => {
  if (!isRecord(value)) return null;
  const quality = isRecord(value.quality) ? value.quality : {};
  const revision = isRecord(quality.revision) ? quality.revision : {};
  const info = isRecord(value.mediaInfo) ? value.mediaInfo : undefined;
  return {
    id: positiveInteger(value.id),
    path: text(value.path),
    relativePath: text(value.relativePath),
    size: count(value.size),
    dateAdded: text(value.dateAdded),
    quality: isRecord(quality.quality) ? text(quality.quality.name) : null,
    revision: { version: finiteNumber(revision.version), real: finiteNumber(revision.real), isRepack: revision.isRepack === true },
    releaseGroup: text(value.releaseGroup),
    languages: names(value.languages),
    customFormats: names(value.customFormats),
    customFormatScore: finiteNumber(value.customFormatScore),
    qualityCutoffNotMet: value.qualityCutoffNotMet === true,
    mediaInfo: info === undefined ? null : {
      videoCodec: text(info.videoCodec),
      videoDynamicRangeType: text(info.videoDynamicRangeType),
      resolution: text(info.resolution),
      audioCodec: text(info.audioCodec),
      audioChannels: finiteNumber(info.audioChannels),
      audioLanguages: text(info.audioLanguages),
      subtitles: text(info.subtitles),
    },
  };
};
