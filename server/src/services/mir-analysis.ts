// Music Information Retrieval (MIR) MCP service integration.
//
// Provides type-safe access to the professional MIR analysis engine used by the
// Music Engineer agent for beat-track and hit-song analysis.
//
// Usage from agent code:
//   const result = await mirAnalyze({ audio: "https://...", goal: "Extract key, tempo, structure" });
//   const features = mirExtractKeyFeatures(result);  // simplified features
//
// The MIR tool (`mir_analyze_music`) is invoked by the agent framework directly.
// This module exports types and extraction helpers so the agent can interpret
// the response without manually navigating the raw MIR shape.

// ── MIR response types (trimmed to the fields the Music Engineer needs) ──────

export interface MirSource {
  path: string;
  filename: string;
  inputUrl: string;
  platform: string;
  resolutionStatus: string;
  resolvedUrl: string;
  trackId: string | null;
}

export interface MirTempoCandidate {
  bpm: number;
  role: string;
  support: number;
  confidence: number;
}

export interface MirTempo {
  selectedBpm: number;
  perceivedBpm: number;
  candidates: MirTempoCandidate[];
  confidence: number;
}

export interface MirBeat {
  beatIndex: number;
  timeSeconds: number;
  intervalSeconds: number;
  deviationMs: number;
}

export interface MirMeterCandidate {
  meter: string;
  confidence: number;
}

export interface MirRhythm {
  tempo: MirTempo;
  tempoCurve: { points: { timeSeconds: number; bpm: number }[] };
  beats: MirBeat[];
  downbeats: number[];
  selectedMeter: string | null;
  meterCandidates: MirMeterCandidate[];
  confidence: number;
}

export interface MirKeyCandidate {
  tonic: string;
  scale: string;
  label: string;
  confidence: number;
}

export interface MirKey {
  tonic: string;
  scale: string;
  label: string;
  confidence: number;
  candidates: MirKeyCandidate[];
  reviewRequired: boolean;
}

export interface MirKeyTimelineSegment {
  start: number;
  end: number;
  tonic: string;
  scale: string;
  label: string;
  confidence: number;
  reviewRequired: boolean;
}

export interface MirChord {
  start: number;
  end: number;
  chord: string;
  root: string;
  quality: string;
  confidence: number;
  romanNumeral: string;
  harmonicFunction: string;
  alternatives: { chord: string; confidence: number }[];
}

export interface MirChordSummary {
  chordCount: number;
  distinctChords: string[];
  changesPerMinute: number;
  meanConfidence: number;
  interpretationStatus: string;
}

export interface MirSection {
  id: string;
  start: number;
  end: number;
  role: string;
  confidence: number;
  energyNormalized: number;
  durationSeconds: number;
}

export interface MirTag {
  instrumentation: string[];
  genre: string[];
  emotion: string[];
  confidence: number;
}

export interface MirCommercialAssessment {
  hookAssessment: { score: number; label: string };
  memorability: { score: number; label: string };
  targetMarketMatch: { score: number; label: string }[];
  confidence: number;
}

export interface MirMelodyEvent {
  start: number;
  end: number;
  midiNote: number;
  note: string;
  amplitude: number;
}

export interface MirProfessionalLoudness {
  status?: string;
  integrated_lufs?: number;
  loudness_range_lu?: number;
  sample_peak_dbfs?: number;
  true_peak_dbfs?: number;
  timeline?: { integrated_lufs?: number; [key: string]: unknown }[];
}

export interface MirGlobalFeatures {
  durationSeconds: number;
  sampleRateHz: number;
  channels: number;
  rmsDb: number;
  peakDb: number;
  spectralCentroidHz: number;
  rhythm: MirRhythm;
  key: MirKey;
  keyTimeline: MirKeyTimelineSegment[];
  tags: MirTag;
  commercialAssessment: MirCommercialAssessment;
  /** Professional loudness measurements (EBU R128 / ITU-R BS.1770) */
  professionalLoudness?: MirProfessionalLoudness;
  /** Professional mix analysis (stereo width, frequency bands, mix risks) */
  mixAnalysis?: MirMixAnalysis;
  /** Vocal range data if vocals detected */
  vocalRange?: MirVocalRange;
}

export interface MirStemSummary {
  stemsDetected: string[];
}

export interface MirAnalysisResult {
  analysisId: string;
  status: string;
  source: MirSource;
  globalFeatures: MirGlobalFeatures;
  sections: MirSection[];
  chords: MirChord[];
  chordSummary: MirChordSummary;
  stemSummary: MirStemSummary;
  evidence: unknown[];
  goal: string;
  level: string;
}

// ── Extended MIR types for advanced analysis ─────────────────────────────────

export interface MirArrangementSection {
  sectionId: string;
  startSeconds: number;
  endSeconds: number;
  energyNormalized: number;
  activeLayers: string[];
  layerCount: number;
  role?: string;
}

export interface MirArrangementInfo {
  sections: MirArrangementSection[];
  transitions: Array<{
    timeSeconds: number;
    fromSection: string;
    toSection: string;
    kind: string;
    confidence: number;
  }>;
  climax?: {
    candidates: Array<{ sectionId: string; score: number; reasons: string[] }>;
  };
}

export interface MirMixAnalysis {
  stereoWidth?: {
    sideToMidDb: number;
    lowFrequencySideToMidDb: number;
    leftRightCorrelation: number;
    perBand?: Record<string, { sideToMidDb: number; correlation: number }>;
  };
  frequencyBands: Array<{ name: string; levelDb: number }>;
  mixRisks: Array<{ type: string; severity: string }>;
}

export interface MirMelodyEvent {
  start: number;
  end: number;
  midiNote: number;
  note: string;
  amplitude: number;
}

export interface MirMelody {
  status?: string;
  backend?: string;
  source?: string;
  eventCount?: number;
  pitchBendCount?: number;
  events: MirMelodyEvent[];
}

export interface MirVocalRange {
  status?: string;
  lowestMidiNote?: number;
  highestMidiNote?: number;
  lowestNote?: string;
  highestNote?: string;
  semitoneSpan?: number;
  robustLowestMidiNote?: number;
  robustHighestMidiNote?: number;
  robustLowestNote?: string;
  robustHighestNote?: string;
  robustSemitoneSpan?: number;
  eventCount?: number;
  confidence?: number;
  confidenceLevel?: string;
}

export interface MirLyricSegment {
  start: number;
  end: number;
  text: string;
  confidence: number;
}

// ── Simplified feature extraction ────────────────────────────────────────────
// The Music Engineer needs a quick, digestible summary without navigating the
// deeply nested MIR response. These helpers flatten the most important signals.

export interface MirKeyFeatures {
  /** Duration of the track in seconds */
  duration: number;
  /** Detected tempo in BPM (most likely) */
  tempoBpm: number;
  /** Perceived tempo (may differ by octave) */
  perceivedBpm: number;
  /** Tempo confidence 0-1 */
  tempoConfidence: number;
  /** Key tonic letter, e.g. "E" */
  keyTonic: string;
  /** Key scale type, e.g. "minor", "major" */
  keyScale: string;
  /** Full key label, e.g. "E minor" */
  keyLabel: string;
  /** Key confidence 0-1 */
  keyConfidence: number;
  /** Detected genres */
  genres: string[];
  /** Detected emotions/moods */
  emotions: string[];
  /** Instrumentation detected */
  instrumentation: string[];
  /** Song structure segments */
  structure: { role: string; start: number; end: number; duration: number }[];
  /** Number of chord changes per minute */
  chordChangesPerMinute: number;
  /** Distinct chords used */
  distinctChords: string[];
  /** Commercial hook score (0-1) */
  commercialHookScore: number;
  /** Memorability score (0-1) */
  memorabilityScore: number;
  /** Overall RMS level in dB */
  rmsDb: number;
  /** Overall loudness in LUFS */
  integratedLoudness: number;
  /** Loudness range in LU (EBU R128) */
  loudnessRange?: number;
  /** Key changes detected in the track */
  keyChanges: { from: string; to: string; at: number }[];
  /** Meter (time signature), e.g. "4/4" */
  meter?: string | null;
  /** Meter confidence */
  meterConfidence?: number;
  /** Beat positions in seconds */
  beatTimes: number[];
  /** Downbeat indices */
  downbeatIndices: number[];
  /** Vocal range if vocals detected */
  vocalRange?: string;
  /** Vocal range semitone span */
  vocalSemitoneSpan?: number;
  /** Professional mix stereo width (-1 to 1) */
  stereoWidth?: number;
}

/**
 * Extract a flat, engineer-friendly summary from the raw MIR result.
 *
 * The MIR engine returns a deeply nested, comprehensive analysis. This
 * function flattens the most important signals (tempo, key, structure, genre,
 * commercial viability) into a single shape that the Music Engineer can
 * reason about when crafting hit songs.
 */
export function mirExtractKeyFeatures(result: MirAnalysisResult): MirKeyFeatures {
  const { globalFeatures, sections, chords, chordSummary } = result;
  const { rhythm, key, tags } = globalFeatures;

  // Extract integrated loudness from professional_loudness timeline (EBU R128)
  let integratedLoudness = 0;
  let loudnessRange: number | undefined;
  const rawGf = globalFeatures as unknown as Record<string, unknown>;
  const profLoudness = rawGf.professional_loudness ?? rawGf.professionalLoudness;
  if (profLoudness && typeof profLoudness === "object") {
    const pl = profLoudness as Record<string, unknown>;
    const lufs = pl.integrated_lufs;
    const lru = pl.loudness_range_lu ?? pl.loudnessRangeLu;
    if (typeof lufs === "number") {
      integratedLoudness = lufs;
    } else {
      const tl = pl.timeline;
      if (Array.isArray(tl) && tl.length > 0) {
        const lastLufs = tl[tl.length - 1] as Record<string, unknown>;
        const lastVal = lastLufs?.integrated_lufs;
        if (typeof lastVal === "number") integratedLoudness = lastVal;
      }
    }
    if (typeof lru === "number") {
      loudnessRange = lru;
    }
  }

  // Extract key changes from timeline segments
  const keyChanges: MirKeyFeatures["keyChanges"] = [];
  const keyTimeline = keyTimelineFromResult(result);
  for (let i = 1; i < keyTimeline.length; i++) {
    if (keyTimeline[i].label !== keyTimeline[i - 1].label) {
      keyChanges.push({
        from: keyTimeline[i - 1].label,
        to: keyTimeline[i].label,
        at: keyTimeline[i].start,
      });
    }
  }

  // Extract vocal range and stereo width from parsed global features
  let vocalRange: string | undefined;
  if (globalFeatures.vocalRange) {
    const vr = globalFeatures.vocalRange;
    if (vr.robustLowestNote && vr.robustHighestNote) {
      vocalRange = `${vr.robustLowestNote} – ${vr.robustHighestNote}`;
    } else if (vr.lowestNote && vr.highestNote) {
      vocalRange = `${vr.lowestNote} – ${vr.highestNote}`;
    }
  }

  let stereoWidth: number | undefined;
  if (globalFeatures.mixAnalysis?.stereoWidth) {
    stereoWidth = globalFeatures.mixAnalysis.stereoWidth.leftRightCorrelation;
  }

  return {
    duration: globalFeatures.durationSeconds,
    tempoBpm: rhythm.tempo.selectedBpm,
    perceivedBpm: rhythm.tempo.perceivedBpm,
    tempoConfidence: rhythm.tempo.confidence,
    keyTonic: key.tonic,
    keyScale: key.scale,
    keyLabel: key.label,
    keyConfidence: key.confidence,
    genres: tags.genre ?? [],
    emotions: tags.emotion ?? [],
    instrumentation: tags.instrumentation ?? [],
    structure: sections.map((s) => ({
      role: s.role,
      start: s.start,
      end: s.end,
      duration: s.durationSeconds,
    })),
    chordChangesPerMinute: chordSummary.changesPerMinute,
    distinctChords: chordSummary.distinctChords,
    commercialHookScore: globalFeatures.commercialAssessment?.hookAssessment?.score ?? 0,
    memorabilityScore: globalFeatures.commercialAssessment?.memorability?.score ?? 0,
    rmsDb: globalFeatures.rmsDb,
    integratedLoudness,
    loudnessRange,
    keyChanges,
    meter: rhythm.selectedMeter,
    meterConfidence: rhythm.confidence,
    beatTimes: rhythm.beats.map((b) => b.timeSeconds),
    downbeatIndices: rhythm.downbeats,
    vocalRange,
    vocalSemitoneSpan: globalFeatures.vocalRange?.robustSemitoneSpan,
    stereoWidth,
  };
}

function keyTimelineFromResult(result: MirAnalysisResult): MirKeyTimelineSegment[] {
  const gf = result.globalFeatures;
  // Handle both snake_case and camelCase field names
  const raw = gf as unknown as Record<string, unknown>;
  if (Array.isArray(raw.key_timeline)) {
    return raw.key_timeline as MirKeyTimelineSegment[];
  }
  if (Array.isArray(raw.keyTimeline)) {
    return raw.keyTimeline as MirKeyTimelineSegment[];
  }
  return [];
}

// ── MIR result to MirAnalysisResult converter ────────────────────────────────
// Bridges the actual MIR tool response (snake_case, deeply nested) to our
// typed MirAnalysisResult interface.

/**
 * Convert the raw MIR tool response into a typed MirAnalysisResult.
 *
 * The MIR tool returns a JSON object with snake_case keys and deeply nested
 * structures. This function normalizes the keys to camelCase and extracts
 * the fields needed by the Music Engineer agent.
 */
export function mirParseResponse(raw: unknown): MirAnalysisResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("MIR response is not a valid object");
  }

  const r = raw as Record<string, unknown>;

  const sourceObj = (r.source ?? r.source) as Record<string, unknown> | undefined;
  const source: MirSource = {
    path: safeString(sourceObj, "path"),
    filename: safeString(sourceObj, "filename"),
    inputUrl: safeString(sourceObj, "input_url"),
    platform: safeString(sourceObj, "platform"),
    resolutionStatus: safeString(sourceObj, "resolution_status"),
    resolvedUrl: safeString(sourceObj, "resolved_url"),
    trackId: safeNullable(sourceObj, "track_id"),
  };

  const globalFeatures = parseGlobalFeatures(r);
  const sections = parseSections(r);
  const chords = parseChords(r);
  const chordSummary = parseChordSummary(r);
  const stemSummary = parseStemSummary(r);

  return {
    analysisId: safeString(r, "analysis_id"),
    status: safeString(r, "status"),
    source,
    globalFeatures,
    sections,
    chords,
    chordSummary,
    stemSummary,
    evidence: safeArray(r, "evidence"),
    goal: safeString(r, "goal"),
    level: safeString(r, "level"),
  };
}

function parseGlobalFeatures(r: Record<string, unknown>): MirGlobalFeatures {
  const gf = (r.global_features ?? r.globalFeatures) as Record<string, unknown> | undefined;
  if (!gf || typeof gf !== "object") {
    throw new Error("Missing global_features in MIR response");
  }

  const rhythm = parseRhythm(gf);
  const key = parseKey(gf);
  const tags = parseTags(gf);
  const commercialAssessment = parseCommercialAssessment(gf);

  return {
    durationSeconds: safeNumber(gf, "duration_seconds") ?? safeNumber(gf, "durationSeconds") ?? 0,
    sampleRateHz: safeNumber(gf, "sample_rate_hz") ?? safeNumber(gf, "sampleRateHz") ?? 0,
    channels: safeNumber(gf, "channels") ?? 0,
    rmsDb: safeNumber(gf, "rms_db") ?? safeNumber(gf, "rmsDb") ?? 0,
    peakDb: safeNumber(gf, "peak_db") ?? safeNumber(gf, "peakDb") ?? 0,
    spectralCentroidHz: safeNumber(gf, "spectral_centroid_hz") ?? safeNumber(gf, "spectralCentroidHz") ?? 0,
    rhythm,
    key,
    keyTimeline: parseKeyTimeline(gf),
    tags,
    commercialAssessment,
    professionalLoudness: gf.professional_loudness ?? gf.professionalLoudness as MirProfessionalLoudness | undefined,
    mixAnalysis: parseMixAnalysis(gf),
    vocalRange: parseVocalRange(gf),
  };
}

function parseRhythm(gf: Record<string, unknown>): MirRhythm {
  const rhythm = (gf.rhythm ?? gf.rhythm) as Record<string, unknown> | undefined;
  if (!rhythm || typeof rhythm !== "object") {
    return {
      tempo: { selectedBpm: 0, perceivedBpm: 0, candidates: [], confidence: 0 },
      tempoCurve: { points: [] },
      beats: [],
      downbeats: [],
      selectedMeter: null,
      meterCandidates: [],
      confidence: 0,
    };
  }

  const tempo = rhythm.tempo ?? rhythm.tempo;
  if (tempo && typeof tempo === "object") {
    return {
      tempo: {
        selectedBpm: safeNumber(tempo, "selected_bpm") ?? safeNumber(tempo, "selectedBpm") ?? 0,
        perceivedBpm: safeNumber(tempo, "perceived_bpm") ?? safeNumber(tempo, "perceivedBpm") ?? 0,
        candidates: safeArray(tempo, "candidates").map((c) => ({
          bpm: safeNumber(c, "bpm") ?? 0,
          role: safeString(c, "role"),
          support: safeNumber(c, "support") ?? 0,
          confidence: safeNumber(c, "confidence") ?? 0,
        })),
        confidence: safeNumber(tempo, "confidence") ?? 0,
      },
      tempoCurve: {
        points: safeArray(
          tempo,
          "tempo_curve"
        )?.map((p: Record<string, unknown>) => ({
          timeSeconds: safeNumber(p, "time_seconds") ?? safeNumber(p, "timeSeconds") ?? 0,
          bpm: safeNumber(p, "bpm") ?? 0,
        })) ?? [],
      },
      beats: safeArray(rhythm, "beats")?.map((b) => ({
        beatIndex: safeNumber(b, "beat_index") ?? safeNumber(b, "beatIndex") ?? 0,
        timeSeconds: safeNumber(b, "time_seconds") ?? safeNumber(b, "timeSeconds") ?? 0,
        intervalSeconds: safeNumber(b, "interval_seconds") ?? safeNumber(b, "intervalSeconds") ?? 0,
        deviationMs: safeNumber(b, "deviation_ms") ?? safeNumber(b, "deviationMs") ?? 0,
      })) ?? [],
      downbeats: safeArray(rhythm, "downbeats")?.map((d: unknown) => (typeof d === "number" ? d : 0)) ?? [],
      selectedMeter: safeNullable(rhythm, "selected_meter") ?? safeNullable(rhythm, "selectedMeter"),
      meterCandidates: safeArray(rhythm, "meter_candidates")?.map((c) => ({
        meter: safeString(c, "meter"),
        confidence: safeNumber(c, "confidence") ?? 0,
      })) ?? [],
      confidence: safeNumber(rhythm, "confidence") ?? 0,
    };
  }

  return {
    tempo: { selectedBpm: 0, perceivedBpm: 0, candidates: [], confidence: 0 },
    tempoCurve: { points: [] },
    beats: [],
    downbeats: [],
    selectedMeter: null,
    meterCandidates: [],
    confidence: 0,
  };
}

function parseKey(gf: Record<string, unknown>): MirKey {
  const keyData = (gf.key ?? gf.key) as Record<string, unknown> | undefined;
  if (!keyData || typeof keyData !== "object") {
    return { tonic: "", scale: "", label: "", confidence: 0, candidates: [], reviewRequired: false };
  }

  return {
    tonic: safeString(keyData, "tonic"),
    scale: safeString(keyData, "scale"),
    label: safeString(keyData, "label"),
    confidence: safeNumber(keyData, "confidence") ?? 0,
    candidates: safeArray(keyData, "candidates").map((c) => ({
      tonic: safeString(c, "tonic"),
      scale: safeString(c, "scale"),
      label: safeString(c, "label"),
      confidence: safeNumber(c, "confidence") ?? 0,
    })),
    reviewRequired: safeBoolean(keyData, "review_required") ?? safeBoolean(keyData, "reviewRequired") ?? false,
  };
}

function parseKeyTimeline(gf: Record<string, unknown>): MirKeyTimelineSegment[] {
  const data =
    (gf.key_timeline ?? gf.keyTimeline) as
      | Record<string, unknown>[]
      | undefined;
  if (!Array.isArray(data)) return [];

  return data.map((s) => ({
    start: safeNumber(s, "start") ?? 0,
    end: safeNumber(s, "end") ?? 0,
    tonic: safeString(s, "tonic"),
    scale: safeString(s, "scale"),
    label: safeString(s, "label"),
    confidence: safeNumber(s, "confidence") ?? 0,
    reviewRequired: safeBoolean(s, "review_required") ?? safeBoolean(s, "reviewRequired") ?? false,
  }));
}

function parseTags(gf: Record<string, unknown>): MirTag {
  const tags = (gf.tags ?? gf.tags) as Record<string, unknown> | undefined;
  if (!tags || typeof tags !== "object") {
    return { instrumentation: [], genre: [], emotion: [], confidence: 0 };
  }

  return {
    instrumentation: safeArray(tags, "instrumentation").map((i) => safeString(i, "name") || String(i)),
    genre: safeArray(tags, "genre"),
    emotion: safeArray(tags, "emotion"),
    confidence: safeNumber(tags, "confidence") ?? 0,
  };
}

function parseCommercialAssessment(gf: Record<string, unknown>): MirCommercialAssessment {
  const ca = (gf.commercial_assessment ?? gf.commercialAssessment) as Record<string, unknown> | undefined;
  if (!ca || typeof ca !== "object" || Object.keys(ca).length === 0) {
    return {
      hookAssessment: { score: 0, label: "" },
      memorability: { score: 0, label: "" },
      targetMarketMatch: [],
      confidence: 0,
    };
  }

  const hook = (ca.hook_assessment ?? ca.hookAssessment) as Record<string, unknown> | undefined;
  const memo = (ca.memorability ?? ca.memorability) as Record<string, unknown> | undefined;

  return {
    hookAssessment: {
      score: safeNumber(hook ?? {}, "score") ?? 0,
      label: safeString(hook ?? {}, "label") || "",
    },
    memorability: {
      score: safeNumber(memo ?? {}, "score") ?? 0,
      label: safeString(memo ?? {}, "label") || "",
    },
    targetMarketMatch: safeArray(ca, "target_market_match")?.map((m) => ({
      score: safeNumber(m as Record<string, unknown>, "score") ?? 0,
      label: safeString(m as Record<string, unknown>, "label") || "",
    })) ?? [],
    confidence: safeNumber(ca, "confidence") ?? 0,
  };
}

function parseSections(r: Record<string, unknown>): MirSection[] {
  const secs = (r.sections ?? r.sections) as Record<string, unknown>[] | undefined;
  if (!Array.isArray(secs)) return [];

  return secs.map((s) => ({
    id: safeString(s, "id"),
    start: safeNumber(s, "start") ?? 0,
    end: safeNumber(s, "end") ?? 0,
    role: safeString(s, "role"),
    confidence: safeNumber(s, "confidence") ?? 0,
    energyNormalized: safeNumber(s, "energy_normalized") ?? safeNumber(s, "energyNormalized") ?? 0,
    durationSeconds: safeNumber(s, "duration_seconds") ?? safeNumber(s, "durationSeconds") ?? 0,
  }));
}

function parseChords(r: Record<string, unknown>): MirChord[] {
  const ch = (r.chords ?? r.chords) as Record<string, unknown>[] | undefined;
  if (!Array.isArray(ch)) return [];

  return ch.map((c) => ({
    start: safeNumber(c, "start") ?? 0,
    end: safeNumber(c, "end") ?? 0,
    chord: safeString(c, "chord"),
    root: safeString(c, "root"),
    quality: safeString(c, "quality"),
    confidence: safeNumber(c, "confidence") ?? 0,
    romanNumeral: safeString(c, "roman_numeral") || "",
    harmonicFunction: safeString(c, "harmonic_function") || "",
    alternatives: safeArray(c, "alternatives").map((a) => ({
      chord: safeString(a, "chord"),
      confidence: safeNumber(a, "confidence") ?? 0,
    })),
  }));
}

function parseChordSummary(r: Record<string, unknown>): MirChordSummary {
  const cs = (r.chord_summary ?? r.chordSummary) as Record<string, unknown> | undefined;
  if (!cs || typeof cs !== "object") {
    return {
      chordCount: 0,
      distinctChords: [],
      changesPerMinute: 0,
      meanConfidence: 0,
      interpretationStatus: "unknown",
    };
  }

  return {
    chordCount: safeNumber(cs, "chord_count") ?? safeNumber(cs, "chordCount") ?? 0,
    distinctChords: safeArray(cs, "distinct_chords") ?? safeArray(cs, "distinctChords") ?? [],
    changesPerMinute: safeNumber(cs, "changes_per_minute") ?? safeNumber(cs, "changesPerMinute") ?? 0,
    meanConfidence: safeNumber(cs, "mean_confidence") ?? safeNumber(cs, "meanConfidence") ?? 0,
    interpretationStatus: safeString(cs, "interpretation_status") || "unknown",
  };
}

function parseStemSummary(r: Record<string, unknown>): MirStemSummary {
  const ss = (r.stem_summary ?? r.stemSummary) as Record<string, unknown> | undefined;
  if (!ss || typeof ss !== "object") {
    return { stemsDetected: [] };
  }

  return {
    stemsDetected: safeArray(ss, "stems_detected") ?? safeArray(ss, "stemsDetected") ?? [],
  };
}

function parseMixAnalysis(gf: Record<string, unknown>): MirMixAnalysis | undefined {
  const ma = (gf.mix_analysis ?? gf.mixAnalysis) as Record<string, unknown> | undefined;
  if (!ma || typeof ma !== "object") return undefined;

  const stereoWidthData = (ma.stereo_width ?? ma.stereoWidth) as Record<string, unknown> | undefined;
  let stereoWidth: MirMixAnalysis["stereoWidth"];
  if (stereoWidthData && typeof stereoWidthData === "object") {
    stereoWidth = {
      sideToMidDb: safeNumber(stereoWidthData, "side_to_mid_db") ?? safeNumber(stereoWidthData, "sideToMidDb") ?? 0,
      lowFrequencySideToMidDb: safeNumber(stereoWidthData, "low_frequency_side_to_mid_db") ?? safeNumber(stereoWidthData, "lowFrequencySideToMidDb") ?? 0,
      leftRightCorrelation: safeNumber(stereoWidthData, "left_right_correlation") ?? safeNumber(stereoWidthData, "leftRightCorrelation") ?? 0,
      perBand: stereoWidthData.per_band ? Object.fromEntries(
        Object.entries(stereoWidthData.per_band as Record<string, unknown>).map(([k, v]) => [
          k,
          { sideToMidDb: safeNumber(v as Record<string, unknown>, "side_to_mid_db") ?? 0, correlation: safeNumber(v as Record<string, unknown>, "correlation") ?? 0 },
        ])
      ) : undefined,
    };
  }

  return {
    stereoWidth,
    frequencyBands: safeArray(ma, "frequency_bands")?.map((b) => ({
      name: safeString(b, "name"),
      levelDb: safeNumber(b, "level_db") ?? safeNumber(b, "levelDb") ?? 0,
    })),
    mixRisks: safeArray(ma, "mix_risks")?.map((r) => ({
      type: safeString(r, "type"),
      severity: safeString(r, "severity"),
    })),
  };
}

function parseVocalRange(gf: Record<string, unknown>): MirVocalRange | undefined {
  const vr = (gf.vocal_range ?? gf.vocalRange) as Record<string, unknown> | undefined;
  if (!vr || typeof vr !== "object") return undefined;

  return {
    status: safeString(vr, "status"),
    lowestMidiNote: safeNumber(vr, "lowest_midi_note") ?? safeNumber(vr, "lowestMidiNote"),
    highestMidiNote: safeNumber(vr, "highest_midi_note") ?? safeNumber(vr, "highestMidiNote"),
    lowestNote: safeString(vr, "lowest_note") || safeString(vr, "lowestNote"),
    highestNote: safeString(vr, "highest_note") || safeString(vr, "highestNote"),
    semitoneSpan: safeNumber(vr, "semitone_span") ?? safeNumber(vr, "semitoneSpan"),
    robustLowestMidiNote: safeNumber(vr, "robust_lowest_midi_note") ?? safeNumber(vr, "robustLowestMidiNote"),
    robustHighestMidiNote: safeNumber(vr, "robust_highest_midi_note") ?? safeNumber(vr, "robustHighestMidiNote"),
    robustLowestNote: safeString(vr, "robust_lowest_note") || safeString(vr, "robustLowestNote"),
    robustHighestNote: safeString(vr, "robust_highest_note") || safeString(vr, "robustHighestNote"),
    robustSemitoneSpan: safeNumber(vr, "robust_semitone_span") ?? safeNumber(vr, "robustSemitoneSpan"),
    eventCount: safeNumber(vr, "event_count") ?? safeNumber(vr, "eventCount"),
    confidence: safeNumber(vr, "confidence") ?? 0,
    confidenceLevel: safeString(vr, "confidence_level") || safeString(vr, "confidenceLevel"),
  };
}

// ── Track similarity comparison ──────────────────────────────────────────────
// Compare two MIR analysis results to assess musical similarity between tracks.
// Useful for finding hit-sounding songs within a collection.

export interface MirTrackSimilarity {
  /** 0-1 similarity score */
  score: number;
  details: {
    /** Absolute tempo difference in BPM */
    tempoDiff: number;
    /** Whether keys match exactly */
    keyMatch: boolean;
    /** Structure similarity (ratio of shorter structure to longer) */
    structureSimilarity: number;
    /** Genre overlap ratio */
    genreOverlap: number;
    /** Mood/emotion overlap ratio */
    moodOverlap: number;
  };
}

/**
 * Compare two tracks by their MIR features to assess similarity.
 * Weighs tempo (30%), key (15%), structure (15%), genre (20%), and mood (20%).
 */
export function mirCompareSimilarity(a: MirKeyFeatures, b: MirKeyFeatures): MirTrackSimilarity {
  const tempoDiff = Math.abs(a.tempoBpm - b.tempoBpm);
  const tempoMatch = tempoDiff < 10 ? 1 : tempoDiff < 20 ? 0.5 : 0;

  const keyMatch = a.keyLabel === b.keyLabel;

  const genreA = a.genres.map((g) => g.toLowerCase());
  const genreB = b.genres.map((g) => g.toLowerCase());
  const genreOverlap =
    genreA.length === 0 && genreB.length === 0
      ? 1
      : genreA.length === 0 || genreB.length === 0
        ? 0
        : genreA.filter((g) => genreB.includes(g)).length / Math.max(genreA.length, genreB.length);

  const moodA = a.emotions.map((m) => m.toLowerCase());
  const moodB = b.emotions.map((m) => m.toLowerCase());
  const moodOverlap =
    moodA.length === 0 && moodB.length === 0
      ? 1
      : moodA.length === 0 || moodB.length === 0
        ? 0
        : moodA.filter((m) => moodB.includes(m)).length / Math.max(moodA.length, moodB.length);

  const structureA = Math.min(a.structure.length, b.structure.length);
  const structureB = Math.max(a.structure.length, b.structure.length);
  const structureSimilarity = structureB === 0 ? 0 : Math.min(1, structureA / structureB);

  const score =
    tempoMatch * 0.3 + (keyMatch ? 1 : 0) * 0.15 + structureSimilarity * 0.15 + genreOverlap * 0.2 + moodOverlap * 0.2;

  return {
    score: Math.round(score * 100) / 100,
    details: {
      tempoDiff,
      keyMatch,
      structureSimilarity: Math.round(structureSimilarity * 100) / 100,
      genreOverlap: Math.round(genreOverlap * 100) / 100,
      moodOverlap: Math.round(moodOverlap * 100) / 100,
    },
  };
}

// ── Safe field accessors ─────────────────────────────────────────────────────
// These accept either a known Record type or any `object`/`unknown` value,
// making them safe to use after typeof narrowing.

function safeString(obj: Record<string, unknown> | object | undefined | null, key: string): string {
  if (!obj) return "";
  const val = (obj as Record<string, unknown>)[key];
  return typeof val === "string" ? val : "";
}

function safeNumber(obj: Record<string, unknown> | object | undefined | null, key: string): number {
  if (!obj) return 0;
  const val = (obj as Record<string, unknown>)[key];
  return typeof val === "number" ? val : 0;
}

function safeBoolean(obj: Record<string, unknown> | object | undefined | null, key: string): boolean {
  if (!obj) return false;
  const val = (obj as Record<string, unknown>)[key];
  return typeof val === "boolean" ? val : false;
}

function safeNullable(
  obj: Record<string, unknown> | object | undefined | null,
  key: string,
): string | null {
  if (!obj) return null;
  const val = (obj as Record<string, unknown>)[key];
  return val === null ? null : typeof val === "string" ? val : null;
}

function safeArray<T = Record<string, unknown>>(obj: Record<string, unknown> | object | undefined | null, key: string): T[] {
  if (!obj) return [];
  const val = (obj as Record<string, unknown>)[key];
  return Array.isArray(val) ? (val as T[]) : [];
}
