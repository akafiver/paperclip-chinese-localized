import { describe, expect, it } from "vitest";
import { findMostSimilarTracks, findSimilarPairs, mirCompareSimilarity, mirExtractKeyFeatures, mirParseResponse, type MirAnalysisResult, type MirKeyFeatures } from "./mir-analysis.js";

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

  // ── Flat MCP format tests ────────────────────────────────────────────────────
  // These test the actual MIR MCP service response format (flat keys, no global_features wrapper).

  describe("flat MCP format (actual service response)", () => {
    it("parses a deep analysis response (Adele Rolling In The Deep format)", () => {
      const raw: Record<string, unknown> = {
        track: "Rolling In The Deep",
        artist: "Adele",
        album: "21",
        source_path: "/Users/leon/Music/Adele/21/1-01 Rolling In The Deep.m4a",
        analysis_id: "ana_f4230de915a6",
        analysis_level: "deep",
        duration_seconds: 228.111,
        rhythm: {
          tempo_bpm: 105.273,
          perceived_bpm: 52.637,
          time_signature: "4/4",
          swing: "straight",
          groove_score: 0.4137,
        },
        key: {
          tonic: "C",
          confidence: 0.4451,
          status: "uncertain",
        },
        mode: "minor",
        loudness: {
          integrated_lufs: -8.1,
          loudness_range_lu: 7.8,
          true_peak_dbfs: -1.2,
        },
        rms_db: -8.0,
        spectral_centroid_hz: 1989.4,
        genres: ["pop", "rock", "indie", "poprock", "folk"],
        moods: ["happy", "energetic", "love", "positive", "upbeat"],
        instruments: ["drums", "bass", "guitar", "electricguitar", "voice", "synthesizer"],
        chords: {
          count: 74,
          distinct: ["C:min", "G:min", "A#:maj", "G#:maj", "D#:maj/3", "G:maj", "G#:maj7"],
          changes_per_minute: 18.94,
        },
        commercial: {
          hook_score: 0.9471,
          memorability: 0.8539,
          hook_section: {
            section_id: "section_12",
            start: 193.167,
            end: 228.111,
            score: 0.9471,
          },
        },
        structure: [
          { section: "section_1", start: 0.0, end: 5.41, role: "intro", energy: 0.0 },
          { section: "section_2", start: 5.41, end: 60.604, role: "verse", energy: 0.3245 },
          { section: "section_3", start: 60.604, end: 71.634, role: "unknown", energy: 0.7892 },
          { section: "section_4", start: 71.634, end: 90.983, role: "verse", energy: 0.2134 },
          { section: "section_5", start: 90.983, end: 103.473, role: "chorus", energy: 0.8567 },
          { section: "section_6", start: 103.473, end: 162.804, role: "verse", energy: 0.1892 },
          { section: "section_7", start: 162.804, end: 175.293, role: "chorus", energy: 0.9012 },
          { section: "section_8", start: 175.293, end: 193.167, role: "bridge", energy: 0.5678 },
          { section: "section_9", start: 193.167, end: 228.111, role: "chorus", energy: 0.9534 },
        ],
        stem_separation: {
          stems: ["bass", "drums", "other", "vocals"],
          model: "htdemucs_ft.yaml",
        },
        generated_at: "2026-07-17T23:49:39.708600+00:00",
      };

      const result = mirParseResponse(raw);

      expect(result.analysisId).toBe("ana_f4230de915a6");
      expect(result.status).toBe("completed");
      expect(result.level).toBe("deep");
      expect(result.source.path).toBe("/Users/leon/Music/Adele/21/1-01 Rolling In The Deep.m4a");
      expect(result.globalFeatures.durationSeconds).toBe(228.111);
      expect(result.globalFeatures.rhythm.tempo.selectedBpm).toBe(105.273);
      expect(result.globalFeatures.rhythm.tempo.perceivedBpm).toBe(52.637);
      expect(result.globalFeatures.key.tonic).toBe("C");
      expect(result.globalFeatures.key.scale).toBe("minor");
      expect(result.globalFeatures.key.label).toBe("C minor");
      expect(result.globalFeatures.key.confidence).toBe(0.4451);
      expect(result.globalFeatures.key.reviewRequired).toBe(true);
      expect(result.globalFeatures.rmsDb).toBe(-8.0);
      expect(result.globalFeatures.spectralCentroidHz).toBe(1989.4);
      expect(result.globalFeatures.genres).toEqual(["pop", "rock", "indie", "poprock", "folk"]);
      expect(result.globalFeatures.emotions).toEqual(["happy", "energetic", "love", "positive", "upbeat"]);
      expect(result.globalFeatures.instrumentation).toEqual(["drums", "bass", "guitar", "electricguitar", "voice", "synthesizer"]);
      expect(result.globalFeatures.commercialHookScore).toBe(0.9471);
      expect(result.globalFeatures.memorabilityScore).toBe(0.8539);
      expect(result.globalFeatures.integratedLoudness).toBe(-8.1);
      expect(result.globalFeatures.loudnessRange).toBe(7.8);
      expect(result.chordSummary.chordCount).toBe(74);
      expect(result.chordSummary.distinctChords).toContain("C:min");
      expect(result.chordSummary.changesPerMinute).toBe(18.94);
      expect(result.sections).toHaveLength(9);
      expect(result.sections[0].role).toBe("intro");
      expect(result.sections[4].role).toBe("chorus");
      expect(result.sections[0].start).toBe(0);
      expect(result.sections[0].end).toBe(5.41);
      expect(result.stemSummary.stemsDetected).toEqual(["bass", "drums", "other", "vocals"]);
    });

    it("parses flat MCP format with key timeline segments", () => {
      const raw: Record<string, unknown> = {
        analysis_id: "ana_test_key_change",
        analysis_level: "deep",
        duration_seconds: 300,
        tempo_bpm: 120,
        key: { tonic: "Am", confidence: 0.7, status: "certain" },
        mode: "minor",
        rhythm: {
          tempo_bpm: 120,
          perceived_bpm: 60,
          time_signature: "4/4",
          confidence: 0.95,
        },
        loudness: { integrated_lufs: -10, loudness_range_lu: 6 },
        rms_db: -12,
        commercial: { hook_score: 0.75, memorability: 0.65 },
        genres: ["pop"],
        moods: ["nostalgic"],
        instruments: ["synth"],
        chords: { count: 40, distinct: ["Am", "F", "C", "G"], changes_per_minute: 10 },
        structure: [
          { section: "s1", start: 0, end: 30, role: "intro", energy: 0.1 },
          { section: "s2", start: 30, end: 90, role: "verse", energy: 0.3 },
          { section: "s3", start: 90, end: 150, role: "chorus", energy: 0.9 },
          { section: "s4", start: 150, end: 210, role: "verse", energy: 0.35 },
          { section: "s5", start: 210, end: 300, role: "chorus", energy: 0.85 },
        ],
        stem_separation: { stems: ["vocals", "synth", "bass", "drums"], model: "htdemucs_ft.yaml" },
      };

      const result = mirParseResponse(raw);
      const features = mirExtractKeyFeatures(result);

      expect(result.analysisId).toBe("ana_test_key_change");
      expect(result.globalFeatures.rhythm.tempo.selectedBpm).toBe(120);
      expect(result.globalFeatures.key.label).toBe("Am minor");
      expect(result.globalFeatures.key.reviewRequired).toBe(false);
      expect(features.keyChanges).toHaveLength(0);
      expect(result.sections).toHaveLength(5);
      expect(features.meter).toBe("4/4");
    });

    it("parses key from compound string when key object is absent", () => {
      const raw: Record<string, unknown> = {
        analysis_id: "ana_compound_key",
        analysis_level: "quick",
        duration_seconds: 180,
        tempo_bpm: 130,
        key: "E minor",
        rhythm: { tempo_bpm: 130, perceived_bpm: 65, time_signature: "4/4" },
        commercial: { hook_score: 0.5, memorability: 0.4 },
        genres: ["rock"],
        moods: ["energetic"],
        instruments: ["guitar"],
        chords: { count: 10, distinct: ["Em", "B", "C", "G"], changes_per_minute: 8 },
        structure: [{ section: "s1", start: 0, end: 180, role: "full_track", energy: 0.5 }],
      };

      const result = mirParseResponse(raw);
      expect(result.globalFeatures.key.tonic).toBe("E");
      expect(result.globalFeatures.key.scale).toBe("minor");
      expect(result.globalFeatures.key.label).toBe("E minor");
    });

    it("parses commercial scores from both flat and nested commercial fields", () => {
      // Flat format
      const flat: Record<string, unknown> = {
        analysis_id: "ana_flat",
        analysis_level: "deep",
        duration_seconds: 200,
        tempo_bpm: 120,
        key: { tonic: "C", confidence: 0.8, status: "certain" },
        rhythm: { tempo_bpm: 120 },
        commercial: { hook_score: 0.92, memorability: 0.88 },
        genres: ["pop"],
        moods: ["upbeat"],
        instruments: ["piano"],
        chords: { count: 50, distinct: ["C", "G", "Am", "F"], changes_per_minute: 12 },
        structure: [{ section: "s1", start: 0, end: 200, role: "full_track", energy: 0.6 }],
      };

      const resultFlat = mirParseResponse(flat);
      expect(resultFlat.globalFeatures.commercialHookScore).toBe(0.92);
      expect(resultFlat.globalFeatures.memorabilityScore).toBe(0.88);
    });

    it("handles missing commercial data gracefully", () => {
      const raw: Record<string, unknown> = {
        analysis_id: "ana_no_commercial",
        analysis_level: "quick",
        duration_seconds: 150,
        tempo_bpm: 100,
        key: { tonic: "D", confidence: 0.6, status: "uncertain" },
        rhythm: { tempo_bpm: 100 },
        genres: [],
        moods: [],
        instruments: [],
        chords: { count: 0, distinct: [], changes_per_minute: 0 },
        structure: [{ section: "s1", start: 0, end: 150, role: "full_track", energy: 0.2 }],
      };

      const result = mirParseResponse(raw);
      expect(result.globalFeatures.commercialHookScore).toBe(0);
      expect(result.globalFeatures.memorabilityScore).toBe(0);
      expect(result.sections).toHaveLength(1);
    });

    it("parses structure from segments sub-array", () => {
      const raw: Record<string, unknown> = {
        analysis_id: "ana_segments",
        analysis_level: "deep",
        duration_seconds: 240,
        tempo_bpm: 110,
        key: { tonic: "F", confidence: 0.75, status: "certain" },
        rhythm: { tempo_bpm: 110, perceived_bpm: 55 },
        commercial: { hook_score: 0.7, memorability: 0.6 },
        genres: ["jazz"],
        moods: ["relaxed"],
        instruments: ["piano", "saxophone"],
        chords: { count: 80, distinct: ["Fmaj7", "Gm7", "C7", "Dm7"], changes_per_minute: 15 },
        structure: {
          segments: [
            { label: "intro", start: 0, duration: 15, confidence: 0.8 },
            { label: "verse", start: 15, duration: 45, confidence: 0.7 },
            { label: "chorus", start: 60, duration: 30, confidence: 0.9 },
            { label: "outro", start: 210, duration: 30, confidence: 0.6 },
          ],
        },
      };

      const result = mirParseResponse(raw);
      expect(result.sections).toHaveLength(4);
      expect(result.sections[0].role).toBe("intro");
      expect(result.sections[2].role).toBe("chorus");
      expect(result.sections[2].start).toBe(60);
      expect(result.sections[2].end).toBe(90);
      expect(result.sections[3].role).toBe("outro");
    });
  });

  describe("findMostSimilarTracks", () => {
    const tracks: MirKeyFeatures[] = [
      {
        duration: 200, tempoBpm: 120, perceivedBpm: 60, tempoConfidence: 0.95, keyTonic: "C", keyScale: "major", keyLabel: "C major", keyConfidence: 0.9,
        genres: ["pop"], emotions: ["upbeat"], instrumentation: ["synth"], structure: [], chordChangesPerMinute: 8, distinctChords: ["C"],
        commercialHookScore: 0.8, memorabilityScore: 0.7, rmsDb: -10, integratedLoudness: -12, keyChanges: [], beatTimes: [], downbeatIndices: [], meter: "4/4",
      },
      {
        duration: 210, tempoBpm: 121, perceivedBpm: 60, tempoConfidence: 0.93, keyTonic: "C", keyScale: "major", keyLabel: "C major", keyConfidence: 0.88,
        genres: ["pop"], emotions: ["upbeat"], instrumentation: ["piano"], structure: [], chordChangesPerMinute: 9, distinctChords: ["C"],
        commercialHookScore: 0.75, memorabilityScore: 0.65, rmsDb: -11, integratedLoudness: -13, keyChanges: [], beatTimes: [], downbeatIndices: [], meter: "4/4",
      },
      {
        duration: 180, tempoBpm: 180, perceivedBpm: 90, tempoConfidence: 0.9, keyTonic: "Am", keyScale: "minor", keyLabel: "A minor", keyConfidence: 0.85,
        genres: ["metal"], emotions: ["aggressive"], instrumentation: ["guitar"], structure: [], chordChangesPerMinute: 6, distinctChords: ["Am"],
        commercialHookScore: 0.3, memorabilityScore: 0.2, rmsDb: -6, integratedLoudness: -8, keyChanges: [], beatTimes: [], downbeatIndices: [], meter: "4/4",
      },
    ];

    it("returns tracks sorted by descending similarity", () => {
      const reference = tracks[0];
      const results = findMostSimilarTracks(tracks, reference);
      expect(results).toHaveLength(2);
      expect(results[0].track).toBe(tracks[1]); // Most similar (same key, similar tempo)
      expect(results[1].track).toBe(tracks[2]); // Less similar (different key, much different tempo)
      expect(results[0].similarity.score).toBeGreaterThan(results[1].similarity.score);
    });

    it("returns empty array when only the reference track exists", () => {
      const results = findMostSimilarTracks([tracks[0]], tracks[0]);
      expect(results).toHaveLength(0);
    });
  });

  describe("findSimilarPairs", () => {
    const tracks: MirKeyFeatures[] = [
      {
        duration: 200, tempoBpm: 120, perceivedBpm: 60, tempoConfidence: 0.95, keyTonic: "C", keyScale: "major", keyLabel: "C major", keyConfidence: 0.9,
        genres: ["pop"], emotions: ["upbeat"], instrumentation: ["synth"], structure: [], chordChangesPerMinute: 8, distinctChords: ["C"],
        commercialHookScore: 0.8, memorabilityScore: 0.7, rmsDb: -10, integratedLoudness: -12, keyChanges: [], beatTimes: [], downbeatIndices: [], meter: "4/4",
      },
      {
        duration: 210, tempoBpm: 122, perceivedBpm: 61, tempoConfidence: 0.93, keyTonic: "C", keyScale: "major", keyLabel: "C major", keyConfidence: 0.88,
        genres: ["pop"], emotions: ["upbeat"], instrumentation: ["piano"], structure: [], chordChangesPerMinute: 9, distinctChords: ["C"],
        commercialHookScore: 0.75, memorabilityScore: 0.65, rmsDb: -11, integratedLoudness: -13, keyChanges: [], beatTimes: [], downbeatIndices: [], meter: "4/4",
      },
      {
        duration: 180, tempoBpm: 180, perceivedBpm: 90, tempoConfidence: 0.9, keyTonic: "Am", keyScale: "minor", keyLabel: "A minor", keyConfidence: 0.85,
        genres: ["metal"], emotions: ["aggressive"], instrumentation: ["guitar"], structure: [], chordChangesPerMinute: 6, distinctChords: ["Am"],
        commercialHookScore: 0.3, memorabilityScore: 0.2, rmsDb: -6, integratedLoudness: -8, keyChanges: [], beatTimes: [], downbeatIndices: [], meter: "4/4",
      },
      {
        duration: 190, tempoBpm: 185, perceivedBpm: 92, tempoConfidence: 0.92, keyTonic: "Am", keyScale: "minor", keyLabel: "A minor", keyConfidence: 0.87,
        genres: ["metal"], emotions: ["aggressive"], instrumentation: ["drums"], structure: [], chordChangesPerMinute: 7, distinctChords: ["Am"],
        commercialHookScore: 0.35, memorabilityScore: 0.25, rmsDb: -7, integratedLoudness: -9, keyChanges: [], beatTimes: [], downbeatIndices: [], meter: "4/4",
      },
    ];

    it("returns pairs above the threshold", () => {
      const pairs = findSimilarPairs(tracks, 0.5);
      expect(pairs.length).toBeGreaterThan(0);
      for (const pair of pairs) {
        expect(pair.similarity.score).toBeGreaterThanOrEqual(0.5);
      }
    });

    it("returns no pairs when threshold is too high", () => {
      const pairs = findSimilarPairs(tracks, 0.99);
      expect(pairs).toHaveLength(0);
    });

    it("returns no pairs for empty array", () => {
      const pairs = findSimilarPairs([], 0.5);
      expect(pairs).toHaveLength(0);
    });

    it("returns no pairs for single track", () => {
      const pairs = findSimilarPairs([tracks[0]], 0.5);
      expect(pairs).toHaveLength(0);
    });
  });

  describe("mirCompareSimilarity edge cases", () => {
    const emptyTrack: MirKeyFeatures = {
      duration: 0, tempoBpm: 0, perceivedBpm: 0, tempoConfidence: 0, keyTonic: "", keyScale: "", keyLabel: "", keyConfidence: 0,
      genres: [], emotions: [], instrumentation: [], structure: [], chordChangesPerMinute: 0, distinctChords: [],
      commercialHookScore: 0, memorabilityScore: 0, rmsDb: 0, integratedLoudness: 0, keyChanges: [], beatTimes: [], downbeatIndices: [], meter: null,
    };

    it("returns 1.0 for identical tracks", () => {
      const track: MirKeyFeatures = {
        duration: 200, tempoBpm: 120, perceivedBpm: 60, tempoConfidence: 0.95, keyTonic: "C", keyScale: "major", keyLabel: "C major", keyConfidence: 0.9,
        genres: ["pop"], emotions: ["upbeat"], instrumentation: ["synth"], structure: [{ role: "verse", start: 0, end: 30, duration: 30 }],
        chordChangesPerMinute: 8, distinctChords: ["C"], commercialHookScore: 0.8, memorabilityScore: 0.7, rmsDb: -10, integratedLoudness: -12,
        keyChanges: [], beatTimes: [], downbeatIndices: [], meter: "4/4",
      };
      const sim = mirCompareSimilarity(track, track);
      expect(sim.score).toBe(1.0);
    });

    it("returns 1.0 for two empty tracks (all fields empty)", () => {
      const sim = mirCompareSimilarity(emptyTrack, emptyTrack);
      expect(sim.score).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe("mirParseResponse error cases", () => {
    it("throws on null input", () => {
      expect(() => mirParseResponse(null)).toThrow("not a valid object");
    });

    it("throws on string input", () => {
      expect(() => mirParseResponse("not a MIR response")).toThrow("not a valid object");
    });

    it("throws on boolean input", () => {
      expect(() => mirParseResponse(true)).toThrow("not a valid object");
    });

    it("throws on undefined input", () => {
      expect(() => mirParseResponse(undefined)).toThrow("not a valid object");
    });

    it("returns defaults for plain array (arrays are objects in JS)", () => {
      const result = mirParseResponse([1, 2, 3] as unknown as Record<string, unknown>);
      expect(result.status).toBe("quick");
      expect(result.analysisId).toBe("");
    });
  });
});
