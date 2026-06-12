import { hashingEmbedding, MockAiProvider } from './mock.provider';

describe('MockAiProvider', () => {
  const provider = new MockAiProvider();

  it('produces deterministic, normalized embeddings of fixed dimension', async () => {
    const a = await provider.embed('3 BHK flat in Ahmedabad');
    const b = await provider.embed('3 BHK flat in Ahmedabad');
    expect(a.embedding).toEqual(b.embedding);
    expect(a.embedding).toHaveLength(128);
    const norm = Math.sqrt(a.embedding.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it('embeds different text differently', async () => {
    const a = await provider.embed('home loan assistance');
    const b = await provider.embed('site visit booking');
    expect(a.embedding).not.toEqual(b.embedding);
  });

  it('returns a contextual chat reply when given knowledge context', async () => {
    const res = await provider.complete({
      messages: [
        { role: 'system', content: 'KNOWLEDGE CONTEXT:\n- Pricing: 3 BHK from 90 lakh\n\n' },
        { role: 'user', content: 'What is the price?' },
      ],
    });
    expect(res.content).toMatch(/90 lakh|budget/i);
    expect(res.usage.totalTokens).toBeGreaterThan(0);
    expect(res.provider).toBe('mock');
  });

  it('produces a diarized transcript and a recording on placeCall', async () => {
    const placed = await provider.placeCall({
      tenantId: 't1',
      toPhone: '+919900000000',
      direction: 'outbound',
    });
    expect(placed.callSid).toMatch(/^mock_call_/);
    expect(placed.recordingUrl).toBeTruthy();

    const transcription = await provider.transcribe({ recordingUrl: placed.recordingUrl!, seed: 'x' });
    expect(transcription.segments.length).toBeGreaterThan(0);
    expect(transcription.segments.some((s) => s.speaker === 'client')).toBe(true);
    expect(transcription.durationSeconds).toBeGreaterThan(0);
  });

  it('hashingEmbedding matches the provider embedding (seed parity)', async () => {
    const viaProvider = (await provider.embed('test parity')).embedding;
    expect(hashingEmbedding('test parity', 128)).toEqual(viaProvider);
  });
});
