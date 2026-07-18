import { describe, expect, it } from "vitest";
import { mirCompareSimilarity, mirExtractKeyFeatures, mirParseResponse, type MirAnalysisResult, type MirKeyFeatures } from "./mir-analysis.js";

describe("mirParseResponse", () => {
  it("parses a minimal MIR response", () => {
    const raw: Record<string, unknown> = {
      analysis_id: "ana_123",
      status: "completed",
      source: {
        path: "/tmp/test.mp3",
        filename: "test.mp3",
        input_url: "https://example.com/test.mp3",
        platform: "direct_url",
        resolution_status: "direct",
        resolved_url: "https://example.com/test.mp3",
        track_id: null,
      },
      global_features: {
        duration_seconds: 180.5,
        sample_rate_hz: 44100,
        channels: 2,
        rms_db: -12.5,
        peak_db: -0.5,
        spectral_centroid_hz: 3000,
        rhythm: {
          tempo: {
            selected_bpm: 120,
            perceived_bpm: 60,
            candidates: [{ bpm: 120, role: "metrical", support: 0.9, confidence: 0.95 }],
            confidence: 0.95,
          },
          tempo_curve: { points: [] },
          beats: [
            { beat_index: 0, time_seconds: 0.5, interval_seconds: 0.5, deviation_ms: 0 },
            { beat_index: 1, time_seconds: 1.0, interval_seconds: 0.5, deviation_ms: 1 },
          ],
          downbeats: [0, 4, 8],
          selected_meter: "4/4",
          meter_candidates: [{ meter: "4/4", confidence: 0.9 }],
          confidence: 0.95,
        },
        key: {
          tonic: "C",
          scale: "major",
          label: "C major",
          confidence: 0.85,
          candidates: [
            { tonic: "C", scale: "major", label: "C major", confidence: 0.85 },
            { tonic: "A", scale: "minor", label: "A minor", confidence: 0.4 },
          ],
          review_required: false,
        },
        key_timeline: [
          { start: 0, end: 180, tonic: "C", scale: "major", label: "C major", confidence: 0.85, review_required: false },
        ],
        tags: {
          instrumentation: ["piano", "drums"],
          genre: ["pop", "electronic"],
          emotion: ["upbeat", "energetic"],
          confidence: 0.75,
        },
        commercial_assessment: {
          hook_assessment: { score: 0.8, label: "strong" },
          memorability: { score: 0.7, label: "high" },
          target_market_match: [{ score: 0.85, label: "young adult" }],
          confidence: 0.8,
        },
      },
      sections: [
        { id: "s1", start: 0, end: 16, role: "intro", confidence: 0.8, energy_normalized: 0.3, duration_seconds: 16 },
        { id: "s2", start: 16, end: 64, role: "verse", confidence: 0.7, energy_normalized: 0.5, duration_seconds: 48 },
        { id: "s3", start: 64, end: 96, role: "chorus", confidence: 0.9, energy_normalized: 0.9, duration_seconds: 32 },
      ],
      chords: [
        { start: 0, end: 4, chord: "C:maj", root: "C", quality: "maj", confidence: 0.9, roman_numeral: "I", harmonic_function: "tonic", alternatives: [] },
        { start: 4, end: 8, chord: "G:maj", root: "G", quality: "maj", confidence: 0.85, roman_numeral: "V", harmonic_function: "dominant", alternatives: [] },
      ],
      chord_summary: {
        chord_count: 8,
        distinct_chords: ["C:maj", "G:maj", "A:min", "F:maj"],
        changes_per_minute: 12,
        mean_confidence: 0.88,
        interpretation_status: "reliable",
      },
      stem_summary: {
        stems_detected: ["vocals", "drums", "bass", "other"],
      },
      evidence: [],
      goal: "test analysis",
      level: "standard",
    };

    const result = mirParseResponse(raw);

    expect(result.analysisId).toBe("ana_123");
    expect(result.status).toBe("completed");
    expect(result.source.inputUrl).toBe("https://example.com/test.mp3");
    expect(result.globalFeatures.durationSeconds).toBe(180.5);
    expect(result.globalFeatures.rhythm.tempo.selectedBpm).toBe(120);
    expect(result.globalFeatures.key.label).toBe("C major");
    expect(result.globalFeatures.rhythm.tempo.confidence).toBe(0.95);
    expect(result.sections).toHaveLength(3);
    expect(result.sections[0].role).toBe("intro");
    expect(result.sections[2].role).toBe("chorus");
    expect(result.chords).toHaveLength(2);
    expect(result.chordSummary.distinctChords).toContain("C:maj");
    expect(result.stemSummary.stemsDetected).toContain("vocals");
  });

  it("extracts integrated loudness from professional_loudness", () => {
    const parsed = mirParseResponse({
      analysis_id: "ana_789",
      status: "completed",
      source: { path: "", filename: "", input_url: "", platform: "", resolution_status: "", resolved_url: "", track_id: null },
      global_features: {
        duration_seconds: 210,
        sample_rate_hz: 48000,
        channels: 2,
        rms_db: -14,
        peak_db: -1.2,
        spectral_centroid_hz: 3200,
        professional_loudness: {
          integrated_lufs: -14.5,
          timeline: [
            { integrated_lufs: -15.2 },
            { integrated_lufs: -14.8 },
            { integrated_lufs: -14.5 },
          ],
        },
        rhythm: {
          tempo: { selected_bpm: 126, perceived_bpm: 63, candidates: [], confidence: 0.97 },
          tempo_curve: { points: [] },
          beats: [],
          downbeats: [],
          selected_meter: "4/4",
          meter_candidates: [],
          confidence: 0.97,
        },
        key: { tonic: "D", scale: "minor", label: "D minor", confidence: 0.88, candidates: [], review_required: false },
        key_timeline: [],
        tags: { instrumentation: ["synth", "pad"], genre: ["synthwave", "electronic"], emotion: ["dreamy", "melancholic"], confidence: 0.82 },
        commercial_assessment: {
          hook_assessment: { score: 0.68, label: "moderate" },
          memorability: { score: 0.61, label: "medium" },
          target_market_match: [],
          confidence: 0.75,
        },
      },
      sections: [
        { id: "s1", start: 0, end: 20, role: "intro", confidence: 0.7, energy_normalized: 0.2, duration_seconds: 20 },
        { id: "s2", start: 20, end: 80, role: "verse", confidence: 0.8, energy_normalized: 0.5, duration_seconds: 60 },
        { id: "s3", start: 80, end: 130, role: "chorus", confidence: 0.92, energy_normalized: 0.95, duration_seconds: 50 },
        { id: "s4", start: 130, end: 180, role: "verse", confidence: 0.78, energy_normalized: 0.55, duration_seconds: 50 },
        { id: "s5", start: 180, end: 210, role: "chorus", confidence: 0.9, energy_normalized: 0.93, duration_seconds: 30 },
      ],
      chords: [],
      chord_summary: { chord_count: 0, distinct_chords: [], changes_per_minute: 0, mean_confidence: 0, interpretation_status: "none" },
      stem_summary: { stems_detected: ["vocals", "synth", "bass", "drums"] },
      evidence: [],
      goal: "full analysis",
      level: "standard",
    });

    const features = mirExtractKeyFeatures(parsed);

    expect(features.integratedLoudness).toBe(-14.5);
    expect(features.tempoBpm).toBe(126);
    expect(features.keyLabel).toBe("D minor");
    expect(features.duration).toBe(210);
    expect(features.structure).toHaveLength(5);
    expect(features.structure[2].role).toBe("chorus");
    expect(features.genres).toEqual(["synthwave", "electronic"]);
    expect(features.emotions).toEqual(["dreamy", "melancholic"]);
  });

  it("extracts key features from parsed response", () => {
    const parsed: MirAnalysisResult = mirParseResponse({
      analysis_id: "ana_456",
      status: "completed",
      source: { path: "", filename: "", input_url: "", platform: "", resolution_status: "", resolved_url: "", track_id: null },
      global_features: {
        duration_seconds: 200,
        sample_rate_hz: 44100,
        channels: 2,
        rms_db: -10,
        peak_db: -1,
        spectral_centroid_hz: 3500,
        rhythm: {
          tempo: { selected_bpm: 128, perceived_bpm: 64, candidates: [], confidence: 0.99 },
          tempo_curve: { points: [] },
          beats: [],
          downbeats: [],
          selected_meter: "4/4",
          meter_candidates: [],
          confidence: 0.99,
        },
        key: { tonic: "Am", scale: "minor", label: "A minor", confidence: 0.9, candidates: [], review_required: false },
        key_timeline: [
          { start: 0, end: 100, tonic: "Am", scale: "minor", label: "A minor", confidence: 0.9, review_required: false },
          { start: 100, end: 200, tonic: "C", scale: "major", label: "C major", confidence: 0.8, review_required: false },
        ],
        tags: { instrumentation: ["synth"], genre: ["synthwave"], emotion: ["nostalgic"], confidence: 0.7 },
        commercial_assessment: {
          hook_assessment: { score: 0.75, label: "good" },
          memorability: { score: 0.65, label: "medium" },
          target_market_match: [],
          confidence: 0.7,
        },
      },
      sections: [{ id: "s1", start: 0, end: 200, role: "full_track", confidence: 0.5, energy_normalized: 0.6, duration_seconds: 200 }],
      chords: [],
      chord_summary: { chord_count: 0, distinct_chords: [], changes_per_minute: 0, mean_confidence: 0, interpretation_status: "none" },
      stem_summary: { stems_detected: ["synth"] },
      evidence: [],
      goal: "test",
      level: "standard",
    });

    const features = mirExtractKeyFeatures(parsed);

    expect(features.duration).toBe(200);
    expect(features.tempoBpm).toBe(128);
    expect(features.keyLabel).toBe("A minor");
    expect(features.genres).toContain("synthwave");
    expect(features.emotions).toContain("nostalgic");
    expect(features.keyChanges).toHaveLength(1);
    expect(features.keyChanges[0].from).toBe("A minor");
    expect(features.keyChanges[0].to).toBe("C major");
    expect(features.keyChanges[0].at).toBe(100);
    expect(features.structure).toHaveLength(1);
    expect(features.structure[0].role).toBe("full_track");
    expect(features.commercialHookScore).toBe(0.75);
    expect(features.memorabilityScore).toBe(0.65);
  });

  it("extracts vocal range and stereo width from extended MIR fields", () => {
    const parsed = mirParseResponse({
      analysis_id: "ana_ext",
      status: "completed",
      source: { path: "", filename: "", input_url: "", platform: "", resolution_status: "", resolved_url: "", track_id: null },
      global_features: {
        duration_seconds: 200,
        sample_rate_hz: 44100,
        channels: 2,
        rms_db: -10,
        peak_db: -1,
        spectral_centroid_hz: 3000,
        professional_loudness: { integrated_lufs: -12, loudness_range_lu: 8.5, sample_peak_dbfs: -0.5, true_peak_dbfs: -1.2 },
        vocal_range: {
          robust_lowest_note: "C3",
          robust_highest_note: "C5",
          robust_semitone_span: 24,
          confidence: 0.92,
          confidence_level: "high",
        },
        rhythm: {
          tempo: { selected_bpm: 120, perceived_bpm: 60, candidates: [], confidence: 0.95 },
          tempo_curve: { points: [] },
          beats: [
            { beat_index: 0, time_seconds: 0.5, interval_seconds: 0.5, deviation_ms: 0 },
            { beat_index: 1, time_seconds: 1.0, interval_seconds: 0.5, deviation_ms: 0 },
            { beat_index: 2, time_seconds: 1.5, interval_seconds: 0.5, deviation_ms: 0 },
            { beat_index: 3, time_seconds: 2.0, interval_seconds: 0.5, deviation_ms: 0 },
          ],
          downbeats: [0, 4, 8],
          selected_meter: "4/4",
          meter_candidates: [],
          confidence: 0.95,
        },
        key: { tonic: "C", scale: "major", label: "C major", confidence: 0.9, candidates: [], review_required: false },
        key_timeline: [],
        tags: { instrumentation: ["vocals"], genre: ["pop"], emotion: ["upbeat"], confidence: 0.8 },
        commercial_assessment: {
          hook_assessment: { score: 0.8, label: "strong" },
          memorability: { score: 0.7, label: "high" },
          target_market_match: [],
          confidence: 0.8,
        },
        mix_analysis: {
          stereo_width: {
            side_to_mid_db: -3.5,
            low_frequency_side_to_mid_db: -5.0,
            left_right_correlation: 0.72,
          },
          frequency_bands: [{ name: "sub", level_db: -20 }, { name: "bass", level_db: -10 }],
          mix_risks: [],
        },
      },
      sections: [{ id: "s1", start: 0, end: 200, role: "full_track", confidence: 0.5, energy_normalized: 0.6, duration_seconds: 200 }],
      chords: [],
      chord_summary: { chord_count: 0, distinct_chords: [], changes_per_minute: 0, mean_confidence: 0, interpretation_status: "none" },
      stem_summary: { stems_detected: ["vocals"] },
      evidence: [],
      goal: "test",
      level: "standard",
    });

    const features = mirExtractKeyFeatures(parsed);

    expect(features.vocalRange).toBe("C3 – C5");
    expect(features.vocalSemitoneSpan).toBe(24);
    expect(features.stereoWidth).toBe(0.72);
    expect(features.integratedLoudness).toBe(-12);
    expect(features.loudnessRange).toBe(8.5);
    expect(features.meter).toBe("4/4");
    expect(features.beatTimes).toEqual([0.5, 1.0, 1.5, 2.0]);
    expect(features.downbeatIndices).toEqual([0, 4, 8]);
  });

  it("compares two tracks by similarity", () => {
    const trackA: MirKeyFeatures = {
      duration: 200,
      tempoBpm: 120,
      perceivedBpm: 60,
      tempoConfidence: 0.95,
      keyTonic: "C",
      keyScale: "major",
      keyLabel: "C major",
      keyConfidence: 0.9,
      genres: ["pop", "dance"],
      emotions: ["upbeat", "energetic"],
      instrumentation: ["synth", "drums"],
      structure: [{ role: "verse", start: 0, end: 30, duration: 30 }, { role: "chorus", start: 30, end: 60, duration: 30 }],
      chordChangesPerMinute: 10,
      distinctChords: ["C:maj", "G:maj", "Am"],
      commercialHookScore: 0.8,
      memorabilityScore: 0.7,
      rmsDb: -10,
      integratedLoudness: -12,
      keyChanges: [],
      beatTimes: [],
      downbeatIndices: [],
      meter: "4/4",
    };

    const trackB: MirKeyFeatures = {
      duration: 210,
      tempoBpm: 118,
      perceivedBpm: 59,
      tempoConfidence: 0.93,
      keyTonic: "C",
      keyScale: "major",
      keyLabel: "C major",
      keyConfidence: 0.88,
      genres: ["pop", "electronic"],
      emotions: ["upbeat", "bright"],
      instrumentation: ["piano", "drums"],
      structure: [
        { role: "intro", start: 0, end: 10, duration: 10 },
        { role: "verse", start: 10, end: 40, duration: 30 },
        { role: "chorus", start: 40, end: 70, duration: 30 },
      ],
      chordChangesPerMinute: 9,
      distinctChords: ["C:maj", "F:maj", "G:maj"],
      commercialHookScore: 0.75,
      memorabilityScore: 0.65,
      rmsDb: -11,
      integratedLoudness: -13,
      keyChanges: [],
      beatTimes: [],
      downbeatIndices: [],
      meter: "4/4",
    };

    const sim = mirCompareSimilarity(trackA, trackB);

    expect(sim.score).toBeGreaterThan(0);
    expect(sim.score).toBeLessThan(1);
    expect(sim.details.tempoDiff).toBe(2);
    expect(sim.details.keyMatch).toBe(true);
    expect(sim.details.genreOverlap).toBeGreaterThan(0);
    expect(sim.details.moodOverlap).toBeGreaterThan(0);
  });

  it("returns low similarity for very different tracks", () => {
    const trackA: MirKeyFeatures = {
      duration: 200,
      tempoBpm: 140,
      perceivedBpm: 70,
      tempoConfidence: 0.9,
      keyTonic: "Am",
      keyScale: "minor",
      keyLabel: "A minor",
      keyConfidence: 0.85,
      genres: ["metal", "rock"],
      emotions: ["aggressive", "dark"],
      instrumentation: ["guitar", "bass"],
      structure: [{ role: "intro", start: 0, end: 10, duration: 10 }, { role: "verse", start: 10, end: 50, duration: 40 }],
      chordChangesPerMinute: 8,
      distinctChords: ["Am", "Dm", "Em"],
      commercialHookScore: 0.3,
      memorabilityScore: 0.2,
      rmsDb: -6,
      integratedLoudness: -8,
      keyChanges: [],
      beatTimes: [],
      downbeatIndices: [],
      meter: "4/4",
    };

    const trackB: MirKeyFeatures = {
      duration: 180,
      tempoBpm: 70,
      perceivedBpm: 70,
      tempoConfidence: 0.92,
      keyTonic: "C",
      keyScale: "major",
      keyLabel: "C major",
      keyConfidence: 0.88,
      genres: ["jazz", "lofi"],
      emotions: ["calm", "relaxed"],
      instrumentation: ["piano", "saxophone"],
      structure: [{ role: "full_track", start: 0, end: 180, duration: 180 }],
      chordChangesPerMinute: 3,
      distinctChords: ["Cmaj7", "Dm7", "G7"],
      commercialHookScore: 0.1,
      memorabilityScore: 0.15,
      rmsDb: -18,
      integratedLoudness: -20,
      keyChanges: [],
      beatTimes: [],
      downbeatIndices: [],
      meter: "3/4",
    };

    const sim = mirCompareSimilarity(trackA, trackB);

    expect(sim.score).toBeLessThan(0.3);
    expect(sim.details.tempoDiff).toBe(70);
    expect(sim.details.keyMatch).toBe(false);
  });
});
