import { analyzeConversation, detectSentiment } from './intelligence.engine';

describe('intelligence.engine', () => {
  it('detects buying signals and recommends a visit', () => {
    const r = analyzeConversation(
      'This is perfect, exactly what I wanted. Can you schedule a site visit this weekend? I am ready to book.',
    );
    expect(r.buying_signals.length).toBeGreaterThan(0);
    expect(r.recommended_actions.join(' ')).toMatch(/site visit/i);
    expect(r.sentiment).toBe('positive');
  });

  it('detects price objections', () => {
    const r = analyzeConversation('This is too expensive and over my budget. I need to discuss with my wife.');
    expect(r.objections.length).toBeGreaterThanOrEqual(2);
  });

  it('flags opt-out risk', () => {
    const r = analyzeConversation('Please stop calling me, I am not interested.');
    expect(r.risk_indicators.join(' ')).toMatch(/opt-out|disengagement/i);
    expect(r.recommended_actions.join(' ')).toMatch(/opt-out|TRAI/i);
  });

  it('detectSentiment handles neutral text', () => {
    expect(detectSentiment('Tell me about the property location and size.')).toBe('neutral');
  });
});
